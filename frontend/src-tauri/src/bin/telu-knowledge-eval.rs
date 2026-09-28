use app_lib::knowledge::evaluation::replay::{export_from_db, review_outcomes, run_replay, ReplayError};
use app_lib::knowledge::evaluation::{score, GoldFixture, LabelSet, PredictionSet, ReportEnvelope, ScoreInput, Thresholds};
use chrono::Utc;
use clap::{Parser, Subcommand};
use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command as Process;

const MAX_INPUT_BYTES: u64 = 32 * 1024 * 1024;

#[derive(Debug, Parser)]
#[command(name = "telu-knowledge-eval")]
#[command(about = "Offline, content-free evaluation of Telu knowledge extraction")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    Score {
        #[arg(long)]
        gold_dir: PathBuf,
        #[arg(long)]
        predictions: PathBuf,
        #[arg(long)]
        labels: PathBuf,
        #[arg(long)]
        thresholds: PathBuf,
        #[arg(long)]
        out: PathBuf,
        #[arg(long)]
        db: Option<PathBuf>,
        #[arg(long)]
        commit: Option<String>,
    },
    Run {
        #[arg(long)]
        gold_dir: PathBuf,
        #[arg(long)]
        replay_completions: PathBuf,
        #[arg(long)]
        out: PathBuf,
    },
    Export {
        #[arg(long)]
        db: PathBuf,
        #[arg(long = "meeting", required = true)]
        meetings: Vec<String>,
        #[arg(long)]
        out: PathBuf,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum EvalError {
    InputNotFound,
    InputUnsafe,
    InputTooLarge,
    JsonMalformed,
    OutputFailed,
    ThresholdsInvalid,
    Replay(ReplayError),
}

impl EvalError {
    fn code(self) -> &'static str {
        match self {
            Self::InputNotFound => "INPUT_NOT_FOUND",
            Self::InputUnsafe => "INPUT_UNSAFE",
            Self::InputTooLarge => "INPUT_TOO_LARGE",
            Self::JsonMalformed => "JSON_MALFORMED",
            Self::OutputFailed => "OUTPUT_FAILED",
            Self::ThresholdsInvalid => "THRESHOLDS_INVALID",
            Self::Replay(error) => error.code(),
        }
    }
}

fn main() {
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("tokio runtime");
    if let Err(error) = runtime.block_on(execute(Cli::parse().command)) {
        eprintln!("{}", json!({ "error": error.code() }));
        std::process::exit(1);
    }
}

async fn execute(command: Command) -> Result<(), EvalError> {
    match command {
        Command::Score { gold_dir, predictions, labels, thresholds, out, db, commit } => {
            score_command(&gold_dir, &predictions, &labels, &thresholds, &out, db.as_deref(), commit).await
        }
        Command::Run { gold_dir, replay_completions, out } => run_command(&gold_dir, &replay_completions, &out).await,
        Command::Export { db, meetings, out } => export_command(&db, &meetings, &out).await,
    }
}

async fn score_command(
    gold_dir: &Path,
    predictions: &Path,
    labels: &Path,
    thresholds: &Path,
    out: &Path,
    db: Option<&Path>,
    commit: Option<String>,
) -> Result<(), EvalError> {
    let fixtures = load_fixtures(gold_dir)?;
    let predictions: PredictionSet = read_json(predictions)?;
    let labels: LabelSet = read_json(labels)?;
    let threshold_bytes = read_bounded(thresholds)?;
    let limits = parse_thresholds(&threshold_bytes)?;
    let review = match db {
        Some(path) => Some(review_outcomes(&safe_input(path)?).await.map_err(EvalError::Replay)?),
        None => None,
    };
    let envelope = ReportEnvelope {
        generated_at_utc: Utc::now().to_rfc3339(),
        thresholds_sha256: format!("{:x}", Sha256::digest(&threshold_bytes)),
        git_commit: commit.unwrap_or_else(git_commit),
        review_outcomes: review,
    };
    let report = score(
        &ScoreInput { fixtures: &fixtures, predictions: &predictions, labels: &labels, thresholds: &limits },
        envelope,
    );
    write_json(out, "report.json", &report)?;
    print_summary(json!({ "fixtures": fixtures.len(), "gate": report.gate, "failures": report.failures.len() }));
    Ok(())
}

async fn run_command(gold_dir: &Path, replay_completions: &Path, out: &Path) -> Result<(), EvalError> {
    let fixtures = load_fixtures(gold_dir)?;
    let completions: HashMap<String, Vec<String>> = read_json(replay_completions)?;
    let predictions = run_replay(&fixtures, &completions).await.map_err(EvalError::Replay)?;
    write_json(out, "predictions.json", &predictions)?;
    print_summary(json!({
        "fixtures": predictions.fixtures.len(),
        "items": predictions.fixtures.iter().map(|fixture| fixture.items.len()).sum::<usize>(),
        "resurrection": predictions.resurrection_count,
    }));
    Ok(())
}

async fn export_command(db: &Path, meetings: &[String], out: &Path) -> Result<(), EvalError> {
    let (fixtures, predictions) = export_from_db(&safe_input(db)?, meetings)
        .await
        .map_err(EvalError::Replay)?;
    for fixture in &fixtures {
        write_json(&out.join("fixtures"), &format!("{}.json", fixture.fixture_id), fixture)?;
    }
    write_json(out, "predictions.json", &predictions)?;
    print_summary(json!({ "meetings": fixtures.len() }));
    Ok(())
}

fn parse_thresholds(bytes: &[u8]) -> Result<Thresholds, EvalError> {
    let thresholds: Thresholds = serde_json::from_slice(bytes).map_err(|_| EvalError::ThresholdsInvalid)?;
    thresholds.validate().map_err(|_| EvalError::ThresholdsInvalid)?;
    Ok(thresholds)
}

fn load_fixtures(gold_dir: &Path) -> Result<Vec<GoldFixture>, EvalError> {
    let directory = gold_dir.canonicalize().map_err(|_| EvalError::InputNotFound)?;
    let mut paths: Vec<PathBuf> = fs::read_dir(&directory)
        .map_err(|_| EvalError::InputNotFound)?
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|path| path.extension().is_some_and(|extension| extension == "json"))
        .collect();
    paths.sort();
    let mut fixtures = Vec::new();
    for path in paths {
        let value: Value = read_json(&path)?;
        if value.get("fixtureId").is_some() {
            fixtures.push(serde_json::from_value(value).map_err(|_| EvalError::JsonMalformed)?);
        }
    }
    Ok(fixtures)
}

fn safe_input(path: &Path) -> Result<PathBuf, EvalError> {
    let metadata = fs::symlink_metadata(path).map_err(|_| EvalError::InputNotFound)?;
    if !metadata.file_type().is_file() {
        return Err(EvalError::InputUnsafe);
    }
    if metadata.len() > MAX_INPUT_BYTES {
        return Err(EvalError::InputTooLarge);
    }
    path.canonicalize().map_err(|_| EvalError::InputNotFound)
}

fn read_bounded(path: &Path) -> Result<Vec<u8>, EvalError> {
    let canonical = safe_input(path)?;
    let bytes = fs::read(canonical).map_err(|_| EvalError::InputNotFound)?;
    if bytes.is_empty() {
        return Err(EvalError::JsonMalformed);
    }
    Ok(bytes)
}

fn read_json<T: DeserializeOwned>(path: &Path) -> Result<T, EvalError> {
    serde_json::from_slice(&read_bounded(path)?).map_err(|_| EvalError::JsonMalformed)
}

fn write_json<T: Serialize>(directory: &Path, name: &str, value: &T) -> Result<(), EvalError> {
    fs::create_dir_all(directory).map_err(|_| EvalError::OutputFailed)?;
    let body = serde_json::to_vec_pretty(value).map_err(|_| EvalError::OutputFailed)?;
    let target = directory.join(name);
    let staging = directory.join(format!(".{name}.tmp"));
    fs::write(&staging, body).map_err(|_| EvalError::OutputFailed)?;
    fs::rename(&staging, &target).map_err(|_| EvalError::OutputFailed)
}

fn git_commit() -> String {
    Process::new("git")
        .args(["rev-parse", "HEAD"])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|commit| commit.trim().to_string())
        .filter(|commit| !commit.is_empty())
        .unwrap_or_else(|| "unknown".to_string())
}

fn print_summary(summary: Value) {
    println!("{summary}");
}
