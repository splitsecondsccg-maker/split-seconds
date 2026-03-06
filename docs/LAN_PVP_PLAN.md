# LAN PvP (Same WiFi) - Implementation Plan and Protocol

## Goals
- Add player-vs-player support over local WiFi.
- Keep existing single-player vs AI fully working.
- Keep hidden information protected for the remote guest client.
- Use a lightweight no-build architecture that fits the current plain HTML/JS codebase.

## Scope (v1)
- Transport: HTTP long-polling relay server (`lan_server.js`) served from the game root.
- Roles:
  - Host: authoritative game state and rules execution.
  - Guest: remote controller + mirrored view from host snapshots.
- Match flow:
  - Character/deck selection on each device.
  - Host starts match.
  - Both players can act during Exert and Planning.
  - Resolution runs on host and is streamed to guest.
- Hidden info:
  - Guest receives full info for self side only.
  - Opponent hand is redacted to count-only placeholders.
  - Opponent timeline is redacted during non-public phases.

## Explicit v1 Limitation
- Flash/Pivot decision flow is disabled in LAN mode.
- LAN mode resolves immediately after both players lock planning.
- Rationale: ensures a stable and fair first networked version without rewriting large synchronous flash/pivot state handling in one step.

## Architecture

### Server
- In-memory room relay with these endpoints:
  - `POST /api/room/host`
  - `POST /api/room/join`
  - `POST /api/room/send`
  - `GET /api/room/poll?roomCode=...&token=...&since=...`
- Static file server for game assets.
- No persistence (rooms reset when server restarts).

### Client runtime (`netplay.js`)
- Maintains mode and role:
  - `offline`
  - `lan-host`
  - `lan-guest`
- Poll loop for inbound events.
- Host responsibilities:
  - Apply local actions normally.
  - Apply guest actions onto canonical `ai` side.
  - Broadcast redacted snapshots.
- Guest responsibilities:
  - Forward local inputs as actions.
  - Never mutate authoritative state locally.
  - Render host snapshots using guest perspective projection.

### Action model
- Guest -> Host actions:
  - `toggle_exert`
  - `confirm_exert`
  - `engine_action` (`PLACE_CARD_FROM_HAND`, `RETURN_CARD_TO_HAND`, `ADD_BASIC_ACTION`, `USE_ABILITY`)
  - `lock_planning`
  - `selection_update`
- Host -> Guest events:
  - `room_state`
  - `match_started`
  - `snapshot`
  - `system`

## Anti-cheat and Information Symmetry
- Guest snapshot redaction rules:
  - Opponent hand cards replaced by placeholders with same length.
  - Opponent timeline hidden during `exert`, `planning`, and waiting-lock phases.
- Host remains authoritative for all rule resolution.
- This protects guest from hidden state leakage through network payloads.

## Integration points
- `index.html`: add LAN controls + load `netplay.js`.
- `styles.css`: LAN panel styling.
- `core.js`: add reusable battle-meta rendering helper for snapshot-based view updates.
- `ui.js`: extend AI timeline hiding conditions for LAN hidden phases.
- `netplay.js`: LAN client runtime, wrappers, snapshot sync, host-side guest action application.

## Test checklist
- Host can create room and see room code.
- Guest can join and host sees joined status.
- Guest selection updates host opponent selection.
- Match start from host brings both devices into battle.
- Both sides can exert, confirm exert, place cards, remove cards, use abilities.
- Planning lock waits for both players.
- Resolution progresses on both screens.
- Guest cannot inspect host hidden hand/timeline during planning.
- Offline AI mode still works unchanged.
