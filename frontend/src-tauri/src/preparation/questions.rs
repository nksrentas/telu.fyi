use crate::preparation::briefing::{
    claim_from_row, storage, verify, BriefingError, Claim, ClaimRow, DroppedStatement,
};
use crate::preparation::context::ContextPiece;
use serde::Serialize;
use serde_json::Value;
use sqlx::SqlitePool;
use std::collections::HashMap;

const MAX_QUESTIONS: usize = 5;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Question {
    pub claim: Claim,
    pub rationale: String,
}

pub(super) fn verify_questions(
    by_ref: &HashMap<&str, &ContextPiece>,
    values: &[Value],
) -> (Vec<Question>, Vec<DroppedStatement>) {
    let mut questions = Vec::new();
    let mut dropped = Vec::new();
    for (index, value) in values.iter().enumerate() {
        match verify_question(by_ref, value) {
            Ok(_) if questions.len() == MAX_QUESTIONS => dropped.push(DroppedStatement {
                index,
                reason: "QUESTION_LIMIT",
            }),
            Ok(question) => questions.push(question),
            Err(reason) => dropped.push(DroppedStatement { index, reason }),
        }
    }
    (questions, dropped)
}

fn verify_question(
    by_ref: &HashMap<&str, &ContextPiece>,
    value: &Value,
) -> Result<Question, &'static str> {
    let rationale = value
        .get("rationale")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|rationale| !rationale.is_empty())
        .ok_or("MALFORMED_QUESTION")?;
    let claim = verify(by_ref, value, "MALFORMED_QUESTION")?;
    Ok(Question {
        claim,
        rationale: rationale.to_string(),
    })
}

pub async fn load_questions(
    pool: &SqlitePool,
    briefing_id: &str,
) -> Result<Vec<Question>, BriefingError> {
    sqlx::query_as::<_, ClaimRow>(
        "SELECT text, source_ref, document_version_id, passage_id, knowledge_meeting_id,
                knowledge_item_id, knowledge_revision_id, locator_json, quote, status, rationale
         FROM briefing_claims WHERE briefing_id = ? AND kind = 'question' ORDER BY ordinal",
    )
    .bind(briefing_id)
    .fetch_all(pool)
    .await
    .map_err(storage)?
    .into_iter()
    .map(|mut row| {
        let rationale = row.rationale.take().ok_or(BriefingError::Storage)?;
        Ok(Question {
            claim: claim_from_row(row)?,
            rationale,
        })
    })
    .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::documents::ingest::ingest_text;
    use crate::knowledge::test_support::migrated_pool;
    use crate::planning::models::PlannedMeetingInput;
    use crate::planning::repository as planning;
    use crate::preparation::briefing::{load_claims, run};
    use crate::preparation::context::{build, Budget, PackedContext};
    use crate::preparation::models::SelectedSource;
    use chrono::{DateTime, Utc};
    use serde_json::json;

    fn now() -> DateTime<Utc> {
        DateTime::parse_from_rfc3339("2026-10-25T08:00:00Z")
            .expect("test timestamp")
            .with_timezone(&Utc)
    }

    async fn context_with(
        pool: &SqlitePool,
        text: &str,
    ) -> (String, SelectedSource, PackedContext) {
        let input = PlannedMeetingInput {
            title: "Weekly sync".to_string(),
            start_utc: None,
            purpose: String::new(),
        };
        let plan = planning::create(pool, input, now())
            .await
            .expect("planned meeting")
            .id;
        let version = ingest_text(pool, "Roadmap", text, now())
            .await
            .expect("document");
        let source = SelectedSource::Document {
            version_id: version.id,
        };
        crate::preparation::selection::select(pool, &plan, vec![source.clone()])
            .await
            .expect("selection");
        let app_data = tempfile::tempdir().expect("app data");
        let budget = Budget {
            per_source_tokens: 1_000,
            total_tokens: 1_000,
        };
        let context = build(pool, app_data.path(), &[source.clone()], budget)
            .await
            .expect("context");
        (plan, source, context)
    }

    fn source_ref(context: &PackedContext) -> String {
        match &context.pieces[0] {
            ContextPiece::Passage { ordinal, .. } => format!("S1#{ordinal}"),
            ContextPiece::Knowledge { .. } => panic!("expected a passage"),
        }
    }

    fn staged(
        reply: String,
    ) -> impl FnMut(String, String) -> std::future::Ready<Result<String, String>> {
        move |_, _| std::future::ready(Ok(reply.clone()))
    }

    fn question(number: usize, source: &str, quote: &str) -> Value {
        json!({
            "text": format!("Question {number}?"),
            "rationale": format!("Rationale {number}."),
            "source": source,
            "quote": quote,
        })
    }

    #[tokio::test]
    async fn at_most_five_verified_questions_are_kept() {
        let pool = migrated_pool().await;
        let (plan, _, context) = context_with(&pool, "Alpha ships in May.").await;
        let cited = source_ref(&context);
        let questions: Vec<Value> = (1..=6)
            .map(|number| question(number, &cited, "Alpha ships"))
            .collect();
        let reply = json!({"statements": [], "questions": questions}).to_string();

        let outcome = run(&pool, &plan, &context, now(), staged(reply))
            .await
            .expect("briefing");

        let texts: Vec<&str> = outcome
            .questions
            .iter()
            .map(|question| question.claim.text.as_str())
            .collect();
        assert_eq!(
            texts,
            [
                "Question 1?",
                "Question 2?",
                "Question 3?",
                "Question 4?",
                "Question 5?"
            ]
        );
        assert_eq!(
            outcome.dropped_questions,
            vec![DroppedStatement {
                index: 5,
                reason: "QUESTION_LIMIT"
            }]
        );
    }

    #[tokio::test]
    async fn unverifiable_questions_are_dropped_and_counted() {
        let pool = migrated_pool().await;
        let (plan, _, context) = context_with(&pool, "Alpha ships in May.").await;
        let cited = source_ref(&context);
        let reply = json!({
            "statements": [],
            "questions": [
                question(1, &cited, "Alpha ships in June"),
                question(2, "S9#1", "Alpha ships"),
                {"text": "No rationale?", "source": cited, "quote": "Alpha ships"},
                question(4, &cited, "ships in May"),
            ]
        })
        .to_string();

        let outcome = run(&pool, &plan, &context, now(), staged(reply))
            .await
            .expect("briefing");

        assert_eq!(
            outcome.dropped_questions,
            vec![
                DroppedStatement {
                    index: 0,
                    reason: "QUOTE_NOT_FOUND"
                },
                DroppedStatement {
                    index: 1,
                    reason: "SOURCE_NOT_INCLUDED"
                },
                DroppedStatement {
                    index: 2,
                    reason: "MALFORMED_QUESTION"
                },
            ]
        );
        assert_eq!(outcome.questions.len(), 1);
        assert_eq!(outcome.questions[0].claim.text, "Question 4?");
        let (dropped_count, dropped_questions): (i64, i64) = sqlx::query_as(
            "SELECT dropped_count, dropped_question_count FROM briefings WHERE id = ?",
        )
        .bind(&outcome.briefing_id)
        .fetch_one(&pool)
        .await
        .expect("briefing row");
        assert_eq!((dropped_count, dropped_questions), (0, 3));
    }

    #[tokio::test]
    async fn kept_questions_load_back_with_their_refs() {
        let pool = migrated_pool().await;
        let (plan, source, context) = context_with(&pool, "Alpha ships in May.").await;
        let cited = source_ref(&context);
        let reply = json!({
            "statements": [
                {"text": "Alpha ships in May.", "source": cited, "quote": "ships in May"}
            ],
            "questions": [question(1, &cited, "Alpha"), question(2, &cited, "in May")]
        })
        .to_string();

        let outcome = run(&pool, &plan, &context, now(), staged(reply))
            .await
            .expect("briefing");

        let stored = load_questions(&pool, &outcome.briefing_id)
            .await
            .expect("questions");
        assert_eq!(stored, outcome.questions);
        assert_eq!(stored.len(), 2);
        assert_eq!(stored[1].claim.text, "Question 2?");
        assert_eq!(stored[1].rationale, "Rationale 2.");
        assert_eq!(stored[1].claim.source_ref, cited);
        assert_eq!(stored[1].claim.source, source);
        assert_eq!(stored[1].claim.quote, "in May");
        assert!(stored[1].claim.passage_id.is_some());
        assert!(stored[1].claim.locator_json.is_some());
        let claims = load_claims(&pool, &outcome.briefing_id)
            .await
            .expect("claims");
        assert_eq!(claims.len(), 1);
        assert_eq!(claims[0].text, "Alpha ships in May.");
    }

    #[tokio::test]
    async fn questions_that_are_not_a_list_fail_the_run() {
        let pool = migrated_pool().await;
        let (plan, _, context) = context_with(&pool, "Alpha ships in May.").await;
        let reply = json!({"statements": [], "questions": "none"}).to_string();

        let result = run(&pool, &plan, &context, now(), staged(reply)).await;

        assert_eq!(result, Err(BriefingError::ParseFailed));
    }
}
