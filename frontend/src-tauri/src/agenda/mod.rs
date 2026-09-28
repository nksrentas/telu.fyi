pub mod commands;

use crate::database::models::{MeetingCompleteness, MeetingLifecycle};
use crate::knowledge::models::RunStatus;
use chrono::{DateTime, Duration, NaiveDateTime, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use tracing::warn;

const MAX_RANGE_HOURS: i64 = 48;
const NAIVE_FORMATS: [&str; 3] = ["%Y-%m-%d %H:%M:%S%.f", "%Y-%m-%dT%H:%M:%S%.f", "%Y-%m-%d %H:%M:%S"];
const OFFSET_FORMATS: [&str; 2] = ["%Y-%m-%d %H:%M:%S%.f%:z", "%Y-%m-%d %H:%M:%S%.f%#z"];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgendaCardState {
    Recording,
    Finalizing,
    Extracting,
    ToReview,
    Incomplete,
    Reviewed,
    NoKnowledge,
    TranscriptOnly,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgendaMeeting {
    pub id: String,
    pub title: String,
    pub started_at_utc: String,
    pub ended_at_utc: Option<String>,
    pub lifecycle: MeetingLifecycle,
    pub completeness: MeetingCompleteness,
    pub gap_count: i64,
    pub evidence_count: i64,
    pub legacy_transcript_count: i64,
    pub pending_count: i64,
    pub accepted_count: i64,
    pub rejected_count: i64,
    pub latest_run_status: Option<RunStatus>,
    pub card_state: AgendaCardState,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgendaCounts {
    pub day_count: i64,
    pub pending_total: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AgendaError {
    InvalidRange,
    Storage,
}

impl AgendaError {
    pub const fn code(self) -> &'static str {
        match self {
            Self::InvalidRange => "AGENDA_INVALID_RANGE",
            Self::Storage => "AGENDA_STORAGE_FAILED",
        }
    }
}

#[derive(FromRow)]
struct AgendaRow {
    id: String,
    title: String,
    created_at: String,
    started_at_utc: Option<String>,
    lifecycle: MeetingLifecycle,
    completeness: MeetingCompleteness,
    gap_count: i64,
    evidence_count: i64,
    legacy_transcript_count: i64,
    pending_count: i64,
    accepted_count: i64,
    rejected_count: i64,
    latest_run_status: Option<RunStatus>,
    finalized_at_utc: Option<String>,
    max_audio_end: Option<f64>,
}

pub fn derive_card_state(
    lifecycle: MeetingLifecycle,
    completeness: MeetingCompleteness,
    latest_run_status: Option<RunStatus>,
    pending_count: i64,
    evidence_count: i64,
) -> AgendaCardState {
    match lifecycle {
        MeetingLifecycle::Preparing | MeetingLifecycle::Recording => return AgendaCardState::Recording,
        MeetingLifecycle::Finalizing => return AgendaCardState::Finalizing,
        _ => {}
    }
    if latest_run_status == Some(RunStatus::Running) {
        return AgendaCardState::Extracting;
    }
    if pending_count > 0 {
        return AgendaCardState::ToReview;
    }
    if matches!(completeness, MeetingCompleteness::Incomplete | MeetingCompleteness::RecoveredWithGaps) {
        return AgendaCardState::Incomplete;
    }
    if latest_run_status == Some(RunStatus::Succeeded) {
        return AgendaCardState::Reviewed;
    }
    if evidence_count > 0 {
        AgendaCardState::NoKnowledge
    } else {
        AgendaCardState::TranscriptOnly
    }
}

pub fn parse_range(from_utc: &str, to_utc: &str) -> Result<(DateTime<Utc>, DateTime<Utc>), AgendaError> {
    let parse = |value: &str| {
        DateTime::parse_from_rfc3339(value)
            .map(|parsed| parsed.with_timezone(&Utc))
            .map_err(|_| AgendaError::InvalidRange)
    };
    let (from, to) = (parse(from_utc)?, parse(to_utc)?);
    if from >= to || to - from > Duration::hours(MAX_RANGE_HOURS) {
        return Err(AgendaError::InvalidRange);
    }
    Ok((from, to))
}

pub async fn list_day(
    pool: &SqlitePool,
    from: DateTime<Utc>,
    to: DateTime<Utc>,
) -> Result<Vec<AgendaMeeting>, AgendaError> {
    let mut meetings: Vec<(DateTime<Utc>, AgendaMeeting)> = load_meetings(pool)
        .await?
        .into_iter()
        .filter(|(start, _)| *start >= from && *start < to)
        .collect();
    meetings.sort_by(|left, right| left.0.cmp(&right.0).then_with(|| left.1.id.cmp(&right.1.id)));
    Ok(meetings.into_iter().map(|(_, meeting)| meeting).collect())
}

pub async fn list_review(pool: &SqlitePool) -> Result<Vec<AgendaMeeting>, AgendaError> {
    let mut meetings: Vec<(DateTime<Utc>, AgendaMeeting)> = load_meetings(pool)
        .await?
        .into_iter()
        .filter(|(_, meeting)| meeting.pending_count > 0)
        .collect();
    meetings.sort_by(|left, right| right.0.cmp(&left.0).then_with(|| left.1.id.cmp(&right.1.id)));
    Ok(meetings.into_iter().map(|(_, meeting)| meeting).collect())
}

pub async fn counts(
    pool: &SqlitePool,
    from: DateTime<Utc>,
    to: DateTime<Utc>,
) -> Result<AgendaCounts, AgendaError> {
    let meetings = load_meetings(pool).await?;
    Ok(AgendaCounts {
        day_count: meetings.iter().filter(|(start, _)| *start >= from && *start < to).count() as i64,
        pending_total: meetings.iter().map(|(_, meeting)| meeting.pending_count).sum(),
    })
}

async fn load_meetings(pool: &SqlitePool) -> Result<Vec<(DateTime<Utc>, AgendaMeeting)>, AgendaError> {
    let rows = sqlx::query_as::<_, AgendaRow>(
        "SELECT m.id, m.title, CAST(m.created_at AS TEXT) AS created_at, m.started_at_utc,
                m.lifecycle, m.completeness,
                (SELECT COUNT(*) FROM meeting_finalization_gaps g WHERE g.meeting_id = m.id) AS gap_count,
                (SELECT COUNT(*) FROM transcript_evidence e WHERE e.meeting_id = m.id) AS evidence_count,
                (SELECT COUNT(*) FROM transcripts t WHERE t.meeting_id = m.id) AS legacy_transcript_count,
                (SELECT COUNT(*) FROM knowledge_item_current c
                  WHERE c.meeting_id = m.id AND c.review_state = 'proposed') AS pending_count,
                (SELECT COUNT(*) FROM knowledge_item_current c
                  WHERE c.meeting_id = m.id AND c.review_state = 'accepted') AS accepted_count,
                (SELECT COUNT(*) FROM knowledge_item_current c
                  WHERE c.meeting_id = m.id AND c.review_state = 'rejected') AS rejected_count,
                (SELECT r.status FROM knowledge_runs r WHERE r.meeting_id = m.id
                  ORDER BY r.started_at_utc DESC, r.rowid DESC LIMIT 1) AS latest_run_status,
                (SELECT f.finalized_at_utc FROM meeting_finalizations f WHERE f.meeting_id = m.id) AS finalized_at_utc,
                (SELECT MAX(e.audio_end_time) FROM transcript_evidence e WHERE e.meeting_id = m.id) AS max_audio_end
         FROM meetings m",
    )
    .fetch_all(pool)
    .await
    .map_err(|error| {
        warn!(error = %error, "agenda meetings could not be loaded");
        AgendaError::Storage
    })?;
    Ok(rows.into_iter().filter_map(agenda_meeting).collect())
}

fn agenda_meeting(row: AgendaRow) -> Option<(DateTime<Utc>, AgendaMeeting)> {
    let raw_start = row.started_at_utc.as_deref().unwrap_or(&row.created_at);
    let Some(start) = parse_timestamp(raw_start) else {
        warn!(meeting_id = %row.id, "agenda skipped a meeting with an unreadable start time");
        return None;
    };
    let ended_at_utc = row.finalized_at_utc.clone().or_else(|| {
        row.max_audio_end
            .map(|seconds| format_utc(start + Duration::milliseconds((seconds * 1000.0) as i64)))
    });
    let card_state = derive_card_state(
        row.lifecycle,
        row.completeness,
        row.latest_run_status,
        row.pending_count,
        row.evidence_count,
    );
    Some((
        start,
        AgendaMeeting {
            id: row.id,
            title: row.title,
            started_at_utc: format_utc(start),
            ended_at_utc,
            lifecycle: row.lifecycle,
            completeness: row.completeness,
            gap_count: row.gap_count,
            evidence_count: row.evidence_count,
            legacy_transcript_count: row.legacy_transcript_count,
            pending_count: row.pending_count,
            accepted_count: row.accepted_count,
            rejected_count: row.rejected_count,
            latest_run_status: row.latest_run_status,
            card_state,
        },
    ))
}

fn parse_timestamp(value: &str) -> Option<DateTime<Utc>> {
    let value = value.trim();
    if let Ok(parsed) = DateTime::parse_from_rfc3339(value) {
        return Some(parsed.with_timezone(&Utc));
    }
    OFFSET_FORMATS
        .iter()
        .find_map(|format| DateTime::parse_from_str(value, format).ok())
        .map(|parsed| parsed.with_timezone(&Utc))
        .or_else(|| {
            NAIVE_FORMATS
                .iter()
                .find_map(|format| NaiveDateTime::parse_from_str(value, format).ok())
                .map(|naive| naive.and_utc())
        })
}

fn format_utc(value: DateTime<Utc>) -> String {
    value.to_rfc3339_opts(SecondsFormat::Millis, true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::knowledge::models::ReviewAction;
    use crate::knowledge::review::append_review;
    use crate::knowledge::test_support::{migrated_pool, seed_items};

    async fn insert_raw_meeting(pool: &SqlitePool, id: &str, created_at: &str, started_at: Option<&str>, lifecycle: &str) {
        sqlx::query(
            "INSERT INTO meetings (
                id, title, created_at, updated_at, lifecycle, completeness, completeness_reason, started_at_utc
             ) VALUES (?, ?, ?, ?, ?, 'complete', NULL, ?)",
        )
        .bind(id)
        .bind(format!("Meeting {id}"))
        .bind(created_at)
        .bind(created_at)
        .bind(lifecycle)
        .bind(started_at)
        .execute(pool)
        .await
        .expect("raw meeting");
    }

    fn range(from: &str, to: &str) -> (DateTime<Utc>, DateTime<Utc>) {
        parse_range(from, to).expect("valid range")
    }

    #[test]
    fn derive_card_state_follows_the_precedence_table() {
        use AgendaCardState as S;
        use MeetingCompleteness as C;
        use MeetingLifecycle as L;

        assert_eq!(derive_card_state(L::Recording, C::Pending, None, 0, 0), S::Recording);
        assert_eq!(derive_card_state(L::Finalizing, C::Pending, None, 0, 3), S::Finalizing);
        assert_eq!(derive_card_state(L::Complete, C::Complete, Some(RunStatus::Running), 2, 3), S::Extracting);
        assert_eq!(derive_card_state(L::Incomplete, C::Incomplete, Some(RunStatus::Succeeded), 2, 3), S::ToReview);
        assert_eq!(derive_card_state(L::Incomplete, C::Incomplete, Some(RunStatus::Succeeded), 0, 3), S::Incomplete);
        assert_eq!(derive_card_state(L::Complete, C::Complete, Some(RunStatus::Succeeded), 0, 3), S::Reviewed);
        assert_eq!(derive_card_state(L::Complete, C::Complete, Some(RunStatus::Failed), 0, 3), S::NoKnowledge);
        assert_eq!(derive_card_state(L::Legacy, C::CompletionNotVerified, None, 0, 0), S::TranscriptOnly);
    }

    #[tokio::test]
    async fn agenda_list_day_returns_meetings_in_range_with_review_counts() {
        let pool = migrated_pool().await;
        let reviewed = "018f5e27-2f68-7e27-9c90-7c7212314901";
        let items = seed_items(&pool, reviewed, &["Ship the beta", "Write notes", "Drop launch"]).await;
        sqlx::query("UPDATE meetings SET started_at_utc = '2026-09-27T09:00:00Z' WHERE id = ?")
            .bind(reviewed)
            .execute(&pool)
            .await
            .expect("start time");
        append_review(&pool, reviewed, &items[0], ReviewAction::Accept).await.expect("accept");
        append_review(&pool, reviewed, &items[1], ReviewAction::Reject).await.expect("reject");
        insert_raw_meeting(&pool, "018f5e27-2f68-7e27-9c90-7c7212314902", "2026-09-27T08:00:00Z", Some("2026-09-27T08:00:00Z"), "complete").await;
        insert_raw_meeting(&pool, "018f5e27-2f68-7e27-9c90-7c7212314903", "2026-09-28T08:00:00Z", Some("2026-09-28T08:00:00Z"), "complete").await;
        let (from, to) = range("2026-09-27T00:00:00Z", "2026-09-28T00:00:00Z");

        let meetings = list_day(&pool, from, to).await.expect("day meetings");

        assert_eq!(
            meetings.iter().map(|meeting| meeting.id.as_str()).collect::<Vec<_>>(),
            vec!["018f5e27-2f68-7e27-9c90-7c7212314902", reviewed]
        );
        let seeded = &meetings[1];
        assert_eq!((seeded.pending_count, seeded.accepted_count, seeded.rejected_count), (1, 1, 1));
        assert_eq!(seeded.card_state, AgendaCardState::ToReview);
        assert_eq!(seeded.evidence_count, 1);
        assert_eq!(seeded.ended_at_utc.as_deref(), Some("2026-09-27T09:00:04.000Z"));
    }

    #[tokio::test]
    async fn agenda_parses_legacy_created_at_formats_and_skips_unreadable_ones() {
        let pool = migrated_pool().await;
        insert_raw_meeting(&pool, "legacy-rfc", "2026-09-27T10:00:00Z", None, "legacy").await;
        insert_raw_meeting(&pool, "legacy-naive", "2026-09-27 11:00:00", None, "legacy").await;
        insert_raw_meeting(&pool, "legacy-broken", "not a date", None, "legacy").await;
        let (from, to) = range("2026-09-27T00:00:00Z", "2026-09-28T00:00:00Z");

        let meetings = list_day(&pool, from, to).await.expect("day meetings");

        assert_eq!(
            meetings.iter().map(|meeting| meeting.id.as_str()).collect::<Vec<_>>(),
            vec!["legacy-rfc", "legacy-naive"]
        );
        assert!(meetings.iter().all(|meeting| meeting.card_state == AgendaCardState::TranscriptOnly));
    }

    #[test]
    fn parse_range_rejects_long_reversed_or_invalid_ranges() {
        assert_eq!(parse_range("2026-09-27T00:00:00Z", "2026-09-29T00:00:01Z"), Err(AgendaError::InvalidRange));
        assert_eq!(parse_range("2026-09-28T00:00:00Z", "2026-09-27T00:00:00Z"), Err(AgendaError::InvalidRange));
        assert_eq!(parse_range("yesterday", "2026-09-27T00:00:00Z"), Err(AgendaError::InvalidRange));
        assert!(parse_range("2026-09-27T00:00:00+03:00", "2026-09-28T00:00:00+03:00").is_ok());
    }

    #[tokio::test]
    async fn agenda_review_list_and_counts_use_pending_items() {
        let pool = migrated_pool().await;
        let pending = "018f5e27-2f68-7e27-9c90-7c7212314911";
        let settled = "018f5e27-2f68-7e27-9c90-7c7212314912";
        seed_items(&pool, pending, &["Ship the beta", "Write notes"]).await;
        let settled_items = seed_items(&pool, settled, &["Drop launch"]).await;
        append_review(&pool, settled, &settled_items[0], ReviewAction::Accept).await.expect("accept");
        let now = Utc::now();

        let review = list_review(&pool).await.expect("review meetings");
        let totals = counts(&pool, now - Duration::hours(12), now + Duration::hours(12))
            .await
            .expect("counts");

        assert_eq!(review.iter().map(|meeting| meeting.id.as_str()).collect::<Vec<_>>(), vec![pending]);
        assert_eq!(totals, AgendaCounts { day_count: 2, pending_total: 2 });
    }
}
