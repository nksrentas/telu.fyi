---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-09-20T18:21:47.000Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | lint-warning | frontend/src-tauri |  | Pre-existing repository-wide cargo fmt drift is deferred to a dedicated maintenance change | open |  | 2026-09-20T18:21:47.000Z |  |

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
  }
]
````
