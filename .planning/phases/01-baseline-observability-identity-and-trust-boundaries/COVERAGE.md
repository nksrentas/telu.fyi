# Phase 1 Capability Coverage

## No external API integration

Phase 1 adds no external API capability surface. It does not introduce HTTP endpoints, OAuth, webhooks, third-party SDKs, a hosted service, the archived FastAPI backend, or Meetily Pro Agent API internals.

The phase instruments and discloses the Community Edition application's existing configured processing routes. New internal operations remain Tauri commands/events, and existing provider calls remain behind their current Rust clients. The effective route contract is promoted to:

`capability + Local/LAN/Remote boundary + sanitized destination + provider/model detail`

Provider brand is descriptive detail, not the authority for locality. Any unavailable or materially changed destination blocks the data-bearing operation and preserves the user's selected route; it does not create or select another provider.

## Existing route families covered

- Local native transcription engines and the existing local sidecar.
- Loopback or configured LAN endpoints such as Ollama/custom compatible routes.
- Existing hosted summary/model providers already supported by Community Edition.
- Background updater, analytics, and model-download attempts relevant to the network-blocked local canary.

This file is a negative capability declaration, not an endpoint inventory.
