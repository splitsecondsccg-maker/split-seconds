# LAN PvP Quickstart

## 1) Start the LAN server
From the project root:

```bash
node lan_server.js
```

The server prints URLs such as:
- `http://localhost:8787`
- `http://192.168.x.x:8787`

Use the LAN URL on both devices.

## 2) Host device flow
1. Open the game URL.
2. In `LAN PvP (Same WiFi)`, click `Host Room`.
3. Share the room code with the second player.
4. Pick your character/deck as normal.
5. Click `ENTER COMBAT` when guest is connected.

## 3) Guest device flow
1. Open the same game URL.
2. Enter room code.
3. Click `Join Room`.
4. Pick your character/deck.
5. Wait for host to start.

## 4) How turns work in LAN mode
- Exert: both players can select exert cards and must both confirm.
- Planning: both players place timeline actions.
- Lock: resolution starts only when both players lock.
- Resolution: host resolves, guest follows via snapshots.

## 5) Hidden info model
- Guest receives own hand fully.
- Opponent hand is count-only placeholders.
- Opponent timeline is hidden in non-public phases.

## v1 limitation
- Flash/Pivot flow is currently disabled in LAN mode.
- After both players lock planning, timeline resolves directly.

## Notes
- Rooms are in-memory only and reset when server restarts.
- LAN mode does not replace offline AI mode; both coexist.
