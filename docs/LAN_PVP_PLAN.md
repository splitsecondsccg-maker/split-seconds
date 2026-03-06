# LAN PvP (Same WiFi) - Architecture and Protocol

## Goals
- Support player-vs-player over local WiFi.
- Preserve single-player vs AI mode.
- Keep hidden information protected.
- Keep implementation compatible with plain HTML/JS (no build step).

## Current Status
Implemented as host-authoritative LAN PvP with full battle parity:
- Character/deck selection sync
- Exert sync
- Planning sync
- Flash reveal sync
- Lock/Pivot decision sync
- Pivot re-planning sync
- Resolution streaming

## Architecture

### Server (`lan_server.js`)
In-memory room relay + static file server.

Endpoints:
- `POST /api/room/host`
- `POST /api/room/join`
- `POST /api/room/send`
- `GET /api/room/poll?roomCode=...&token=...&since=...`

### Client runtime (`netplay.js`)
Roles:
- **Host:** authoritative rules/state execution.
- **Guest:** sends local intents, renders host snapshots.

Flow:
- Poll inbound events.
- Host applies guest actions to canonical `ai` side.
- Host sends perspective-redacted snapshots to guest.

## Event Model
Guest -> Host:
- `selection_update`
- `guest_action`
- `exert_confirm`
- `planning_lock`
- `flash_decision` (`lock` or `pivot`)
- `pivot_lock`

Host -> Guest:
- `room_state`
- `match_started`
- `snapshot`

## Hidden Information Rules
Guest snapshot redaction:
- Opponent hand is placeholder cards (count preserved).
- Opponent timeline hidden during hidden phases (`exert`, `planning`, `flash`, `pivot_wait`, and wait phases).
- Flash metadata reveals only sampled moment cards.

## Compatibility
- Offline AI mode remains unchanged.
- LAN mode is opt-in from the in-game panel.

## Testing Checklist
- Host room creation/join flow works.
- Match start sync works on both devices.
- Both sides can exert, plan, lock, pivot, and resolve.
- Pivot wait correctly restricts edits to freed slots.
- Guest cannot inspect host hidden hand/timeline during hidden phases.
- State stays synchronized across whole turn cycle.
