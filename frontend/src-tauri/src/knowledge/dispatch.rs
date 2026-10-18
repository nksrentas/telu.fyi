use crate::knowledge::prompt::window_budget;
use crate::summary::llm_client::generate_summary;
use crate::summary::service::{summary_context_tokens, SummaryDispatch};
use std::future::Future;
use std::path::PathBuf;
use std::pin::Pin;
use std::sync::Arc;
use tokio_util::sync::CancellationToken;

pub(crate) type Completion = Pin<Box<dyn Future<Output = Result<String, String>> + Send>>;

pub(crate) fn dispatch_completer(
    dispatch: Arc<SummaryDispatch>,
    meeting_id: String,
    app_data_dir: Option<PathBuf>,
    token: CancellationToken,
) -> impl FnMut(String, String) -> Completion {
    let client = reqwest::Client::new();
    move |system_prompt: String, user_prompt: String| {
        let client = client.clone();
        let dispatch = Arc::clone(&dispatch);
        let meeting_id = meeting_id.clone();
        let app_data_dir = app_data_dir.clone();
        let token = token.clone();
        Box::pin(async move {
            generate_summary(
                &client,
                Some(meeting_id.as_str()),
                &dispatch.provider,
                &dispatch.model_name,
                &dispatch.api_key,
                &system_prompt,
                &user_prompt,
                dispatch.ollama_endpoint.as_deref(),
                dispatch.custom_openai_endpoint.as_deref(),
                dispatch.max_tokens,
                dispatch.temperature,
                dispatch.top_p,
                app_data_dir.as_ref(),
                Some(&token),
            )
            .await
            .map(|completion| completion.content)
        })
    }
}

pub(crate) async fn extraction_budget(dispatch: &SummaryDispatch, meeting_id: &str) -> usize {
    window_budget(summary_context_tokens(dispatch, meeting_id).await)
}
