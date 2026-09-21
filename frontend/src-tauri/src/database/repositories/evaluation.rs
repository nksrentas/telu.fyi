//! Durable, content-redacted evaluation evidence for one canonical meeting run.

use crate::audio::transcription::QueueSnapshot;
use crate::observability::{ResourceSample, StageRecord};
use crate::trust::outbound::{OutboundAttempt, OutboundRoute};
use crate::trust::provider_route::EffectiveRoute;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Error as SqlxError, SqlitePool};

pub const EVALUATION_SCHEMA_VERSION: u16 = 1;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EvaluationRunManifest {
    pub schema_version: u16,
    pub run_id: String,
    pub meeting_id: String,
    pub scenario_version: String,
    pub started_at_utc: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EvaluationQueueRecord {
    pub run_id: String,
    pub sequence: u64,
    pub observed_offset_micros: u64,
    pub observed_at_utc: DateTime<Utc>,
    pub snapshot: QueueSnapshot,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EvaluationRouteRecord {
    pub run_id: String,
    pub meeting_id: String,
    pub sequence: u64,
    pub observed_offset_micros: u64,
    pub observed_at_utc: DateTime<Utc>,
    pub route: EffectiveRoute,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EvaluationOutboundRecord {
    pub run_id: String,
    pub sequence: u64,
    pub source_run_id: String,
    pub meeting_id: Option<String>,
    pub observed_offset_micros: u64,
    pub observed_at_utc: DateTime<Utc>,
    pub route: OutboundRoute,
    pub disposition: crate::trust::outbound::OutboundDisposition,
    pub redacted_code: Option<String>,
}

impl EvaluationOutboundRecord {
    pub fn from_attempt(run_id: impl Into<String>, attempt: OutboundAttempt) -> Self {
        Self {
            run_id: run_id.into(),
            sequence: attempt.sequence,
            source_run_id: attempt.run_id,
            meeting_id: attempt.meeting_id,
            observed_offset_micros: attempt.monotonic_offset_ns / 1_000,
            observed_at_utc: attempt.observed_at_utc,
            route: attempt.route,
            disposition: attempt.disposition,
            redacted_code: attempt.redacted_code,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EvaluationErrorRecord {
    pub run_id: String,
    pub sequence: u64,
    pub observed_offset_micros: u64,
    pub observed_at_utc: DateTime<Utc>,
    pub component: String,
    pub redacted_code: String,
    pub work_id: Option<String>,
    pub evidence_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "recordType", rename_all = "snake_case")]
pub enum EvaluationRecord {
    Stage(StageRecord),
    Queue(EvaluationQueueRecord),
    Resource(ResourceSample),
    Route(EvaluationRouteRecord),
    Outbound(EvaluationOutboundRecord),
    Error(EvaluationErrorRecord),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AppendBatchResult {
    pub attempted: usize,
    pub inserted: usize,
    pub already_present: usize,
}

#[derive(Debug, thiserror::Error)]
pub enum EvaluationRepositoryError {
    #[error("evaluation repository is not implemented")]
    RepositoryUnavailable,
    #[error("invalid evaluation record")]
    InvalidRecord,
    #[error("evaluation record conflicts with durable evidence")]
    IdentityConflict,
    #[error("evaluation storage failed")]
    Storage(#[from] SqlxError),
}

pub struct EvaluationRepository;

impl EvaluationRepository {
    pub async fn create_run(
        _pool: &SqlitePool,
        _manifest: &EvaluationRunManifest,
    ) -> Result<EvaluationRunManifest, EvaluationRepositoryError> {
        Err(EvaluationRepositoryError::RepositoryUnavailable)
    }

    pub async fn append_batch(
        _pool: &SqlitePool,
        _run_id: &str,
        _records: &[EvaluationRecord],
    ) -> Result<AppendBatchResult, EvaluationRepositoryError> {
        Err(EvaluationRepositoryError::RepositoryUnavailable)
    }
}

#[cfg(test)]
mod evaluation_repository_tests {
    use super::*;
    use crate::observability::resource_sampler::RESOURCE_SCHEMA_VERSION;
    use crate::observability::stage_clock::STAGE_SCHEMA_VERSION;
    use crate::observability::{
        CpuMemoryObservation, Observation, PowerObservation, ResourceScope, StageName,
        UnknownReason,
    };
    use crate::trust::outbound::{OutboundDisposition, OutboundRoute};
    use crate::trust::provider_route::{Capability, LocationClass, RouteValidationState};
    use sqlx::{sqlite::SqlitePoolOptions, Row};

    const MEETING_ID: &str = "018f5e27-2f68-7e27-9c90-7c72123141ae";
    const EVIDENCE_ID: &str = "018f5e27-2f68-7e27-9c90-7c72123141af";
    const RUN_ID: &str = "018f5e27-2f68-7e27-9c90-7c72123141b0";

    async fn memory_pool() -> SqlitePool {
        SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("in-memory SQLite pool")
    }

    async fn migrated_pool() -> SqlitePool {
        let pool = memory_pool().await;
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("fresh migration set");
        insert_meeting(&pool, MEETING_ID).await;
        pool
    }

    async fn insert_meeting(pool: &SqlitePool, meeting_id: &str) {
        let now = Utc::now();
        sqlx::query(
            "INSERT INTO meetings (
                id, title, created_at, updated_at, lifecycle, completeness,
                completeness_reason, started_at_utc
             ) VALUES (?, 'Evaluation test', ?, ?, 'recording', 'pending', NULL, ?)",
        )
        .bind(meeting_id)
        .bind(now)
        .bind(now)
        .bind(now.to_rfc3339())
        .execute(pool)
        .await
        .expect("canonical meeting fixture");
    }

    fn manifest() -> EvaluationRunManifest {
        EvaluationRunManifest {
            schema_version: EVALUATION_SCHEMA_VERSION,
            run_id: RUN_ID.to_string(),
            meeting_id: MEETING_ID.to_string(),
            scenario_version: "recording_runtime_v1".to_string(),
            started_at_utc: Utc::now(),
        }
    }

    fn route() -> EffectiveRoute {
        EffectiveRoute {
            capability: Capability::Transcription,
            provider_id: "parakeet".to_string(),
            model_id: "parakeet-local".to_string(),
            location_class: Some(LocationClass::Local),
            sanitized_origin: Some("This device".to_string()),
            encrypted: true,
            validation_state: RouteValidationState::Validated,
            resolved_addresses: Vec::new(),
        }
    }

    fn records() -> Vec<EvaluationRecord> {
        let observed_at_utc = Utc::now();
        let route = route();
        let outbound_route = OutboundRoute {
            capability: route.capability,
            provider_id: "ollama".to_string(),
            model_id: "llama-local".to_string(),
            location_class: LocationClass::Local,
            sanitized_origin: "http://127.0.0.1:11434".to_string(),
            encrypted: false,
            validation_state: RouteValidationState::Validated,
            resolved_addresses: vec!["127.0.0.1".to_string()],
        };
        vec![
            EvaluationRecord::Stage(StageRecord {
                schema_version: STAGE_SCHEMA_VERSION,
                sequence: 0,
                run_id: RUN_ID.to_string(),
                meeting_id: MEETING_ID.to_string(),
                work_id: "mixed:chunk-1".to_string(),
                evidence_id: EVIDENCE_ID.to_string(),
                stage: StageName::FinalTranscriptPersisted,
                offset_micros: 1_000,
                observed_at_utc,
            }),
            EvaluationRecord::Queue(EvaluationQueueRecord {
                run_id: RUN_ID.to_string(),
                sequence: 0,
                observed_offset_micros: 1_100,
                observed_at_utc,
                snapshot: QueueSnapshot {
                    capacity: 8,
                    depth: 0,
                    active: 0,
                    oldest_age_ms: None,
                    accepted: 1,
                    started: 1,
                    completed: 1,
                    failed: 0,
                    cancelled: 0,
                    superseded: 0,
                    rejected: 0,
                },
            }),
            EvaluationRecord::Resource(ResourceSample {
                schema_version: RESOURCE_SCHEMA_VERSION,
                run_id: RUN_ID.to_string(),
                sequence: 0,
                interval_ms: 250,
                observed_offset_micros: 1_200,
                observed_at_utc,
                process: CpuMemoryObservation {
                    scope: ResourceScope::Process,
                    cpu_percent: 4.5,
                    memory_bytes: 4_096,
                    total_memory_bytes: None,
                },
                system: CpuMemoryObservation {
                    scope: ResourceScope::System,
                    cpu_percent: 25.0,
                    memory_bytes: 8_192,
                    total_memory_bytes: Some(16_384),
                },
                power: PowerObservation {
                    collector: "test_collector".to_string(),
                    method: "fixture".to_string(),
                    source: Observation::Unknown {
                        reason: UnknownReason::CollectorUnavailable,
                    },
                    battery_percent: Observation::Unknown {
                        reason: UnknownReason::BatteryNotReported,
                    },
                    energy_impact: Observation::Unknown {
                        reason: UnknownReason::EnergyImpactNotMeasured,
                    },
                    uncertainty: Some("fixture_unknown".to_string()),
                },
            }),
            EvaluationRecord::Route(EvaluationRouteRecord {
                run_id: RUN_ID.to_string(),
                meeting_id: MEETING_ID.to_string(),
                sequence: 0,
                observed_offset_micros: 1_300,
                observed_at_utc,
                route,
            }),
            EvaluationRecord::Outbound(EvaluationOutboundRecord {
                run_id: RUN_ID.to_string(),
                sequence: 0,
                source_run_id: "process-safe".to_string(),
                meeting_id: Some(MEETING_ID.to_string()),
                observed_offset_micros: 1_400,
                observed_at_utc,
                route: outbound_route,
                disposition: OutboundDisposition::Permitted,
                redacted_code: Some("DISPATCH_AUTHORIZED".to_string()),
            }),
            EvaluationRecord::Error(EvaluationErrorRecord {
                run_id: RUN_ID.to_string(),
                sequence: 0,
                observed_offset_micros: 1_500,
                observed_at_utc,
                component: "transcription".to_string(),
                redacted_code: "EVIDENCE_PERSISTENCE_FAILED".to_string(),
                work_id: Some("mixed:chunk-1".to_string()),
                evidence_id: Some(EVIDENCE_ID.to_string()),
            }),
        ]
    }

    #[tokio::test]
    async fn evaluation_repository_fresh_and_legacy_migrations_preserve_product_ids() {
        let fresh = migrated_pool().await;
        let table_count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM sqlite_master
             WHERE type = 'table' AND name LIKE 'evaluation_%'",
        )
        .fetch_one(&fresh)
        .await
        .expect("fresh schema inspection");
        assert!(
            table_count >= 7,
            "evaluation tables must migrate on a fresh database"
        );
        assert_eq!(
            sqlx::query_scalar::<_, String>("SELECT id FROM meetings LIMIT 1")
                .fetch_one(&fresh)
                .await
                .expect("fresh meeting identity"),
            MEETING_ID
        );

        let legacy = memory_pool().await;
        sqlx::query(
            "CREATE TABLE meetings (
                id TEXT PRIMARY KEY, title TEXT NOT NULL,
                created_at TEXT NOT NULL, updated_at TEXT NOT NULL
             )",
        )
        .execute(&legacy)
        .await
        .expect("legacy meetings schema");
        sqlx::query(
            "INSERT INTO meetings VALUES
             ('legacy-stable-id', 'Legacy', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')",
        )
        .execute(&legacy)
        .await
        .expect("legacy meeting fixture");
        sqlx::raw_sql(include_str!(
            "../../../migrations/20260920000400_phase1_evaluation_runs.sql"
        ))
        .execute(&legacy)
        .await
        .expect("evaluation migration over legacy meeting schema");
        assert_eq!(
            sqlx::query_scalar::<_, String>("SELECT id FROM meetings LIMIT 1")
                .fetch_one(&legacy)
                .await
                .expect("legacy meeting identity after migration"),
            "legacy-stable-id"
        );
    }

    #[tokio::test]
    async fn evaluation_repository_joins_all_record_classes_by_run_and_stable_sequence() {
        let pool = migrated_pool().await;
        EvaluationRepository::create_run(&pool, &manifest())
            .await
            .expect("versioned evaluation run");
        let result = EvaluationRepository::append_batch(&pool, RUN_ID, &records())
            .await
            .expect("joined evaluation batch");
        assert_eq!(result.inserted, 6);

        for table in [
            "evaluation_stage_records",
            "evaluation_queue_records",
            "evaluation_resource_records",
            "evaluation_route_records",
            "evaluation_outbound_records",
            "evaluation_error_records",
        ] {
            let count = sqlx::query_scalar::<_, i64>(&format!(
                "SELECT COUNT(*) FROM {table} WHERE run_id = ? AND sequence = 0"
            ))
            .bind(RUN_ID)
            .fetch_one(&pool)
            .await
            .expect("joined record count");
            assert_eq!(count, 1, "table={table}");
        }
    }

    #[tokio::test]
    async fn evaluation_repository_interrupted_batch_retry_is_idempotent() {
        let pool = migrated_pool().await;
        EvaluationRepository::create_run(&pool, &manifest())
            .await
            .expect("versioned evaluation run");
        let first = EvaluationRepository::append_batch(&pool, RUN_ID, &records())
            .await
            .expect("first batch write");
        let retry = EvaluationRepository::append_batch(&pool, RUN_ID, &records())
            .await
            .expect("idempotent retry");
        assert_eq!(first.inserted, 6);
        assert_eq!(retry.inserted, 0);
        assert_eq!(retry.already_present, 6);

        let duplicate_sequences = sqlx::query(
            "SELECT run_id, sequence, COUNT(*) AS duplicate_count
             FROM evaluation_stage_records
             GROUP BY run_id, sequence HAVING COUNT(*) > 1",
        )
        .fetch_all(&pool)
        .await
        .expect("duplicate sequence query");
        assert!(duplicate_sequences.is_empty());
    }

    #[test]
    fn evaluation_repository_default_rows_are_content_and_secret_redacted() {
        let serialized = serde_json::to_string(&records()).expect("serialize evaluation rows");
        for forbidden in [
            "spoken private words",
            "super-secret",
            "api_key",
            "/Users/private",
            "audio_payload",
            "request_payload",
        ] {
            assert!(!serialized.contains(forbidden), "forbidden={forbidden}");
        }

        let source = include_str!("../../../migrations/20260920000400_phase1_evaluation_runs.sql")
            .to_ascii_lowercase();
        for forbidden_column in [
            "transcript_text",
            "audio_data",
            "api_key",
            "credential",
            "request_payload",
            "response_payload",
            "full_path",
        ] {
            assert!(
                !source.contains(forbidden_column),
                "migration must exclude {forbidden_column}"
            );
        }
    }
}
