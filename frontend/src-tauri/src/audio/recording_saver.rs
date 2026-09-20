use std::sync::{Arc, Mutex};
use tokio::sync::Mutex as AsyncMutex;
use anyhow::Result;
use log::{info, warn, error};
use tauri::{AppHandle, Runtime, Emitter};
use tokio::sync::mpsc;
use serde::{Serialize, Deserialize};
use std::path::PathBuf;

use super::recording_state::AudioChunk;
use super::audio_processing::create_meeting_folder;
use super::incremental_saver::IncrementalAudioSaver;

/// Structured transcript segment for JSON export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptSegment {
    pub id: String,
    pub text: String,
    pub audio_start_time: f64, // Seconds from recording start
    pub audio_end_time: f64,   // Seconds from recording start
    pub duration: f64,          // Segment duration in seconds
    pub display_time: String,   // Formatted time for display like "[02:15]"
    pub confidence: f32,
    pub sequence_id: u64,
}

/// Meeting metadata structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeetingMetadata {
    pub version: String,
    pub meeting_id: String,
    pub meeting_name: Option<String>,
    pub created_at: String,
    pub duration_seconds: Option<f64>,
    pub lifecycle: String,
    pub completeness: String,
    pub completeness_reason: Option<String>,
    pub devices: DeviceInfo,
    pub audio_file: String,
    pub transcript_file: String,
    pub sample_rate: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub microphone: Option<String>,
    pub system_audio: Option<String>,
}

/// New recording saver using incremental saving strategy
pub struct RecordingSaver {
    incremental_saver: Option<Arc<AsyncMutex<IncrementalAudioSaver>>>,
    meeting_folder: Option<PathBuf>,
    meeting_id: Option<String>,
    meeting_name: Option<String>,
    lifecycle: Option<String>,
    completeness: Option<String>,
    completeness_reason: Option<String>,
    metadata: Option<MeetingMetadata>,
    transcript_segments: Arc<Mutex<Vec<TranscriptSegment>>>,
    is_saving: Arc<Mutex<bool>>,
}

impl RecordingSaver {
    pub fn new() -> Self {
        Self {
            incremental_saver: None,
            meeting_folder: None,
            meeting_id: None,
            meeting_name: None,
            lifecycle: None,
            completeness: None,
            completeness_reason: None,
            metadata: None,
            transcript_segments: Arc::new(Mutex::new(Vec::new())),
            is_saving: Arc::new(Mutex::new(false)),
        }
    }

    /// Set the meeting name for this recording session
    pub fn set_meeting_name(&mut self, name: Option<String>) {
        self.meeting_name = name;
    }

    /// Attach the already committed SQLite identity and durable state projection.
    /// Recording files mirror these values; they never mint or promote them.
    pub fn set_meeting_identity(
        &mut self,
        meeting_id: String,
        lifecycle: String,
        completeness: String,
        completeness_reason: Option<String>,
    ) {
        self.meeting_id = Some(meeting_id);
        self.lifecycle = Some(lifecycle);
        self.completeness = Some(completeness);
        self.completeness_reason = completeness_reason;
    }

    /// Set device information in metadata
    pub fn set_device_info(&mut self, mic_name: Option<String>, sys_name: Option<String>) {
        if let Some(ref mut metadata) = self.metadata {
            metadata.devices.microphone = mic_name;
            metadata.devices.system_audio = sys_name;

            // Write updated metadata to disk if folder exists
            if let Some(folder) = &self.meeting_folder {
                let metadata_clone = metadata.clone();
                if let Err(e) = self.write_metadata(folder, &metadata_clone) {
                    warn!("Failed to update metadata with device info: {}", e);
                }
            }
        }
    }

    /// Add or update a structured transcript segment (upserts based on sequence_id)
    /// Also saves incrementally to disk
    pub fn add_transcript_segment(&self, segment: TranscriptSegment) {
        if let Ok(mut segments) = self.transcript_segments.lock() {
            // Check if segment with same sequence_id exists (update it)
            if let Some(existing) = segments.iter_mut().find(|s| s.sequence_id == segment.sequence_id) {
                *existing = segment.clone();
                info!("Updated transcript segment {} (seq: {}) - total segments: {}",
                      segment.id, segment.sequence_id, segments.len());
            } else {
                // New segment, add it
                segments.push(segment.clone());
                info!("Added new transcript segment {} (seq: {}) - total segments: {}",
                      segment.id, segment.sequence_id, segments.len());
            }
        } else {
            error!("Failed to lock transcript segments for adding segment {}", segment.id);
        }

        // NEW: Save incrementally to disk
        if let Some(folder) = &self.meeting_folder {
            if let Err(e) = self.write_transcripts_json(folder) {
                warn!("Failed to write incremental transcript update: {}", e);
            }
        }
    }

    /// Legacy method for backward compatibility - converts text to basic segment
    pub fn add_transcript_chunk(&self, text: String) {
        let segment = TranscriptSegment {
            id: format!("seg_{}", chrono::Utc::now().timestamp_millis()),
            text,
            audio_start_time: 0.0,
            audio_end_time: 0.0,
            duration: 0.0,
            display_time: "[00:00]".to_string(),
            confidence: 1.0,
            sequence_id: 0,
        };
        self.add_transcript_segment(segment);
    }

    /// Start accumulation with optional incremental saving
    ///
    /// # Arguments
    /// * `auto_save` - If true, creates checkpoints and enables saving. If false, audio chunks are discarded.
    pub fn start_accumulation(
        &mut self,
        auto_save: bool,
        mut receiver: mpsc::UnboundedReceiver<AudioChunk>,
    ) -> Result<()> {
        if auto_save {
            info!("Initializing incremental audio saver for recording (auto-save ENABLED)");
        } else {
            info!("Starting recording without audio saving (auto-save DISABLED - transcripts only)");
        }

        // Initialize meeting folder and incremental saver ONLY if auto_save is enabled
        let meeting_id = self
            .meeting_id
            .clone()
            .ok_or_else(|| anyhow::anyhow!("canonical meeting identity is required before recording"))?;
        let meeting_name = self
            .meeting_name
            .clone()
            .ok_or_else(|| anyhow::anyhow!("meeting display title is required before recording"))?;

        // Create metadata before the accumulation task accepts its first chunk.
        self.initialize_meeting_folder(&meeting_id, &meeting_name, auto_save)?;
        if auto_save {
            info!("Successfully initialized ID-owned meeting folder with checkpoints");
        } else {
            info!("Successfully initialized ID-owned meeting folder (transcripts only)");
        }

        // Start accumulation task
        let is_saving_clone = self.is_saving.clone();
        let incremental_saver_arc = self.incremental_saver.clone();
        let save_audio = auto_save;

        tokio::spawn(async move {
            info!("Recording saver accumulation task started (save_audio: {})", save_audio);

            while let Some(chunk) = receiver.recv().await {
                // Check if we should continue
                let should_continue = if let Ok(is_saving) = is_saving_clone.lock() {
                    *is_saving
                } else {
                    false
                };

                if !should_continue {
                    break;
                }

                // Only process audio chunks if auto_save is enabled
                if save_audio {
                    // Add chunk to incremental saver
                    if let Some(saver_arc) = &incremental_saver_arc {
                        let mut saver_guard = saver_arc.lock().await;
                        if let Err(e) = saver_guard.add_chunk(chunk) {
                            error!("Failed to add chunk to incremental saver: {}", e);
                        }
                    } else {
                        error!("Incremental saver not available while accumulating");
                    }
                } else {
                    // auto_save is false: discard audio chunk (no-op)
                    // Transcription already happened in the pipeline before this point
                }
            }

            info!("Recording saver accumulation task ended");
        });

        // Set saving flag
        if let Ok(mut is_saving) = self.is_saving.lock() {
            *is_saving = true;
        }

        Ok(())
    }

    /// Initialize meeting folder structure and metadata
    ///
    /// # Arguments
    /// * `meeting_id` - Canonical meeting UUID used as the path component
    /// * `meeting_name` - Display-only meeting title stored in metadata
    /// * `create_checkpoints` - Whether to create .checkpoints/ directory and IncrementalAudioSaver
    fn initialize_meeting_folder(
        &mut self,
        meeting_id: &str,
        meeting_name: &str,
        create_checkpoints: bool,
    ) -> Result<()> {
        // Load preferences to get base recordings folder
        let base_folder = super::recording_preferences::get_default_recordings_folder();

        // Create meeting folder structure (with or without .checkpoints/ subdirectory)
        let meeting_folder = create_meeting_folder(&base_folder, meeting_id, create_checkpoints)?;

        // Only initialize incremental saver if checkpoints are needed (auto_save is true)
        if create_checkpoints {
            let incremental_saver = IncrementalAudioSaver::new(meeting_folder.clone(), 48000)?;
            self.incremental_saver = Some(Arc::new(AsyncMutex::new(incremental_saver)));
            info!("✅ Incremental audio saver initialized for meeting: {}", meeting_name);
        } else {
            info!("⚠️  Skipped incremental audio saver (auto-save disabled)");
        }

        // Create initial metadata
        let metadata = self.build_initial_metadata(meeting_id, meeting_name, create_checkpoints)?;

        // Write initial metadata.json
        self.write_metadata(&meeting_folder, &metadata)?;

        self.meeting_folder = Some(meeting_folder);
        self.metadata = Some(metadata);

        Ok(())
    }

    fn build_initial_metadata(
        &self,
        meeting_id: &str,
        meeting_name: &str,
        create_checkpoints: bool,
    ) -> Result<MeetingMetadata> {
        Ok(MeetingMetadata {
            version: "1.0".to_string(),
            meeting_id: meeting_id.to_string(),
            meeting_name: Some(meeting_name.to_string()),
            created_at: chrono::Utc::now().to_rfc3339(),
            duration_seconds: None,
            lifecycle: self
                .lifecycle
                .clone()
                .ok_or_else(|| anyhow::anyhow!("durable meeting lifecycle is required"))?,
            completeness: self
                .completeness
                .clone()
                .ok_or_else(|| anyhow::anyhow!("durable meeting completeness is required"))?,
            completeness_reason: self.completeness_reason.clone(),
            devices: DeviceInfo {
                microphone: None,  // Could be enhanced to store actual device names
                system_audio: None,
            },
            audio_file: if create_checkpoints { "audio.mp4".to_string() } else { "".to_string() },
            transcript_file: "transcripts.json".to_string(),
            sample_rate: 48000,
        })
    }

    /// Write metadata.json to disk (atomic write with temp file)
    fn write_metadata(&self, folder: &PathBuf, metadata: &MeetingMetadata) -> Result<()> {
        let metadata_path = folder.join("metadata.json");
        let temp_path = folder.join(".metadata.json.tmp");

        let json_string = serde_json::to_string_pretty(metadata)?;
        std::fs::write(&temp_path, json_string)?;
        std::fs::rename(&temp_path, &metadata_path)?;  // Atomic

        Ok(())
    }

    /// Write transcripts.json to disk (atomic write with temp file and validation)
    fn write_transcripts_json(&self, folder: &PathBuf) -> Result<()> {
        // Clone segments to avoid holding lock during I/O
        let segments_clone = if let Ok(segments) = self.transcript_segments.lock() {
            segments.clone()
        } else {
            error!("Failed to lock transcript segments for writing");
            return Err(anyhow::anyhow!("Failed to lock transcript segments"));
        };

        info!("Writing {} transcript segments to JSON", segments_clone.len());

        let transcript_path = folder.join("transcripts.json");
        let temp_path = folder.join(".transcripts.json.tmp");

        // Create JSON structure
        let json = serde_json::json!({
            "version": "1.0",
            "segments": segments_clone,
            "last_updated": chrono::Utc::now().to_rfc3339(),
            "total_segments": segments_clone.len()
        });

        // Serialize to pretty JSON string
        let json_string = serde_json::to_string_pretty(&json)
            .map_err(|e| {
                error!("Failed to serialize transcripts to JSON: {}", e);
                anyhow::anyhow!("JSON serialization failed: {}", e)
            })?;

        // Write to temp file with error handling
        std::fs::write(&temp_path, &json_string)
            .map_err(|e| {
                error!("Failed to write transcript temp file to {}: {}", temp_path.display(), e);
                anyhow::anyhow!("Failed to write temp file: {}", e)
            })?;

        // Verify temp file was written correctly
        if !temp_path.exists() {
            error!("Temp transcript file does not exist after write: {}", temp_path.display());
            return Err(anyhow::anyhow!("Temp file verification failed"));
        }

        // Atomic rename
        std::fs::rename(&temp_path, &transcript_path)
            .map_err(|e| {
                error!("Failed to rename transcript file from {} to {}: {}",
                       temp_path.display(), transcript_path.display(), e);
                anyhow::anyhow!("Failed to rename transcript file: {}", e)
            })?;

        info!("✅ Successfully wrote transcripts.json with {} segments", segments_clone.len());
        Ok(())
    }

    // in frontend/src-tauri/src/audio/recording_saver.rs
    pub fn get_stats(&self) -> (usize, u32) {
        if let Some(ref saver) = self.incremental_saver {
            if let Ok(guard) = saver.try_lock() {
                (guard.get_checkpoint_count() as usize, 48000)
            } else {
                (0, 48000)
            }
        } else {
            (0, 48000)
        }
    }

    /// Stop and save using incremental saving approach
    ///
    /// # Arguments
    /// * `app` - Tauri app handle for emitting events
    /// * `recording_duration` - Actual recording duration in seconds (from RecordingState)
    pub async fn stop_and_save<R: Runtime>(
        &mut self,
        app: &AppHandle<R>,
        recording_duration: Option<f64>
    ) -> Result<Option<String>, String> {
        info!("Stopping recording saver");

        // Stop accumulation
        if let Ok(mut is_saving) = self.is_saving.lock() {
            *is_saving = false;
        }

        // Give time for final chunks
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;

        // Check if incremental saver exists (indicates auto_save was enabled)
        let should_save_audio = self.incremental_saver.is_some();

        if !should_save_audio {
            info!("⚠️  No audio saver initialized (auto-save was disabled) - skipping audio finalization");
            info!("✅ Transcripts and metadata already saved incrementally");
            return Ok(None);
        }

        // Finalize incremental saver (merge checkpoints into final audio.mp4)
        let final_audio_path = if let Some(saver_arc) = &self.incremental_saver {
            let mut saver = saver_arc.lock().await;
            match saver.finalize().await {
                Ok(path) => {
                    info!("✅ Successfully finalized audio: {}", path.display());
                    path
                }
                Err(e) => {
                    error!("❌ Failed to finalize incremental saver: {}", e);
                    return Err(format!("Failed to finalize audio: {}", e));
                }
            }
        } else {
            error!("No incremental saver initialized - cannot save recording");
            return Err("No incremental saver initialized".to_string());
        };

        // Save final transcripts.json with validation
        if let Some(folder) = &self.meeting_folder {
            if let Err(e) = self.write_transcripts_json(folder) {
                error!("❌ Failed to write final transcripts: {}", e);
                return Err(format!("Failed to save transcripts: {}", e));
            }

            // Verify transcripts were written correctly
            let transcript_path = folder.join("transcripts.json");
            if !transcript_path.exists() {
                error!("❌ Transcript file was not created at: {}", transcript_path.display());
                return Err("Transcript file verification failed".to_string());
            }
            info!("✅ Transcripts saved and verified at: {}", transcript_path.display());
        }

        // Update recording duration without independently promoting durable lifecycle.
        if let (Some(folder), Some(mut metadata)) = (&self.meeting_folder, self.metadata.clone()) {
            // Use actual recording duration from RecordingState (more accurate than transcript segments)
            // Falls back to last transcript segment if duration not provided
            metadata.duration_seconds = recording_duration.or_else(|| {
                if let Ok(segments) = self.transcript_segments.lock() {
                    segments.last().map(|seg| seg.audio_end_time)
                } else {
                    None
                }
            });

            if let Err(e) = self.write_metadata(folder, &metadata) {
                error!("❌ Failed to update recording metadata duration: {}", e);
                return Err(format!("Failed to update metadata: {}", e));
            }

            self.metadata = Some(metadata.clone());
            info!("✅ Metadata duration updated without lifecycle promotion: {:?}s", metadata.duration_seconds);
        }

        // Emit save event with audio and transcript paths
        let save_event = serde_json::json!({
            "audio_file": final_audio_path.to_string_lossy(),
            "transcript_file": self.meeting_folder.as_ref()
                .map(|f| f.join("transcripts.json").to_string_lossy().to_string()),
            "meeting_name": self.meeting_name,
            "meeting_folder": self.meeting_folder.as_ref()
                .map(|f| f.to_string_lossy().to_string())
        });

        if let Err(e) = app.emit("recording-saved", &save_event) {
            warn!("Failed to emit recording-saved event: {}", e);
        }

        // Clean up transcript segments
        if let Ok(mut segments) = self.transcript_segments.lock() {
            segments.clear();
        }

        Ok(Some(final_audio_path.to_string_lossy().to_string()))
    }

    /// Get the meeting folder path (for passing to backend)
    pub fn get_meeting_folder(&self) -> Option<&PathBuf> {
        self.meeting_folder.as_ref()
    }

    /// Get accumulated transcript segments (for reload sync)
    pub fn get_transcript_segments(&self) -> Vec<TranscriptSegment> {
        if let Ok(segments) = self.transcript_segments.lock() {
            segments.clone()
        } else {
            Vec::new()
        }
    }

    /// Get meeting name (for reload sync)
    pub fn get_meeting_name(&self) -> Option<String> {
        self.meeting_name.clone()
    }
}

impl Default for RecordingSaver {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod meeting_identity_propagation_tests {
    use super::{create_meeting_folder, RecordingSaver};

    #[test]
    fn meeting_identity_propagation_initial_metadata_contains_committed_state() {
        let meeting_id = "018f5e27-2f68-7e27-9c90-7c72123141ae";
        let mut saver = RecordingSaver::new();
        saver.set_meeting_name(Some("Weekly sync".to_string()));
        saver.set_meeting_identity(
            meeting_id.to_string(),
            "preparing".to_string(),
            "pending".to_string(),
            None,
        );

        let metadata = saver
            .build_initial_metadata(meeting_id, "Weekly sync", false)
            .expect("canonical metadata");

        assert_eq!(metadata.meeting_id, meeting_id);
        assert_eq!(metadata.meeting_name.as_deref(), Some("Weekly sync"));
        assert_eq!(metadata.lifecycle, "preparing");
        assert_eq!(metadata.completeness, "pending");
        assert_eq!(metadata.completeness_reason, None);
    }

    #[test]
    fn meeting_identity_propagation_same_title_ids_get_distinct_directories() {
        let base = tempfile::tempdir().expect("temporary recordings folder");
        let base_path = base.path().to_path_buf();
        let first_id = "018f5e27-2f68-7e27-9c90-7c72123141ae";
        let second_id = "018f5e27-2f68-7e27-9c90-7c72123141af";

        let first = create_meeting_folder(&base_path, first_id, false)
            .expect("first ID-owned directory");
        let second = create_meeting_folder(&base_path, second_id, false)
            .expect("second ID-owned directory");

        assert_ne!(first, second);
        assert_eq!(first.file_name().and_then(|name| name.to_str()), Some(first_id));
        assert_eq!(second.file_name().and_then(|name| name.to_str()), Some(second_id));
    }

    #[test]
    fn meeting_identity_propagation_metadata_starts_with_canonical_identity() {
        let source = include_str!("recording_saver.rs")
            .split("#[cfg(test)]")
            .next()
            .expect("recording saver production source");

        assert!(
            source.contains("pub meeting_id: String"),
            "recording metadata must require the canonical Rust meeting ID"
        );
        assert!(
            source.contains("pub lifecycle: String")
                && source.contains("pub completeness: String")
                && source.contains("pub completeness_reason: Option<String>"),
            "the first metadata write must mirror durable lifecycle and completeness"
        );
        assert!(
            !source.contains("metadata.status = \"completed\""),
            "the filesystem mirror cannot promote the durable lifecycle independently"
        );
    }

    #[test]
    fn meeting_identity_propagation_paths_use_id_not_title_authority() {
        let manager_source = include_str!("recording_manager.rs");
        let processing_source = include_str!("audio_processing.rs");
        let commands_source = include_str!("recording_commands.rs");

        assert!(
            manager_source.contains("set_meeting_identity"),
            "RecordingManager must receive the already committed identity"
        );
        assert!(
            processing_source.contains("meeting_id: &str")
                && processing_source.contains("Uuid::parse_str(meeting_id)"),
            "recording directory creation must validate and use the UUID path component"
        );
        assert!(
            commands_source.contains("move |start_result|")
                && commands_source.contains("set_meeting_identity"),
            "the Plan 01 identity must be threaded into capture before its first file write"
        );
    }

    #[test]
    fn meeting_identity_propagation_indexeddb_upgrade_preserves_legacy_records() {
        let source = include_str!("../../../src/services/indexedDBService.ts");

        assert!(
            source.contains("DB_VERSION = 2"),
            "the recovery cache needs a versioned upgrade"
        );
        assert!(
            source.contains("lifecycle: MeetingLifecycle")
                && source.contains("completeness: MeetingCompleteness")
                && source.contains("completenessReason?: string"),
            "recovery records must expose the durable lifecycle projection"
        );
        assert!(
            source.contains("legacy_pre_phase1")
                && source.contains("completion_not_verified")
                && source.contains("openCursor()"),
            "the upgrade must preserve existing keys while marking historical uncertainty"
        );
    }
}
