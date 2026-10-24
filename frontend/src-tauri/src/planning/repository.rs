use crate::planning::models::{PlannedMeeting, PlannedMeetingInput, PlanningError};
use chrono::{DateTime, SecondsFormat, Utc};
use sqlx::SqlitePool;
use tracing::warn;
use uuid::Uuid;

const SELECT_COLUMNS: &str =
    "SELECT id, title, start_utc, purpose, created_utc, updated_utc FROM planned_meetings";

pub async fn create(
    pool: &SqlitePool,
    input: PlannedMeetingInput,
    now: DateTime<Utc>,
) -> Result<PlannedMeeting, PlanningError> {
    let (title, start_utc) = validate(&input)?;
    let now = format_utc(now);
    let meeting = PlannedMeeting {
        id: Uuid::new_v4().to_string(),
        title,
        start_utc,
        purpose: input.purpose,
        created_utc: now.clone(),
        updated_utc: now,
    };
    sqlx::query(
        "INSERT INTO planned_meetings (id, title, start_utc, purpose, created_utc, updated_utc)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&meeting.id)
    .bind(&meeting.title)
    .bind(&meeting.start_utc)
    .bind(&meeting.purpose)
    .bind(&meeting.created_utc)
    .bind(&meeting.updated_utc)
    .execute(pool)
    .await
    .map_err(storage)?;
    Ok(meeting)
}

pub async fn get(pool: &SqlitePool, id: &str) -> Result<PlannedMeeting, PlanningError> {
    sqlx::query_as::<_, PlannedMeeting>(&format!("{SELECT_COLUMNS} WHERE id = ?"))
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(storage)?
        .ok_or(PlanningError::NotFound)
}

pub async fn list_upcoming(
    pool: &SqlitePool,
    today_start: DateTime<Utc>,
) -> Result<Vec<PlannedMeeting>, PlanningError> {
    sqlx::query_as::<_, PlannedMeeting>(&format!(
        "{SELECT_COLUMNS} WHERE start_utc IS NULL OR start_utc >= ? ORDER BY created_utc DESC, id DESC"
    ))
    .bind(format_utc(today_start))
    .fetch_all(pool)
    .await
    .map_err(storage)
}

pub async fn update(
    pool: &SqlitePool,
    id: &str,
    input: PlannedMeetingInput,
    now: DateTime<Utc>,
) -> Result<PlannedMeeting, PlanningError> {
    let (title, start_utc) = validate(&input)?;
    sqlx::query_as::<_, PlannedMeeting>(
        "UPDATE planned_meetings SET title = ?, start_utc = ?, purpose = ?, updated_utc = ? WHERE id = ?
         RETURNING id, title, start_utc, purpose, created_utc, updated_utc",
    )
    .bind(title)
    .bind(start_utc)
    .bind(input.purpose)
    .bind(format_utc(now))
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(storage)?
    .ok_or(PlanningError::NotFound)
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), PlanningError> {
    let removed = sqlx::query("DELETE FROM planned_meetings WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(storage)?;
    if removed.rows_affected() == 0 {
        return Err(PlanningError::NotFound);
    }
    Ok(())
}

/// Returns the trimmed title and the start time normalised to millisecond UTC,
/// so stored start times compare correctly as text.
fn validate(input: &PlannedMeetingInput) -> Result<(String, Option<String>), PlanningError> {
    let title = input.title.trim();
    if title.is_empty() {
        return Err(PlanningError::TitleRequired);
    }
    let start_utc = match input.start_utc.as_deref().map(str::trim) {
        None | Some("") => None,
        Some(value) => {
            let parsed =
                DateTime::parse_from_rfc3339(value).map_err(|_| PlanningError::InvalidStart)?;
            Some(format_utc(parsed.with_timezone(&Utc)))
        }
    };
    Ok((title.to_string(), start_utc))
}

fn format_utc(value: DateTime<Utc>) -> String {
    value.to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn storage(error: sqlx::Error) -> PlanningError {
    warn!(error = %error, "planned meeting storage failed");
    PlanningError::Storage
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::knowledge::test_support::migrated_pool;

    fn at(value: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(value)
            .expect("test timestamp")
            .with_timezone(&Utc)
    }

    fn input(title: &str, start_utc: Option<&str>, purpose: &str) -> PlannedMeetingInput {
        PlannedMeetingInput {
            title: title.to_string(),
            start_utc: start_utc.map(str::to_string),
            purpose: purpose.to_string(),
        }
    }

    #[tokio::test]
    async fn planning_create_then_get_returns_the_same_fields() {
        let pool = migrated_pool().await;
        let now = at("2026-10-24T08:00:00Z");

        let created = create(
            &pool,
            input(
                "  Weekly sync ",
                Some("2026-10-25T11:30:00+03:00"),
                "Agree the launch date",
            ),
            now,
        )
        .await
        .expect("created");
        let loaded = get(&pool, &created.id).await.expect("loaded");

        assert_eq!(loaded, created);
        assert_eq!(loaded.title, "Weekly sync");
        assert_eq!(
            loaded.start_utc.as_deref(),
            Some("2026-10-25T08:30:00.000Z")
        );
        assert_eq!(loaded.purpose, "Agree the launch date");
        assert_eq!(loaded.created_utc, "2026-10-24T08:00:00.000Z");
        assert_eq!(loaded.updated_utc, "2026-10-24T08:00:00.000Z");
        assert!(Uuid::parse_str(&loaded.id).is_ok());
    }

    #[tokio::test]
    async fn planning_list_upcoming_excludes_yesterday_and_includes_undated_newest_first() {
        let pool = migrated_pool().await;
        let today_start = at("2026-10-24T00:00:00Z");
        let yesterday = create(
            &pool,
            input("Yesterday", Some("2026-10-23T15:00:00Z"), ""),
            at("2026-10-20T08:00:00Z"),
        )
        .await
        .expect("yesterday");
        let undated = create(
            &pool,
            input("Undated", None, ""),
            at("2026-10-21T08:00:00Z"),
        )
        .await
        .expect("undated");
        let later_today = create(
            &pool,
            input("Later today", Some("2026-10-24T16:00:00Z"), ""),
            at("2026-10-22T08:00:00Z"),
        )
        .await
        .expect("later today");
        let midnight = create(
            &pool,
            input("Midnight", Some("2026-10-24T00:00:00Z"), ""),
            at("2026-10-19T08:00:00Z"),
        )
        .await
        .expect("midnight");

        let upcoming = list_upcoming(&pool, today_start).await.expect("upcoming");

        let ids: Vec<&str> = upcoming.iter().map(|meeting| meeting.id.as_str()).collect();
        assert_eq!(
            ids,
            vec![
                later_today.id.as_str(),
                undated.id.as_str(),
                midnight.id.as_str()
            ]
        );
        assert!(!ids.contains(&yesterday.id.as_str()));
    }

    #[tokio::test]
    async fn planning_update_changes_title_and_purpose_and_bumps_updated_utc() {
        let pool = migrated_pool().await;
        let created = create(
            &pool,
            input("Draft", None, "Old purpose"),
            at("2026-10-24T08:00:00Z"),
        )
        .await
        .expect("created");

        let updated = update(
            &pool,
            &created.id,
            input("Board review", Some("2026-10-30T09:00:00Z"), "New purpose"),
            at("2026-10-24T09:15:00Z"),
        )
        .await
        .expect("updated");

        assert_eq!(updated, get(&pool, &created.id).await.expect("reloaded"));
        assert_eq!(updated.title, "Board review");
        assert_eq!(updated.purpose, "New purpose");
        assert_eq!(
            updated.start_utc.as_deref(),
            Some("2026-10-30T09:00:00.000Z")
        );
        assert_eq!(updated.created_utc, created.created_utc);
        assert_eq!(updated.updated_utc, "2026-10-24T09:15:00.000Z");
    }

    #[tokio::test]
    async fn planning_delete_removes_the_planned_meeting() {
        let pool = migrated_pool().await;
        let created = create(&pool, input("Retro", None, ""), at("2026-10-24T08:00:00Z"))
            .await
            .expect("created");

        delete(&pool, &created.id).await.expect("deleted");

        assert_eq!(get(&pool, &created.id).await, Err(PlanningError::NotFound));
        assert_eq!(
            delete(&pool, &created.id).await,
            Err(PlanningError::NotFound)
        );
        assert!(list_upcoming(&pool, at("2026-10-24T00:00:00Z"))
            .await
            .expect("upcoming")
            .is_empty());
    }

    #[tokio::test]
    async fn planning_refuses_an_empty_title_and_an_unreadable_start() {
        let pool = migrated_pool().await;
        let now = at("2026-10-24T08:00:00Z");
        let created = create(&pool, input("Kept", None, ""), now)
            .await
            .expect("created");

        assert_eq!(
            create(&pool, input("   ", None, ""), now).await,
            Err(PlanningError::TitleRequired)
        );
        assert_eq!(
            update(&pool, &created.id, input("", None, ""), now).await,
            Err(PlanningError::TitleRequired)
        );
        assert_eq!(
            create(&pool, input("Sync", Some("tomorrow"), ""), now).await,
            Err(PlanningError::InvalidStart)
        );
        assert_eq!(
            update(&pool, "missing", input("Sync", None, ""), now).await,
            Err(PlanningError::NotFound)
        );
        assert_eq!(
            PlanningError::TitleRequired.code(),
            "PLANNED_MEETING_TITLE_REQUIRED"
        );
        assert_eq!(
            get(&pool, &created.id).await.expect("unchanged").title,
            "Kept"
        );
    }
}
