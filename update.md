# PTP Branson 2026 — suggested changes & notes for Jeffrey

This is a collaboration branch (`dev`). Everything here is a suggestion for your
review — nothing has been merged to `main`. It splits into two parts:

- **In this PR** — client-side changes to `index.html` / `admin.html` that work on
  their own, no backend changes required.
- **Backend asks (below)** — a few things that need the Apps Script / Sheet, which
  are yours. These are written up here rather than coded.

---

## What's in the PR (client-side, ready to review)

1. **Silent-submit fix — offline outbox.** Submitting a headcount used to show
   "Submitted! ✓" even when the network request failed (the `.catch()` marked it
   submitted anyway), so counts could silently disappear on bad venue wifi. Now each
   count is queued in `localStorage` first and only marked submitted once the request
   actually reaches the server; failures show a **pending** state and auto-retry on
   reconnect and on app reload. The POST now uses `mode:'no-cors'`, which also fixes
   a subtler issue — a plain `fetch` to Apps Script can *reject on a successful write*
   because of the `302 → googleusercontent` redirect, which is very likely why the
   original code assumed success in the first place.

2. **See any session's count (feature request).** Counts were stored only per-device,
   so a monitor could only see counts they personally entered. The app now displays a
   shared count on every session card and room row — **once the `getAttendance`
   endpoint below exists.** Until then it degrades silently and behaves exactly as
   before. (See backend ask #1.)

3. **"Hide sessions already counted" filter.** A checkbox on the schedule to hide
   sessions that already have a count, so monitors can focus on what's left.

4. **Current session jumps to the top.** On load/refresh the app now scrolls the
   in-progress (or next-up) session to the top and marks it "● NOW / ▲ UP NEXT", in
   both the schedule and room views — instead of just scrolling to today's date.

5. **`admin.html` timezone consistency.** `admin.html` derived times/day with
   `new Date(...)`, which shifts by the viewer's local timezone; `index.html` parses
   straight from the schedule string. Standardized `admin.html` onto the same string
   parsing so the two apps can't disagree on a session's time or day.

### Note on timezones / the two events
Schedule **display** is timezone-safe on purpose: times render as the venue's
wall-clock from the sheet string, with no conversion, so a 9:00 AM session shows as
9:00 AM to everyone — correct for both the Central and Eastern events with no config.
The only place real "now" matters is the current-session highlight (#4), and that
intentionally uses the **device's** local clock: on-site monitors' phones are already
on venue time, so it's correct at both venues automatically — and there's no
per-event timezone constant to set wrong.

---

## Backend asks (need the Apps Script / Sheet — your call)

### 1. `getAttendance` read endpoint — unlocks "see any session's count"
Feature #2 above renders shared counts but has nothing to read yet. A small `doGet`
action would light it up. The client already calls:

```
GET  {ATTENDANCE_URL}?action=getAttendance
```

and expects a **CORS-readable JSON array** (same as `getSessions` already returns),
one entry per recorded session:

```json
[
  { "date": "2026-07-15", "time": "09:00 AM - 09:30 AM", "room": "Ballroom A", "headcount": 142 },
  { "date": "2026-07-15", "time": "09:00 AM - 09:30 AM", "room": "Boston Ferry", "headcount": 88 }
]
```

- `time` should be the same `"start - end"` string `submitAttendance` writes (the
  client keys on the part before `" - "`), `date` = `YYYY-MM-DD`, `headcount` = number.
- `monitor` may be included but isn't required — counts are shown per room/time.
- No auth needed; it's read-only, non-sensitive data.

### 2. Confirmation ack + de-duplicate on write
Two related improvements to `doPost(submitAttendance)`:

- **De-dupe / upsert.** The new outbox retries a queued submit until it reaches the
  server, so `doPost` should **upsert by `date + time + room`** (update the existing
  row) rather than always appending — otherwise a retry after a flaky connection could
  create a duplicate row. This is worth doing regardless of the ack below.
- **Optional true confirmation.** With `no-cors`, the client can tell a submit
  *reached* the server but not that the row was *written*. If `doPost` returned
  `{"ok": true}` as CORS-readable JSON, the client could switch back to a normal
  `fetch` and confirm actual persistence. Not required — the current approach already
  eliminates the false-success bug — but it's the way to close the last gap.

### 3. Service worker is half-disabled — pick a direction
`index.html` unregisters all service workers on every load, yet `sw.js` and
`manifest.json` still ship one. Net effect: no real offline capability, and a
contradictory setup. Two clean options:
- **Remove it** (drop `sw.js`, keep `manifest.json` as a plain installable shortcut), or
- **Make it correct** and pair it with the new offline outbox — that combination is
  what would genuinely keep the app working through a mid-session wifi drop.

Left untouched here pending your preference.

### 4. `admin.html` has no access control
Anyone with the admin URL can reassign monitors, and the endpoints are public. Real
protection has to live server-side (a client-side password is bypassable via
view-source). Simplest options: require a shared secret parameter on the
`updateMonitor` action, or gate the Apps Script to your Google account. Flagging it
rather than shipping something that only looks like security.
