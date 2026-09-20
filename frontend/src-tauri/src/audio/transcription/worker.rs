// audio/transcription/worker.rs
//
// Parallel transcription worker pool and chunk processing logic.

use super::engine::TranscriptionEngine;
use super::provider::TranscriptionError;
use crate::audio::AudioChunk;
use crate::database::models::{CaptureCompleteness, TranscriptEvidence, TranscriptEvidenceInput};
use crate::database::repositories::transcript::TranscriptsRepository;
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::future::Future;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Runtime};
use uuid::Uuid;

// Sequence counter for transcript updates
static SEQUENCE_COUNTER: AtomicU64 = AtomicU64::new(0);

// Speech detection flag - reset per recording session
static SPEECH_DETECTED_EMITTED: AtomicBool = AtomicBool::new(false);

const TRANSCRIPT_EVIDENCE_PERSISTENCE_FAILED: &str = "TRANSCRIPT_EVIDENCE_PERSISTENCE_FAILED";

/// Reset the speech detected flag for a new recording session
pub fn reset_speech_detected_flag() {
    SPEECH_DETECTED_EMITTED.store(false, Ordering::SeqCst);
    info!(
        "🔍 SPEECH_DETECTED_EMITTED reset to: {}",
        SPEECH_DETECTED_EMITTED.load(Ordering::SeqCst)
    );
}

/// Returns true if the transcript text is non-trivial and should be emitted.
/// Filters empty/whitespace-only text; no confidence gating is applied.
fn should_emit_transcript(text: &str) -> bool {
    !text.trim().is_empty()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TranscriptUpdate {
    pub text: String,
    pub timestamp: String, // Wall-clock time for reference (e.g., "14:30:05")
    pub source: String,
    pub sequence_id: u64,
    pub chunk_start_time: f64, // Legacy field, kept for compatibility
    pub is_partial: bool,
    pub confidence: f32,
    // NEW: Recording-relative timestamps for playback sync
    pub audio_start_time: f64, // Seconds from recording start (e.g., 125.3)
    pub audio_end_time: f64,   // Seconds from recording start (e.g., 128.6)
    pub duration: f64,         // Segment duration in seconds (e.g., 3.3)
    pub meeting_id: Option<String>,
    pub evidence_id: Option<String>,
    pub source_segment_key: Option<String>,
    pub is_final: bool,
    pub is_canonical: bool,
    pub capture_completeness: Option<CaptureCompleteness>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct TranscriptEvidencePersistenceFailure {
    pub code: String,
    pub meeting_id: String,
    pub evidence_id: String,
    pub source_track: String,
    pub source_segment_key: String,
    pub sequence_id: u64,
    pub audio_start_time: f64,
    pub audio_end_time: f64,
    pub is_final: bool,
    pub capture_completeness: CaptureCompleteness,
    pub transcript_length: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum FinalEvidencePublication {
    Published,
    PersistenceFailed,
}

#[allow(clippy::too_many_arguments)]
fn build_transcript_update(
    text: String,
    timestamp: String,
    source_track: String,
    source_segment_key: String,
    meeting_id: String,
    sequence_id: u64,
    is_partial: bool,
    confidence: f32,
    audio_start_time: f64,
    audio_end_time: f64,
) -> TranscriptUpdate {
    TranscriptUpdate {
        text,
        timestamp,
        source: source_track,
        sequence_id,
        chunk_start_time: audio_start_time,
        is_partial,
        confidence,
        audio_start_time,
        audio_end_time,
        duration: audio_end_time - audio_start_time,
        meeting_id: Some(meeting_id),
        evidence_id: None,
        source_segment_key: Some(source_segment_key),
        is_final: !is_partial,
        is_canonical: false,
        capture_completeness: None,
    }
}

async fn persist_and_publish_final<P, PersistFuture, EmitCanonical, EmitFailure>(
    evidence: TranscriptEvidenceInput,
    mut update: TranscriptUpdate,
    persist: P,
    emit_canonical: EmitCanonical,
    emit_failure: EmitFailure,
) -> Result<FinalEvidencePublication, String>
where
    P: FnOnce(TranscriptEvidenceInput) -> PersistFuture,
    PersistFuture: Future<Output = Result<TranscriptEvidence, ()>>,
    EmitCanonical: FnOnce(&TranscriptUpdate) -> Result<(), String>,
    EmitFailure: FnOnce(&TranscriptEvidencePersistenceFailure) -> Result<(), String>,
{
    let failure = TranscriptEvidencePersistenceFailure {
        code: TRANSCRIPT_EVIDENCE_PERSISTENCE_FAILED.to_string(),
        meeting_id: evidence.meeting_id.clone(),
        evidence_id: evidence.evidence_id.clone(),
        source_track: evidence.source_track.clone(),
        source_segment_key: evidence.source_segment_key.clone(),
        sequence_id: evidence.sequence as u64,
        audio_start_time: evidence.audio_start_time,
        audio_end_time: evidence.audio_end_time,
        is_final: true,
        capture_completeness: CaptureCompleteness::Incomplete,
        transcript_length: evidence.transcript.chars().count(),
    };

    let persisted = match persist(evidence).await {
        Ok(persisted) => persisted,
        Err(()) => {
            emit_failure(&failure)?;
            return Ok(FinalEvidencePublication::PersistenceFailed);
        }
    };

    update.meeting_id = Some(persisted.meeting_id);
    update.evidence_id = Some(persisted.evidence_id);
    update.source = persisted.source_track;
    update.source_segment_key = Some(persisted.source_segment_key);
    update.is_partial = false;
    update.is_final = true;
    update.is_canonical = true;
    update.capture_completeness = Some(persisted.capture_completeness);
    emit_canonical(&update)?;

    Ok(FinalEvidencePublication::Published)
}

// NOTE: get_transcript_history and get_recording_meeting_name functions
// have been moved to recording_commands.rs where they have access to RECORDING_MANAGER

/// Optimized parallel transcription task ensuring ZERO chunk loss
pub fn start_transcription_task<R: Runtime>(
    app: AppHandle<R>,
    transcription_receiver: tokio::sync::mpsc::UnboundedReceiver<AudioChunk>,
    database_pool: SqlitePool,
    meeting_id: String,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        info!("🚀 Starting optimized parallel transcription task - guaranteeing zero chunk loss");

        // Initialize transcription engine (Whisper or Parakeet based on config)
        let transcription_engine = match super::engine::get_or_init_transcription_engine(&app).await
        {
            Ok(engine) => engine,
            Err(e) => {
                error!("Failed to initialize transcription engine: {}", e);
                let _ = app.emit("transcription-error", serde_json::json!({
                    "error": e,
                    "userMessage": "Recording failed: Unable to initialize speech recognition. Please check your model settings.",
                    "actionable": true,
                    "phase": "active"
                }));
                return;
            }
        };

        // Create parallel workers for faster processing while preserving ALL chunks
        const NUM_WORKERS: usize = 1; // Serial processing ensures transcripts emit in chronological order
        let (work_sender, work_receiver) = tokio::sync::mpsc::unbounded_channel::<AudioChunk>();
        let work_receiver = Arc::new(tokio::sync::Mutex::new(work_receiver));

        // Track completion: AtomicU64 for chunks queued, AtomicU64 for chunks completed
        let chunks_queued = Arc::new(AtomicU64::new(0));
        let chunks_completed = Arc::new(AtomicU64::new(0));
        let input_finished = Arc::new(AtomicBool::new(false));

        info!(
            "📊 Starting {} transcription worker{} (serial mode for ordered emission)",
            NUM_WORKERS,
            if NUM_WORKERS == 1 { "" } else { "s" }
        );

        // Spawn worker tasks
        let mut worker_handles = Vec::new();
        for worker_id in 0..NUM_WORKERS {
            let engine_clone = match &transcription_engine {
                TranscriptionEngine::Whisper(e) => TranscriptionEngine::Whisper(e.clone()),
                TranscriptionEngine::Parakeet(e) => TranscriptionEngine::Parakeet(e.clone()),
                TranscriptionEngine::Provider(p) => TranscriptionEngine::Provider(p.clone()),
            };
            let app_clone = app.clone();
            let work_receiver_clone = work_receiver.clone();
            let chunks_completed_clone = chunks_completed.clone();
            let input_finished_clone = input_finished.clone();
            let chunks_queued_clone = chunks_queued.clone();
            let database_pool_clone = database_pool.clone();
            let meeting_id_clone = meeting_id.clone();

            let worker_handle = tokio::spawn(async move {
                info!("👷 Worker {} started", worker_id);

                // PRE-VALIDATE model state to avoid repeated async calls per chunk
                let initial_model_loaded = engine_clone.is_model_loaded().await;
                let current_model = engine_clone
                    .get_current_model()
                    .await
                    .unwrap_or_else(|| "unknown".to_string());

                let engine_name = engine_clone.provider_name();

                if initial_model_loaded {
                    info!(
                        "✅ Worker {} pre-validation: {} model '{}' is loaded and ready",
                        worker_id, engine_name, current_model
                    );
                } else {
                    warn!(
                        "⚠️ Worker {} pre-validation: {} model not loaded - chunks may be skipped",
                        worker_id, engine_name
                    );
                }

                loop {
                    // Try to get a chunk to process
                    let chunk = {
                        let mut receiver = work_receiver_clone.lock().await;
                        receiver.recv().await
                    };

                    match chunk {
                        Some(chunk) => {
                            // PERFORMANCE OPTIMIZATION: Reduce logging in hot path
                            // Only log every 10th chunk per worker to reduce I/O overhead
                            let should_log_this_chunk = chunk.chunk_id % 10 == 0;

                            if should_log_this_chunk {
                                info!(
                                    "👷 Worker {} processing chunk {} with {} samples",
                                    worker_id,
                                    chunk.chunk_id,
                                    chunk.data.len()
                                );
                            }

                            // Check if model is still loaded before processing
                            if !engine_clone.is_model_loaded().await {
                                warn!("⚠️ Worker {}: Model unloaded, but continuing to preserve chunk {}", worker_id, chunk.chunk_id);
                                // Still count as completed even if we can't process
                                chunks_completed_clone.fetch_add(1, Ordering::SeqCst);
                                continue;
                            }

                            let chunk_id = chunk.chunk_id;
                            let chunk_timestamp = chunk.timestamp;
                            let chunk_duration = chunk.data.len() as f64 / chunk.sample_rate as f64;

                            // Transcribe with provider-agnostic approach
                            match transcribe_chunk_with_provider(&engine_clone, chunk, &app_clone)
                                .await
                            {
                                Ok((transcript, confidence_opt, is_partial)) => {
                                    let confidence_str = match confidence_opt {
                                        Some(c) => format!("{:.2}", c),
                                        None => "N/A".to_string(),
                                    };

                                    info!(
                                        "Worker {} transcription result: characters={}, confidence={}, partial={}",
                                        worker_id,
                                        transcript.chars().count(),
                                        confidence_str,
                                        is_partial
                                    );

                                    if should_emit_transcript(&transcript) {
                                        // PERFORMANCE: Only log transcription results, not every processing step
                                        info!(
                                            "Worker {} produced transcript output (characters={}, confidence={}, partial={})",
                                            worker_id,
                                            transcript.chars().count(),
                                            confidence_str,
                                            is_partial
                                        );

                                        // Emit speech-detected event for frontend UX (only on first detection per session)
                                        // This is lightweight and provides better user feedback
                                        let current_flag =
                                            SPEECH_DETECTED_EMITTED.load(Ordering::SeqCst);
                                        info!("🔍 Checking speech-detected flag: current={}, will_emit={}", current_flag, !current_flag);

                                        if !current_flag {
                                            SPEECH_DETECTED_EMITTED.store(true, Ordering::SeqCst);
                                            match app_clone.emit("speech-detected", serde_json::json!({
                                                "message": "Speech activity detected"
                                            })) {
                                                Ok(_) => info!("🎤 ✅ First speech detected - successfully emitted speech-detected event"),
                                                Err(e) => error!("🎤 ❌ Failed to emit speech-detected event: {}", e),
                                            }
                                        } else {
                                            info!("🔍 Speech already detected in this session, not re-emitting");
                                        }

                                        // Generate sequence ID and calculate timestamps FIRST
                                        let sequence_id =
                                            SEQUENCE_COUNTER.fetch_add(1, Ordering::SeqCst);
                                        let audio_start_time = chunk_timestamp; // Already in seconds from recording start
                                        let audio_end_time = chunk_timestamp + chunk_duration;

                                        let source_track = "mixed".to_string();
                                        let source_segment_key = format!("chunk-{}", chunk_id);
                                        let update = build_transcript_update(
                                            transcript,
                                            format_current_timestamp(),
                                            source_track.clone(),
                                            source_segment_key.clone(),
                                            meeting_id_clone.clone(),
                                            sequence_id,
                                            is_partial,
                                            confidence_opt.unwrap_or(0.85),
                                            audio_start_time,
                                            audio_end_time,
                                        );

                                        if is_partial {
                                            if let Err(error) =
                                                app_clone.emit("transcript-update", &update)
                                            {
                                                error!(
                                                    "Worker {} failed to emit provisional transcript update: {}",
                                                    worker_id, error
                                                );
                                            }
                                        } else {
                                            let evidence_id = Uuid::new_v4().to_string();
                                            if let Ok(sequence) = i64::try_from(sequence_id) {
                                                let evidence = TranscriptEvidenceInput {
                                                    evidence_id: evidence_id.clone(),
                                                    meeting_id: meeting_id_clone.clone(),
                                                    source_track,
                                                    source_segment_key,
                                                    sequence,
                                                    transcript: update.text.clone(),
                                                    audio_start_time,
                                                    audio_end_time,
                                                    capture_completeness:
                                                        CaptureCompleteness::Complete,
                                                };
                                                let persist_pool = database_pool_clone.clone();
                                                let canonical_app = app_clone.clone();
                                                let failure_app = app_clone.clone();

                                                match persist_and_publish_final(
                                                    evidence,
                                                    update,
                                                    move |input| async move {
                                                        TranscriptsRepository::upsert_final_evidence(
                                                            &persist_pool,
                                                            &input,
                                                        )
                                                        .await
                                                        .map_err(|_| ())
                                                    },
                                                    move |canonical| {
                                                        canonical_app
                                                            .emit("transcript-update", canonical)
                                                            .map_err(|_| {
                                                                "canonical_transcript_emit_failed"
                                                                    .to_string()
                                                            })
                                                    },
                                                    move |failure| {
                                                        failure_app
                                                            .emit(
                                                                "transcript-evidence-persistence-failed",
                                                                failure,
                                                            )
                                                            .map_err(|_| {
                                                                "evidence_failure_emit_failed"
                                                                    .to_string()
                                                            })
                                                    },
                                                )
                                                .await
                                                {
                                                    Ok(FinalEvidencePublication::Published) => {
                                                        info!(
                                                            "Worker {} committed and published final evidence {}",
                                                            worker_id, evidence_id
                                                        );
                                                    }
                                                    Ok(
                                                        FinalEvidencePublication::PersistenceFailed,
                                                    ) => {
                                                        error!(
                                                            "Worker {} suppressed canonical publication after evidence persistence failed for {}",
                                                            worker_id, evidence_id
                                                        );
                                                    }
                                                    Err(code) => {
                                                        error!(
                                                            "Worker {} could not publish transcript evidence outcome: {}",
                                                            worker_id, code
                                                        );
                                                    }
                                                }
                                            } else {
                                                let failure =
                                                    TranscriptEvidencePersistenceFailure {
                                                        code:
                                                            TRANSCRIPT_EVIDENCE_PERSISTENCE_FAILED
                                                                .to_string(),
                                                        meeting_id: meeting_id_clone.clone(),
                                                        evidence_id,
                                                        source_track,
                                                        source_segment_key,
                                                        sequence_id,
                                                        audio_start_time,
                                                        audio_end_time,
                                                        is_final: true,
                                                        capture_completeness:
                                                            CaptureCompleteness::Incomplete,
                                                        transcript_length: update
                                                            .text
                                                            .chars()
                                                            .count(),
                                                    };
                                                if let Err(emit_error) = app_clone.emit(
                                                    "transcript-evidence-persistence-failed",
                                                    failure,
                                                ) {
                                                    error!(
                                                        "Worker {} failed to emit the typed evidence failure: {}",
                                                        worker_id, emit_error
                                                    );
                                                }
                                                error!(
                                                    "Worker {} suppressed canonical publication because the evidence sequence exceeded SQLite range",
                                                    worker_id
                                                );
                                            }
                                        }
                                    }
                                }
                                Err(e) => {
                                    // Improved error handling with specific cases
                                    match e {
                                        TranscriptionError::AudioTooShort { .. } => {
                                            // Skip silently, this is expected for very short chunks
                                            info!("Worker {}: {}", worker_id, e);
                                            chunks_completed_clone.fetch_add(1, Ordering::SeqCst);
                                            continue;
                                        }
                                        TranscriptionError::ModelNotLoaded => {
                                            warn!(
                                                "Worker {}: Model unloaded during transcription",
                                                worker_id
                                            );
                                            chunks_completed_clone.fetch_add(1, Ordering::SeqCst);
                                            continue;
                                        }
                                        _ => {
                                            warn!(
                                                "Worker {}: Transcription failed: {}",
                                                worker_id, e
                                            );
                                            let _ = app_clone
                                                .emit("transcription-warning", e.to_string());
                                        }
                                    }
                                }
                            }

                            // Mark chunk as completed
                            let completed =
                                chunks_completed_clone.fetch_add(1, Ordering::SeqCst) + 1;
                            let queued = chunks_queued_clone.load(Ordering::SeqCst);

                            // PERFORMANCE: Only log progress every 5th chunk to reduce I/O overhead
                            if completed % 5 == 0 || should_log_this_chunk {
                                info!(
                                    "Worker {}: Progress {}/{} chunks ({:.1}%)",
                                    worker_id,
                                    completed,
                                    queued,
                                    (completed as f64 / queued.max(1) as f64 * 100.0)
                                );
                            }

                            // Emit progress event for frontend
                            let progress_percentage = if queued > 0 {
                                (completed as f64 / queued as f64 * 100.0) as u32
                            } else {
                                100
                            };

                            let _ = app_clone.emit("transcription-progress", serde_json::json!({
                                "worker_id": worker_id,
                                "chunks_completed": completed,
                                "chunks_queued": queued,
                                "progress_percentage": progress_percentage,
                                "message": format!("Worker {} processing... ({}/{})", worker_id, completed, queued)
                            }));
                        }
                        None => {
                            // No more chunks available
                            if input_finished_clone.load(Ordering::SeqCst) {
                                // Double-check that all queued chunks are actually completed
                                let final_queued = chunks_queued_clone.load(Ordering::SeqCst);
                                let final_completed = chunks_completed_clone.load(Ordering::SeqCst);

                                if final_completed >= final_queued {
                                    info!(
                                        "👷 Worker {} finishing - all {}/{} chunks processed",
                                        worker_id, final_completed, final_queued
                                    );
                                    break;
                                } else {
                                    warn!("👷 Worker {} detected potential chunk loss: {}/{} completed, waiting...", worker_id, final_completed, final_queued);
                                    // AGGRESSIVE POLLING: Reduced from 50ms to 5ms for faster chunk detection during shutdown
                                    tokio::time::sleep(tokio::time::Duration::from_millis(5)).await;
                                }
                            } else {
                                // AGGRESSIVE POLLING: Reduced from 10ms to 1ms for faster response during shutdown
                                tokio::time::sleep(tokio::time::Duration::from_millis(1)).await;
                            }
                        }
                    }
                }

                info!("👷 Worker {} completed", worker_id);
            });

            worker_handles.push(worker_handle);
        }

        // Main dispatcher: receive chunks and distribute to workers
        let mut receiver = transcription_receiver;
        while let Some(chunk) = receiver.recv().await {
            let queued = chunks_queued.fetch_add(1, Ordering::SeqCst) + 1;
            info!(
                "📥 Dispatching chunk {} to workers (total queued: {})",
                chunk.chunk_id, queued
            );

            if let Err(_) = work_sender.send(chunk) {
                error!("❌ Failed to send chunk to workers - this should not happen!");
                break;
            }
        }

        // Signal that input is finished
        input_finished.store(true, Ordering::SeqCst);
        drop(work_sender); // Close the channel to signal workers

        let total_chunks_queued = chunks_queued.load(Ordering::SeqCst);
        info!("📭 Input finished with {} total chunks queued. Waiting for all {} workers to complete...",
              total_chunks_queued, NUM_WORKERS);

        // Emit final chunk count to frontend
        let _ = app.emit("transcription-queue-complete", serde_json::json!({
            "total_chunks": total_chunks_queued,
            "message": format!("{} chunks queued for processing - waiting for completion", total_chunks_queued)
        }));

        // Wait for all workers to complete
        for (worker_id, handle) in worker_handles.into_iter().enumerate() {
            if let Err(e) = handle.await {
                error!("❌ Worker {} panicked: {:?}", worker_id, e);
            } else {
                info!("✅ Worker {} completed successfully", worker_id);
            }
        }

        // Final verification with retry logic to catch any stragglers
        let mut verification_attempts = 0;
        const MAX_VERIFICATION_ATTEMPTS: u32 = 10;

        loop {
            let final_queued = chunks_queued.load(Ordering::SeqCst);
            let final_completed = chunks_completed.load(Ordering::SeqCst);

            if final_queued == final_completed {
                info!(
                    "🎉 ALL {} chunks processed successfully - ZERO chunks lost!",
                    final_completed
                );
                break;
            } else if verification_attempts < MAX_VERIFICATION_ATTEMPTS {
                verification_attempts += 1;
                warn!("⚠️ Chunk count mismatch (attempt {}): {} queued, {} completed - waiting for stragglers...",
                     verification_attempts, final_queued, final_completed);

                // Wait a bit for any remaining chunks to be processed
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            } else {
                error!(
                    "❌ CRITICAL: After {} attempts, chunk loss detected: {} queued, {} completed",
                    MAX_VERIFICATION_ATTEMPTS, final_queued, final_completed
                );

                // Emit critical error event
                let _ = app.emit(
                    "transcript-chunk-loss-detected",
                    serde_json::json!({
                        "chunks_queued": final_queued,
                        "chunks_completed": final_completed,
                        "chunks_lost": final_queued - final_completed,
                        "message": "Some transcript chunks may have been lost during shutdown"
                    }),
                );
                break;
            }
        }

        info!("✅ Parallel transcription task completed - all workers finished, ready for model unload");
    })
}

/// Transcribe audio chunk using the appropriate provider (Whisper, Parakeet, or trait-based)
/// Returns: (text, confidence Option, is_partial)
async fn transcribe_chunk_with_provider<R: Runtime>(
    engine: &TranscriptionEngine,
    chunk: AudioChunk,
    app: &AppHandle<R>,
) -> std::result::Result<(String, Option<f32>, bool), TranscriptionError> {
    // Convert to 16kHz mono for transcription
    let transcription_data = if chunk.sample_rate != 16000 {
        crate::audio::audio_processing::resample_audio(&chunk.data, chunk.sample_rate, 16000)
    } else {
        chunk.data
    };

    // Skip VAD processing here since the pipeline already extracted speech using VAD
    let speech_samples = transcription_data;

    // Check for empty samples - improved error handling
    if speech_samples.is_empty() {
        warn!(
            "Audio chunk {} is empty, skipping transcription",
            chunk.chunk_id
        );
        return Err(TranscriptionError::AudioTooShort {
            samples: 0,
            minimum: 1600, // 100ms at 16kHz
        });
    }

    // Calculate energy for logging/monitoring only
    let energy: f32 =
        speech_samples.iter().map(|&x| x * x).sum::<f32>() / speech_samples.len() as f32;
    info!(
        "Processing speech audio chunk {} with {} samples (energy: {:.6})",
        chunk.chunk_id,
        speech_samples.len(),
        energy
    );

    // Transcribe using the appropriate engine (with improved error handling)
    match engine {
        TranscriptionEngine::Whisper(whisper_engine) => {
            // Get language preference from global state
            let language = crate::get_language_preference_internal();

            match whisper_engine
                .transcribe_audio_with_confidence(speech_samples, language)
                .await
            {
                Ok((text, confidence, is_partial)) => {
                    let cleaned_text = text.trim().to_string();
                    if cleaned_text.is_empty() {
                        return Ok((String::new(), Some(confidence), is_partial));
                    }

                    info!(
                        "Whisper transcription complete for chunk {} (characters={}, confidence: {:.2}, partial: {})",
                        chunk.chunk_id,
                        cleaned_text.chars().count(),
                        confidence,
                        is_partial
                    );

                    Ok((cleaned_text, Some(confidence), is_partial))
                }
                Err(e) => {
                    error!(
                        "Whisper transcription failed for chunk {}: {}",
                        chunk.chunk_id, e
                    );

                    let transcription_error = TranscriptionError::EngineFailed(e.to_string());
                    let _ = app.emit(
                        "transcription-error",
                        &serde_json::json!({
                            "error": transcription_error.to_string(),
                            "userMessage": format!("Transcription failed: {}", transcription_error),
                            "actionable": false,
                            "phase": "active"
                        }),
                    );

                    Err(transcription_error)
                }
            }
        }
        TranscriptionEngine::Parakeet(parakeet_engine) => {
            match parakeet_engine.transcribe_audio(speech_samples).await {
                Ok(text) => {
                    let cleaned_text = text.trim().to_string();
                    if cleaned_text.is_empty() {
                        return Ok((String::new(), None, false));
                    }

                    info!(
                        "Parakeet transcription complete for chunk {} (characters={})",
                        chunk.chunk_id,
                        cleaned_text.chars().count()
                    );

                    // Parakeet doesn't provide confidence or partial results
                    Ok((cleaned_text, None, false))
                }
                Err(e) => {
                    error!(
                        "Parakeet transcription failed for chunk {}: {}",
                        chunk.chunk_id, e
                    );

                    let transcription_error = TranscriptionError::EngineFailed(e.to_string());
                    let _ = app.emit(
                        "transcription-error",
                        &serde_json::json!({
                            "error": transcription_error.to_string(),
                            "userMessage": format!("Transcription failed: {}", transcription_error),
                            "actionable": false,
                            "phase": "active"
                        }),
                    );

                    Err(transcription_error)
                }
            }
        }
        TranscriptionEngine::Provider(provider) => {
            // NEW: Trait-based provider (clean, unified interface)
            let language = crate::get_language_preference_internal();

            match provider.transcribe(speech_samples, language).await {
                Ok(result) => {
                    let cleaned_text = result.text.trim().to_string();
                    if cleaned_text.is_empty() {
                        return Ok((String::new(), result.confidence, result.is_partial));
                    }

                    let confidence_str = match result.confidence {
                        Some(c) => format!("confidence: {:.2}", c),
                        None => "no confidence".to_string(),
                    };

                    info!(
                        "{} transcription complete for chunk {} (characters={}, {}, partial: {})",
                        provider.provider_name(),
                        chunk.chunk_id,
                        cleaned_text.chars().count(),
                        confidence_str,
                        result.is_partial
                    );

                    Ok((cleaned_text, result.confidence, result.is_partial))
                }
                Err(e) => {
                    error!(
                        "{} transcription failed for chunk {}: {}",
                        provider.provider_name(),
                        chunk.chunk_id,
                        e
                    );

                    let _ = app.emit(
                        "transcription-error",
                        &serde_json::json!({
                            "error": e.to_string(),
                            "userMessage": format!("Transcription failed: {}", e),
                            "actionable": false,
                            "phase": "active"
                        }),
                    );

                    Err(e)
                }
            }
        }
    }
}

/// Format current timestamp (wall-clock time)
fn format_current_timestamp() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();

    let hours = (now.as_secs() / 3600) % 24;
    let minutes = (now.as_secs() / 60) % 60;
    let seconds = now.as_secs() % 60;

    format!("{:02}:{:02}:{:02}", hours, minutes, seconds)
}

/// Format recording-relative time as [MM:SS]
#[allow(dead_code)]
fn format_recording_time(seconds: f64) -> String {
    let total_seconds = seconds.floor() as u64;
    let minutes = total_seconds / 60;
    let secs = total_seconds % 60;

    format!("[{:02}:{:02}]", minutes, secs)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::models::DateTimeUtc;

    fn evidence_input() -> TranscriptEvidenceInput {
        TranscriptEvidenceInput {
            evidence_id: "018f5e27-2f68-7e27-9c90-7c72123141af".to_string(),
            meeting_id: "018f5e27-2f68-7e27-9c90-7c72123141ae".to_string(),
            source_track: "mixed".to_string(),
            source_segment_key: "chunk-42".to_string(),
            sequence: 42,
            transcript: "final words".to_string(),
            audio_start_time: 1.25,
            audio_end_time: 2.5,
            capture_completeness: CaptureCompleteness::Complete,
        }
    }

    fn persisted_evidence(input: &TranscriptEvidenceInput) -> TranscriptEvidence {
        let now = DateTimeUtc(chrono::Utc::now());
        TranscriptEvidence {
            evidence_id: input.evidence_id.clone(),
            meeting_id: input.meeting_id.clone(),
            source_track: input.source_track.clone(),
            source_segment_key: input.source_segment_key.clone(),
            sequence: input.sequence,
            transcript: input.transcript.clone(),
            audio_start_time: input.audio_start_time,
            audio_end_time: input.audio_end_time,
            is_final: true,
            capture_completeness: input.capture_completeness,
            created_at: now.clone(),
            updated_at: now,
        }
    }

    fn candidate_update(is_partial: bool) -> TranscriptUpdate {
        build_transcript_update(
            "final words".to_string(),
            "12:34:56".to_string(),
            "mixed".to_string(),
            "chunk-42".to_string(),
            "018f5e27-2f68-7e27-9c90-7c72123141ae".to_string(),
            42,
            is_partial,
            0.9,
            1.25,
            2.5,
        )
    }

    #[test]
    fn keeps_short_acknowledgements() {
        assert!(should_emit_transcript("Yes"));
        assert!(should_emit_transcript("ok"));
    }

    #[test]
    fn drops_empty_and_whitespace_only() {
        assert!(!should_emit_transcript(""));
        assert!(!should_emit_transcript("   "));
    }

    #[tokio::test]
    async fn transcript_evidence_commit_precedes_canonical_publication() {
        let input = evidence_input();
        let persisted = persisted_evidence(&input);
        let order = Arc::new(std::sync::Mutex::new(Vec::new()));
        let canonical = Arc::new(std::sync::Mutex::new(None));

        let persist_order = order.clone();
        let canonical_order = order.clone();
        let canonical_output = canonical.clone();
        let outcome = persist_and_publish_final(
            input,
            candidate_update(false),
            move |_| async move {
                persist_order.lock().unwrap().push("persist");
                Ok(persisted)
            },
            move |update| {
                canonical_order.lock().unwrap().push("canonical");
                *canonical_output.lock().unwrap() = Some(update.clone());
                Ok(())
            },
            |_| Err("failure event must not emit".to_string()),
        )
        .await
        .expect("publication result");

        assert_eq!(outcome, FinalEvidencePublication::Published);
        assert_eq!(*order.lock().unwrap(), vec!["persist", "canonical"]);
        let canonical = canonical.lock().unwrap().clone().expect("canonical update");
        assert!(canonical.is_final);
        assert!(canonical.is_canonical);
        assert!(!canonical.is_partial);
        assert!(canonical.evidence_id.is_some());
    }

    #[tokio::test]
    async fn transcript_evidence_failure_is_typed_and_suppresses_canonical_publication() {
        let canonical_emitted = Arc::new(AtomicBool::new(false));
        let failure = Arc::new(std::sync::Mutex::new(None));
        let canonical_flag = canonical_emitted.clone();
        let failure_output = failure.clone();

        let outcome = persist_and_publish_final(
            evidence_input(),
            candidate_update(false),
            |_| async { Err(()) },
            move |_| {
                canonical_flag.store(true, Ordering::SeqCst);
                Ok(())
            },
            move |fact| {
                *failure_output.lock().unwrap() = Some(fact.clone());
                Ok(())
            },
        )
        .await
        .expect("failure publication result");

        assert_eq!(outcome, FinalEvidencePublication::PersistenceFailed);
        assert!(!canonical_emitted.load(Ordering::SeqCst));
        let failure = failure.lock().unwrap().clone().expect("typed failure fact");
        assert_eq!(failure.code, TRANSCRIPT_EVIDENCE_PERSISTENCE_FAILED);
        assert_eq!(
            failure.capture_completeness,
            CaptureCompleteness::Incomplete
        );
        assert!(failure.is_final);
        assert_eq!(failure.transcript_length, "final words".chars().count());
    }

    #[test]
    fn transcript_evidence_partials_remain_provisional_and_non_citable() {
        let partial = candidate_update(true);

        assert!(partial.is_partial);
        assert!(!partial.is_final);
        assert!(!partial.is_canonical);
        assert!(partial.evidence_id.is_none());
        assert!(partial.capture_completeness.is_none());
    }
}
