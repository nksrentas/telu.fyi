use app_lib::database::models::MeetingModel;
use chrono::Utc;
use serde_json::Value;
use sqlx::{sqlite::SqlitePoolOptions, Row};

async fn memory_pool() -> sqlx::SqlitePool {
    SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("in-memory SQLite pool")
}

#[tokio::test]
async fn meeting_identity_migration_fresh_database_projects_typed_state() {
    let pool = memory_pool().await;
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("fresh migration set");

    let now = Utc::now();
    sqlx::query(
        "INSERT INTO meetings (
            id, title, created_at, updated_at, lifecycle, completeness,
            completeness_reason, started_at_utc
         ) VALUES (?, ?, ?, ?, 'preparing', 'pending', NULL, ?)",
    )
    .bind("018f5e27-2f68-7e27-9c90-7c72123141ae")
    .bind("Fresh meeting")
    .bind(now)
    .bind(now)
    .bind(now.to_rfc3339())
    .execute(&pool)
    .await
    .expect("fresh meeting insert");

    let meeting = sqlx::query_as::<_, MeetingModel>("SELECT * FROM meetings LIMIT 1")
        .fetch_one(&pool)
        .await
        .expect("typed fresh meeting projection");
    let projection = serde_json::to_value(meeting).expect("serializable projection");

    assert_eq!(projection["lifecycle"], Value::String("preparing".into()));
    assert_eq!(projection["completeness"], Value::String("pending".into()));
    assert_eq!(projection["completeness_reason"], Value::Null);
}

#[tokio::test]
async fn meeting_identity_migration_legacy_database_preserves_identity_and_uncertainty() {
    let pool = memory_pool().await;
    sqlx::query(
        "CREATE TABLE meetings (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            folder_path TEXT
        )",
    )
    .execute(&pool)
    .await
    .expect("legacy meetings table");
    sqlx::query(
        "INSERT INTO meetings (id, title, created_at, updated_at, folder_path)
         VALUES ('legacy-stable-id', 'Legacy title', '2025-01-02T03:04:05Z',
                 '2025-01-02T03:04:06Z', '/recordings/legacy-stable-id')",
    )
    .execute(&pool)
    .await
    .expect("legacy meeting fixture");

    sqlx::raw_sql(include_str!(
        "../migrations/20260920000100_phase1_meeting_identity.sql"
    ))
    .execute(&pool)
    .await
    .expect("phase-one forward migration");

    let row = sqlx::query("SELECT * FROM meetings WHERE id = 'legacy-stable-id'")
        .fetch_one(&pool)
        .await
        .expect("migrated legacy row");
    assert_eq!(row.get::<String, _>("id"), "legacy-stable-id");
    assert_eq!(row.get::<String, _>("title"), "Legacy title");
    assert_eq!(
        row.get::<Option<String>, _>("folder_path").as_deref(),
        Some("/recordings/legacy-stable-id")
    );

    let meeting = sqlx::query_as::<_, MeetingModel>(
        "SELECT * FROM meetings WHERE id = 'legacy-stable-id'",
    )
    .fetch_one(&pool)
    .await
    .expect("typed legacy meeting projection");
    let projection = serde_json::to_value(meeting).expect("serializable projection");

    assert_eq!(projection["lifecycle"], Value::String("legacy".into()));
    assert_eq!(
        projection["completeness"],
        Value::String("completion_not_verified".into())
    );
    assert_eq!(
        projection["completeness_reason"],
        Value::String("legacy_pre_phase1".into())
    );
}

#[test]
fn meeting_identity_migration_build_tracks_migration_directory() {
    let build_script = include_str!("../build.rs");

    assert!(
        build_script.contains("cargo:rerun-if-changed=migrations"),
        "migration changes must invalidate the embedded SQLx migration artifact"
    );
}
