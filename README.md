# Telu

Telu is a local-first, context-aware desktop companion for recurring conversations. It helps you prepare for a meeting, surfaces a small number of timely and evidence-backed facts or questions while the conversation is still actionable, and carries reliable decisions, commitments, open questions, and verified facts into the next meeting.

The product is designed to stay quiet when an intervention would add more distraction than value.

## Product principles

- **Local by default:** capture, transcription, persistence, and memory stay on the device unless you explicitly select a remote provider or destination.
- **Evidence-backed:** extracted knowledge and live suggestions retain source attribution for inspection.
- **Context at the right moment:** preparation, live assistance, and follow-through share one consistent meeting identity and chronology.
- **Deliberate silence:** Telu favors a few high-confidence interventions over frequent or weak suggestions.

## Architecture

Telu is a substantial product fork of [Meetily Community Edition](https://github.com/Zackriya-Solutions/meetily). It preserves Meetily's native capture, transcription, persistence, desktop, and model-provider foundations while extending the active Tauri/Rust core and Next.js/React interface with structured knowledge, document context, trustworthy live assistance, and meeting-series memory.

The supported application is self-contained:

- Tauri 2 and Rust for native lifecycle, audio, transcription, persistence, and IPC
- Next.js 14 and React 18 for the desktop interface
- SQLite through SQLx for local canonical storage
- local Whisper and ONNX model paths, with explicitly configured remote providers where selected

The archived Python/FastAPI backend is not a supported runtime dependency.

## Development

Prerequisites:

- Rust 1.77 or newer within the repository's declared compatibility policy
- Node.js and pnpm
- platform-specific native build prerequisites for Tauri and audio/model libraries

Start the desktop app:

```bash
cd frontend
pnpm install
pnpm tauri:dev
```

Build a packaged app:

```bash
cd frontend
pnpm tauri:build
```

See [docs/BUILDING.md](docs/BUILDING.md) for platform details and [docs/telu/README.md](docs/telu/README.md) for current product and validation documentation.

## Privacy

Meeting content is sensitive. Telu keeps storage local by default and treats every remote provider, export, and destination as an explicit trust boundary. See [PRIVACY_POLICY.md](PRIVACY_POLICY.md).

## Upstream attribution

Telu is based on the open-source Meetily Community Edition project by Zackriya Solutions. Upstream compatibility references, legacy import paths, and update/model infrastructure may retain the Meetily name where changing them would break existing installations or external integrations.

## License

This project retains the upstream MIT license. See [LICENSE](LICENSE).
