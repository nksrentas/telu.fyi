---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 39
subsystem: testing
tags: [knowledge-eval, know-07, held-out, ami-corpus, gap-closure, provenance]
status: complete

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-37 held-out evaluation, whose 7 meetings (and the 3 pilot meetings) are now spent and excluded here
provides:
  - New held-out AMI set outside the repository at $HOME/telu-know07-audio2/heldout (6 representative, 1 insufficient-evidence, 1 degraded-capture), approved by the user, integrity-checked and unseen
  - $HOME/telu-know07-audio2/manifest.json listing exactly the files 02-43 imports
affects: [KNOW-07, 02-43]

actuals:
  tokens: 2600
  tasks: 3
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Held-out audio is approved by name, source and size before download, size-checked against Content-Length, sha256-compared with every spent recording, and kept outside the repository"

key-files:
  created:
    - .planning/phases/02-evidence-linked-post-meeting-knowledge/02-39-SUMMARY.md
  modified: []

key-decisions:
  - "02-39: new KNOW-07 held-out set approved by the user (\"approved\", 2026-10-18T12:58:16Z) and prepared outside the repository: ES2005b, ES2006c, ES2007c, IS1000b, IS1001c, TS3004c representative; ES2009a first 300 s insufficient_evidence; TS3005b silenced at 300-345/780-870/1320-1380/1800-1890 s degraded_capture; spares ES2010b and IS1003b not needed"
  - "02-39: degraded-capture silence is applied per sample (ffmpeg aeval), not per frame (volume enable leaked edge samples), so every interval is exactly zero"

patterns-established:
  - "Approval request, manifest and README for a held-out set live next to the audio, outside the repository; the SUMMARY carries only ids, categories, sizes, hash prefixes, approval and license"

requirements-completed: []

duration: 25min
completed: 2026-10-18
---

# Phase 2 Plan 39: New KNOW-07 Held-Out AMI Set Summary

**8 public AMI Meeting Corpus recordings (CC BY 4.0) approved once by the user, downloaded only from the official mirror, size- and hash-checked, and prepared into 6 representative, 1 insufficient-evidence and 1 degraded-capture held-out file outside the repository, unseen until 02-43**

## Performance

- **Duration:** about 25 min, plus the wait for approval. Task 1 was first blocked by a refused connection to the mirror and re-run once it became reachable.
- **Approved:** 2026-10-18T12:58:16Z
- **Completed:** 2026-10-18T13:07Z
- **Tasks:** 3 (1 auto, 1 human-action approval, 1 auto)
- **Repository files:** 1 (this SUMMARY)

## Approval

- **Reply:** "approved" (whole batch as shown, spares conditional), recorded as `approvedAt` 2026-10-18T12:58:16.333Z in `$HOME/telu-know07-audio2/approval-request.json`.
- **Source:** `https://groups.inf.ed.ac.uk/ami/AMICorpusMirror/amicorpus/<id>/audio/<id>.Mix-Headset.wav`, https only. The 8 primaries totalled 559.16 MB.
- **License:** CC BY 4.0, AMI Consortium / University of Edinburgh.

## Held-Out Set (content-free)

| AMI id | Category | Prepared file | Bytes | sha256 prefix | Raw bytes (= Content-Length) | Raw sha256 prefix |
|---|---|---|---|---|---|---|
| ES2005b | representative | ES2005b.wav | 74,024,322 | c96d83f95585 | 74,024,322 | c96d83f95585 |
| ES2006c | representative | ES2006c.wav | 69,813,976 | d7d9a3005908 | 69,813,976 | d7d9a3005908 |
| ES2007c | representative | ES2007c.wav | 76,077,100 | 20978cecd99c | 76,077,100 | 20978cecd99c |
| IS1000b | representative | IS1000b.wav | 74,997,452 | 0f71e5018a28 | 74,997,452 | 0f71e5018a28 |
| IS1001c | representative | IS1001c.wav | 46,254,806 | 43aebd5d3ebb | 46,254,806 | 43aebd5d3ebb |
| TS3004c | representative | TS3004c.wav | 95,040,044 | 4fea0b90a241 | 95,040,044 | 4fea0b90a241 |
| ES2009a | insufficient_evidence | ES2009a-first5min.wav | 9,600,078 | b1d411ff63f2 | 44,870,700 | 472adcae2cff |
| TS3005b | degraded_capture | TS3005b-gaps.wav | 78,077,346 | 2e07a99830a3 | 78,077,312 | 8020ab7c3f26 |

- Representative files are unchanged hard links to the downloads. ES2009a is cut to exactly 300.0 s. TS3005b keeps its full 2439.91 s, with samples set to zero at 300-345, 780-870, 1320-1380 and 1800-1890 s.
- Spares ES2010b and IS1003b were not downloaded.

## Task Results

1. **Task 1 (resolve candidates):**
   - None of the 10 candidates is a spent meeting or from a spent series.
   - Every candidate has an abstractive summary with at least 1 decisions sentence and 1 actions sentence. Only counts were taken.
   - All 10 HEAD requests returned 200 with a Content-Length.
   - Verify exited 0, and only `approval-request.json` existed before approval.
2. **Task 2 (approval):** the user replied "approved".
3. **Task 3 (download and prepare):**
   - All 8 sizes matched their Content-Length.
   - No sha256 equals any of the 11 spent raw recordings.
   - durations were checked with ffprobe, and the silenced intervals with volumedetect: max -91 dB, which is digital zero, inside every interval, and -15 to -27 dB outside them.
   - Task 3 verify 1 (manifest) exited 0. Task 3 verify 2 (no audio or annotation in git status) exited 0.

## Task Commits

No task commits: every task artifact lives outside the repository by design. The only commit is this SUMMARY (the docs commit below), with STATE.md and ROADMAP.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Degraded-capture silence leaked at frame edges**
- **Found during:** Task 3
- **Issue:** `volume=...:enable='between(t,...)'` switches per audio frame, so the 300-345 s and 780-870 s windows still had max -27.6 dB and -71.2 dB.
- **Fix:** regenerated TS3005b-gaps.wav with a per-sample `aeval` expression. All four intervals now measure -91 dB (zero) and the duration is unchanged.
- **Files modified:** $HOME/telu-know07-audio2/heldout/TS3005b-gaps.wav (outside the repository)
- **Commit:** none (outside the repository)

**2. [Rule 3 - Blocking] Mirror unreachable during the first Task 1 attempt**
- **Found during:** Task 1
- **Issue:** connections to groups.inf.ed.ac.uk were refused on 443 and 80.
- **Fix:** returned a blocking checkpoint without writing anything. Re-ran Task 1 once the coordinator confirmed the mirror was reachable again.

## Issues Encountered

None remaining.

## Next Phase Readiness

02-43 can import exactly the files listed in `$HOME/telu-know07-audio2/manifest.json` without another download. Nothing was imported, played, transcribed or labeled, and the AMI summaries were read only to count decisions and actions sentences.

## Self-Check: PASSED

- FOUND: $HOME/telu-know07-audio2/approval-request.json (approvedAt set)
- FOUND: $HOME/telu-know07-audio2/manifest.json (8 files, 64-hex sha256, durations > 0)
- FOUND: $HOME/telu-know07-audio2/README.txt
- FOUND: all 8 files in $HOME/telu-know07-audio2/heldout
- Repository status contains no .wav, .abssumm.xml or telu-know07-audio2 path
