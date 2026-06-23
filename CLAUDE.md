# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Run all tests:**
```
npx playwright test
```

**Run a single test file:**
```
npx playwright test tests/tracker.spec.js
```

**Run tests headed (visible browser):**
```
npx playwright test --headed
```

**Open the app:**
Open `study-tracker.html` directly in Chrome or Edge (Firefox lacks the File System Access API).

**Test mode** (2-second timer instead of 5 minutes):
```
file:///path/to/study-tracker.html?test=1
```

## Architecture

The entire app is a single file: `study-tracker.html`. It has no build step, no dependencies, and no backend.

**Timer**: A Web Worker (created inline via `URL.createObjectURL`) drives the countdown so it isn't throttled when the tab is backgrounded. The main thread receives `tick` and `done` messages from the worker.

**Timer states** cycle through: `ready → studying → paused → check-in → studying → … → session ended`. When a session reaches its planned length the state becomes `time’s up` (session bell); ignoring the bell ends it as `abandoned`. The `#status` element and `#startBtn` label always reflect the current state.

**Pre-session gate**: Before the first timer start, the `goalOverlay` modal shows a checklist (☐ eaten ☐ drank water ☐ phone away ☐ tabs closed), a planned-length picker (25/50/90 min, default 50), and the optional goal input. Checklist taps and the chosen length are non-blocking but logged to SESSION START (`prep:…`, `length:…`) — the friction is intentional, to discourage impulsive starts.

**Session bell / max length + auto-end**: `startSession()` sets `sessionDeadline = start + plannedMin`. The 1-second interval calls `fireSessionBell()` when the deadline passes (only while actively studying with no other modal open). The bell offers **End** (→ completion modal), **Keep going +10m** (`bellExtend`, snoozes the deadline and resumes), and **Take a break** (`bellBreak`, snoozes then drops into the pause flow). If untouched for 2 minutes (`abandonTimer`; 4 s in test mode) the session auto-ends via `autoEndAbandoned()` and is logged with `abandoned:true`.

**Ring color** tracks urgency via `renderRing()`: >50% remaining = `--accent` (#6366f1 indigo), >20% = `--orange` (#f59e0b), ≤20% = `--red` (#ef4444).

**Dynamic favicon**: `updateFavicon()` draws a matching ring arc onto a 32×32 canvas on every tick and injects it as the page favicon, so the timer is visible in the browser tab.

**File I/O**: Uses the browser's File System Access API (`showOpenFilePicker` / `showSaveFilePicker`) — Chrome/Edge only. All writes go through a `writeQueue` promise chain (`_writeRow`) to prevent race conditions. If no file is connected, the would-be log row falls back to clipboard.

**Log format**: Structured markdown table appended to the connected `.md` file, grouped under `## YYYY-MM-DD` date headers. Log event types:

| Event | When logged | Key fields |
|---|---|---|
| `SESSION START` | Session begins | `sess`, `length`, `goal` (optional), `prep` |
| `PAUSE` | Timer paused | `sess`, `reason` |
| `RESUME` | Timer resumed | `sess`, `paused` (duration) |
| `DISTRACTION` | 😵 button tapped | `sess`, `interval`, `session-total` |
| `CHECK-IN` | Every 5-min cycle | `sess`, `status`, `topic`, `focus`, `trigger`, `distractions`, `resp`, `notes` |
| `SESSION END` | Session completed | `sess`, `planned`, `duration`, `active`, `studied`, `focus-ratio`, `on-task`, `pauses`, `distractions`, `focus`, `top-distraction`, `goal`, `completed`, `abandoned`, `summary` |

**Two elapsed metrics**: `duration` is wall-clock minutes (`now − start`); `active` is wall-clock minus all paused time (`sessionPausedMs`). The real focus ratio is `focus-ratio` = `studied / active`; `on-task` = `studied / duration` is kept for comparison and is noisy when a session sat paused for hours. The stats bar shows both **min elapsed** (`sWall`, wall-clock) and **active min** (`sActive`).

**Modals**: Five overlays — pre-session (`goalOverlay`: checklist + length + goal), check-in (every 5 min), pause reason, session completion, and session bell (`sessionBellOverlay`: planned length reached). Each is shown/hidden by toggling the `.open` class on `.overlay`.

**Stats bar**: Six live counters displayed below the controls:

| ID | Label | Description |
|---|---|---|
| `sMin` | min studied | Focused minutes across all check-ins answered "Yes" or "Done" |
| `sWall` | min elapsed | Wall-clock minutes since session start, updated every second |
| `sActive` | active min | Wall-clock minus all paused time (the real denominator for focus ratio) |
| `sCheckins` | check-ins | Total check-ins submitted this session |
| `sStreak` | streak | Consecutive "Yes/Done" check-ins; resets on Break/Distracted |
| `sDistractions` | distractions | Taps since the last check-in; **clickable** — tap to record a wandering moment |

**Distraction counter**: `stats.distractions` counts taps since the last check-in (shown on screen, resets to 0 after each check-in). `stats.distractionsTotal` accumulates across all intervals and is written to the SESSION END log. Each tap also writes an immediate `DISTRACTION` event row.

**Session state object** (`stats`):
```js
{
  min: 0,                    // focused minutes
  checkins: 0,               // check-ins submitted
  streak: 0,                 // consecutive focused check-ins
  lastYes: false,            // whether last check-in was focused
  pauses: 0,                 // pause count
  distractions: 0,           // taps this interval (resets at check-in)
  distractionsTotal: 0,      // taps this session (written to SESSION END)
  focusCounts: { High, Medium, Low },
  distractionTriggers: {}    // trigger → count from check-in modal
}
```

**Session goal**: Prompted via `goalOverlay` before the first timer start. Stored in `sessionGoal`; written to SESSION START and SESSION END log rows.

**Tests**: Playwright tests mock `showSaveFilePicker` / `showOpenFilePicker` via `page.addInitScript` to avoid OS file dialogs. The `?test=1` param sets `TOTAL = 2` seconds so the check-in fires quickly during tests.
