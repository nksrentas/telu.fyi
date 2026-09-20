---
schema_version: 1
open_count: 5
waived_count: 0
fixed_count: 0
total_count: 5
last_updated: 2026-09-20T19:47:25.718Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | lint-warning | frontend/src-tauri |  | Pre-existing repository-wide cargo fmt drift is deferred to a dedicated maintenance change | open |  | 2026-09-20T18:21:47.000Z |  |
| 2 | 01 | deviation | frontend/src-tauri/src/audio/recording_commands.rs |  | Threaded committed StartMeetingResult through command and renderer call sites required by canonical recovery mirrors. | open |  | 2026-09-20T18:57:45.803Z |  |
| 3 | 01 | deviation | frontend/src-tauri/src/database/repositories/meeting.rs |  | Updated active MeetingModel query projections to include required typed lifecycle and completeness fields. | open |  | 2026-09-20T18:57:45.987Z |  |
| 4 | 01 | deviation | frontend/src-tauri/src/audio/recording_commands.rs |  | Threaded the canonical meeting ID and shared SQLite pool through both recording start call sites so the planned worker durability boundary is reachable | open |  | 2026-09-20T19:20:21.732Z |  |
| 5 | 01 | deviation | frontend/src-tauri/src/audio/transcription/worker.rs |  | Routed post-persistence canonical transcript publication through the delivery-token emitter so acknowledgements cannot weaken the persistence-before-publish invariant. | open |  | 2026-09-20T19:47:25.718Z |  |

````json
[
  {
    "id": 1,
    "kind": "lint-warning",
    "phase": "01",
    "file": "frontend/src-tauri",
    "line": null,
    "description": "Pre-existing repository-wide cargo fmt drift is deferred to a dedicated maintenance change",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-20T18:21:47.000Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "deviation",
    "phase": "01",
    "file": "frontend/src-tauri/src/audio/recording_commands.rs",
    "line": null,
    "description": "Threaded committed StartMeetingResult through command and renderer call sites required by canonical recovery mirrors.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-20T18:57:45.803Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "deviation",
    "phase": "01",
    "file": "frontend/src-tauri/src/database/repositories/meeting.rs",
    "line": null,
    "description": "Updated active MeetingModel query projections to include required typed lifecycle and completeness fields.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-20T18:57:45.987Z",
    "resolved_at": null
  },
  {
    "id": 4,
    "kind": "deviation",
    "phase": "01",
    "file": "frontend/src-tauri/src/audio/recording_commands.rs",
    "line": null,
    "description": "Threaded the canonical meeting ID and shared SQLite pool through both recording start call sites so the planned worker durability boundary is reachable",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-20T19:20:21.732Z",
    "resolved_at": null
  },
  {
    "id": 5,
    "kind": "deviation",
    "phase": "01",
    "file": "frontend/src-tauri/src/audio/transcription/worker.rs",
    "line": null,
    "description": "Routed post-persistence canonical transcript publication through the delivery-token emitter so acknowledgements cannot weaken the persistence-before-publish invariant.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-20T19:47:25.718Z",
    "resolved_at": null
  }
]
````
