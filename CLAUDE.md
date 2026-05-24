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

**Timer states** cycle through: `ready → studying → paused → check-in → studying → … → session ended`. The `#status` element and `#startBtn` label always reflect the current state.

**Ring color** tracks urgency via `renderRing()`: >50% remaining = `--accent` (#6366f1 indigo), >20% = `--orange` (#f59e0b), ≤20% = `--red` (#ef4444).

**File I/O**: Uses the browser's File System Access API (`showOpenFilePicker` / `showSaveFilePicker`) — Chrome/Edge only. All writes go through a `writeQueue` promise chain (`_writeRow`) to prevent race conditions. If no file is connected, the would-be log row falls back to clipboard.

**Log format**: Structured markdown table appended to the connected `.md` file, grouped under `## YYYY-MM-DD` date headers.

**Modals**: Four overlays — goal (session start), check-in (every 5 min), pause reason, and session completion. Each is shown/hidden by toggling the `.open` class on `.overlay`.

**Tests**: Playwright tests mock `showSaveFilePicker` / `showOpenFilePicker` via `page.addInitScript` to avoid OS file dialogs. The `?test=1` param sets `TOTAL = 2` seconds so the check-in fires quickly during tests.
