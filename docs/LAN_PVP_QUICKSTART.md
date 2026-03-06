# LAN PvP Quickstart

## Goal
Play **Split Seconds** player-vs-player over the same WiFi, from two devices, with full battle flow:
- Exert
- Planning
- Flash reveal
- Lock/Pivot decisions
- Pivot re-planning
- Resolution

## 1) Start the LAN host server (PC/Mac)
From the project root:

```bash
node lan_server.js
```

The server prints URLs like:
- `http://localhost:8787`
- `http://192.168.x.x:8787`

Use the **LAN URL** (`192.168.x.x`) on every device.

## 2) Open the game on both devices
- Host device (usually desktop/laptop): open the LAN URL.
- Guest device (can be iPad/Safari): open the same LAN URL.
- Both devices must be on the same WiFi network.

## 3) Host and join (easy flow)
### Host player
1. In `LAN PvP (Same WiFi)`, optionally set `Your name`.
2. Click `Host Room` (room code auto-generates if empty).
3. Share the room code, or tell guest to tap `Refresh Rooms` and join from list.
4. Pick character/deck and click `ENTER COMBAT` after guest connects.

### Guest player
1. In LAN panel, use one of these:
- Tap `Join` on a room in `Open Rooms`.
- Or enter room code manually and click `Join Room`.
2. Pick character/deck.
3. Wait for host to start.

## 4) Match flow in LAN mode
- **Exert:** both players select exert cards and confirm.
- **Planning:** both players place actions/enhancers and lock.
- **Flash:** one moment is revealed to both players.
- **Decision:** each player chooses Lock or Pivot (simultaneous).
- **Pivot wait:** any player that pivoted replans freed slots, then locks.
- **Resolution:** host resolves canonical state and streams snapshots.

## 5) Hidden-information and anti-cheat model
- You see your own hand and timeline normally.
- Opponent hand is count-only placeholders during hidden phases.
- Opponent timeline is hidden during Exert/Planning/Flash/Pivot-wait hidden states.
- Flash reveals only the sampled moment card, matching normal game rules.
- Guest snapshots do **not** include host RNG internals.

## 6) iPad/Safari tips
- Use `Join` from `Open Rooms` for one-tap connection.
- Keep Safari in foreground during planning/flash to avoid background throttling.
- If layout scales oddly after orientation change, rotate once and reopen match.

## 7) Troubleshooting
1. If guest cannot join, ensure both devices are on same WiFi.
2. Verify guest uses host LAN IP (`192.168...`), not `localhost`.
3. Allow Node/port `8787` through firewall.
4. If room looks stale/full, click `Refresh Rooms`.
5. If room is stuck, click `Leave` on both devices and recreate room.

## Notes
- Rooms are in-memory only (server restart clears rooms).
- LAN PvP and offline PvE coexist; AI mode still works normally.

