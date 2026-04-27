# Minimalist-Time-Tracker

A self-contained browser app for tracking focused work sessions with 5-minute check-ins. No backend, no dependencies — single HTML file.

### Preview

![Study Tracker](assets/screenshot.png)

### Features

- Circular countdown timer with color-coded urgency (blue → amber → red)
- Check-in modal every 5 minutes — logs status, topic, focus level, and distraction triggers
- Pause tracking with reason capture (hunger, phone, break, or custom)
- Audio chime at each interval
- Structured markdown log written directly to a local file via the File System Access API (Chrome/Edge only)
- Session-tagged rows (`sess:HH:MM`) so each session is self-contained and readable after browser close
- Per-session summary on completion: duration, time on-task %, pause count, focus breakdown, top distraction
- Live stats: minutes tracked, check-in count, focus streak

### Log Format

| Time  | Event         | Details |
|-------|---------------|---------|
| 09:00 | SESSION START | sess:09:00 |
| 09:05 | CHECK-IN      | sess:09:00 \| status:Yes \| topic:LeetCode \| focus:High \| resp:8s |
| 09:20 | PAUSE         | sess:09:00 \| reason:Break |
| 09:25 | RESUME        | sess:09:00 \| paused:5m 2s |
| 10:00 | SESSION END   | sess:09:00 \| duration:60m \| studied:50m \| on-task:83% \| focus:H2/M1/L0 \| top-distraction:none |

### Requirements

Chrome or Edge — uses the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) to write logs directly to a local markdown file.
