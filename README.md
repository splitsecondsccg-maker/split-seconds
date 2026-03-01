# Split Seconds (prototype) — codebase overview

This repository contains a **browser-based, turn-based card fighting game** prototype.

The **player experience and UI are unchanged**. The refactor in this branch focuses on making the code easier to scale by splitting the previous `engine.js` monolith into domain files.

---

## Quick start

Because this is a pure HTML/JS/CSS prototype, you can run it locally with any static server.

Examples:

- **VSCode**: install “Live Server”, right click `index.html` → *Open with Live Server*
- **Python**:
  - `python -m http.server 8000`
  - open `http://localhost:8000/index.html`

> Tip: don’t open `index.html` via `file://` if your browser blocks audio or drag/drop quirks; a local server is more reliable.

---

## Folder / file map

### UI + Pages
- `index.html` — main app shell (menu + match)
- `rules.html` — rules page
- `styles.css` — main UI styling
- `tutorial.css` — tutorial-specific styling

### Character Select Views
The character selection screen supports two layouts:
- **Fighting View** *(default)*: large player/opponent portraits with a centered roster. You pick your character, **Lock In**, then pick the opponent.
- **TCG View**: the original roster layout.

Both layouts write to the same underlying selection values (`state.selectedClass`, `state.aiClass`).

### Game content (data)
- `data.js`
  - `classData`: all characters + their deck blueprints
  - `buildDeck(blueprint)`: expands `{ copies: N }` into a full deck list
  - `charImages`: portrait mapping

### Engine (split from the original monolith)
The original `engine.js` has been preserved as **`engine_legacy.js`** for reference.

The running game now uses these files (loaded in `index.html` in this order):

1. `data.js` — content data
2. `engine_runtime.js` — **Action Queue + Event Log + pure-ish step() for common actions**
3. `core.js` — shared utilities + global state + game setup helpers
4. `ui.js` — rendering + drag/drop (dispatches actions instead of mutating state directly)
5. `game.js` — AI planning + flash/pivot step + AI reaction
6. `effects_registry.js` — effect registry (gradual migration away from the switch)
7. `resolution.js` — moment resolution + legacy effect switch + turn progression
8. `tutorial.js` — tutorial flow
9. `tests.js` — tiny console-driven sanity tests

---

## High-level architecture

### 1) State model
The entire match is represented by a single global `state` object.

Key fields:
- `state.player` / `state.ai`
  - `hp`, `maxHp`
  - `stam`, `maxStam`
  - `armor`
  - `hand`: array of card objects
  - `deck`: expanded deck array (used as a pool to sample draws)
  - `timeline`: 5-slot array (`null`, `'occupied'`, or a card object)
  - `statuses`: per-character status effects (freeze, armor debuff, etc.)
- `state.phase`: `'exert' | 'planning' | 'flash' | 'pivot_wait' | 'resolution'`
- `state.currentMoment`: integer 0..4

Additional (new, for scaling):
- `state.useDeterministicRng` *(boolean)*: default `false` so gameplay randomness remains unchanged.
- `state.rngSeed` *(uint32)*: used if deterministic RNG is enabled.

### 2) Turn flow
1. **Exert phase** (`state.phase = 'exert'`)
   - Player may burn cards for +1 stamina each
   - Confirm → both sides draw (2, modified by effects) → go to planning

2. **Planning phase** (`state.phase = 'planning'`)
   - Player places cards onto timeline (drag/drop)
   - Player can also add **basic actions** (Block/Parry) and class **abilities**
   - Lock → flash/pivot step

3. **Flash / Pivot step** (`state.phase = 'flash'` → `'pivot_wait'`)
   - A random “flash moment” is selected
   - Player may pivot cards in the highlighted window (costs stamina)
   - Player locks in → AI can react/pivot → resolve

4. **Resolution phase** (`state.phase = 'resolution'`)
   - Resolve moment 0..4 in order
   - After moment 4 → `nextTurn()`

---

## New runtime layer: Action Queue + Event Log

`engine_runtime.js` adds a small “kernel” so the project can scale without introducing a build step.

### Action Queue
User interactions dispatch actions instead of directly mutating state (starting with core UX actions):
- `PLACE_CARD_FROM_HAND`
- `RETURN_CARD_TO_HAND`
- `ADD_BASIC_ACTION`
- `USE_ABILITY`
- `TOGGLE_EXERT_CARD`
- `CONFIRM_EXERT`

Dispatch from anywhere:
```js
EngineRuntime.dispatch({
  type: EngineRuntime.ActionTypes.PLACE_CARD_FROM_HAND,
  payload: { handIndex: 0, startMoment: 0 }
});
```

### Event Log
Actions can emit events (log lines, sounds, floaters, UI changes). This is the backbone for replays + multiplayer.

Inspect it from devtools:
```js
EngineRuntime.getEventLog();
```

### Deterministic RNG (opt-in)
To keep the current prototype feeling identical, deterministic RNG is **off** by default.

To turn it on (future online mode):
```js
state.useDeterministicRng = true;
state.rngSeed = 123; // any uint32
```

---

## Card data format (how to add cards)

Cards are defined in `data.js` in a class’s `deck` list.

Minimal card schema:
```js
{ id: 'x1', copies: 3, name: 'My Card', type: 'attack', cost: 2, moments: 2, dmg: 5, desc: '...' }
```

Fields:
- `id` *(string)*: identifier used by `buildDeck`
- `copies` *(int)*: how many copies in the deck
- `name` *(string)*: shown in UI
- `type` *(string)*: one of `attack`, `grab`, `block`, `buff` (engine logic keys off this)
- `cost` *(int)*: stamina cost
- `moments` *(1..5)*: how many timeline slots the card occupies
- `dmg` *(int, optional)*: damage dealt (defaults to 0)
- `desc` *(string)*: UI text. Keyword tokens like `FREEZE`, `BLEED`, `POISON` are automatically wrapped in hover tooltips.
- `effect` *(string, optional, legacy)*: single effect key handled by the legacy `applyEffect()` pipeline
- `effects` *(array, optional, preferred)*: triggered effects for scalable abilities/keywords

Optional fields used by certain cards:
- `currentBlock` *(int)*: remaining shield for multi-moment blocks (e.g. `Ice Wall`)

### Preferred: triggered effects (`card.effects`)

To scale cleanly, cards can define **triggered effects** as an array on the card. Each entry says **when** it fires (`trigger`) and **what** to do (`type`, handled by `effects_registry.js`).

```js
{
  id: 'toxic_cut',
  copies: 2,
  name: 'Toxic Cut',
  type: 'attack',
  cost: 2,
  moments: 1,
  dmg: 3,
  desc: 'Deal 3. Apply POISON 2 on hit.',
  effects: [
    { trigger: 'on_hit', type: 'poison', amount: 2 }
  ]
}
```

Common triggers used in this prototype:
- `on_play` — when a card is placed/played
- `on_hit` — when an attack/grab connects
- `on_resolve` — when the moment resolves
- `on_turn_end` — end-of-turn effects

Both systems can coexist during migration:
- New content should prefer `effects: [...]`.
- Older cards can keep `effect: 'some_key'` until converted.

### Adding a new card effect

Effects are being migrated from a big switch to a scalable registry.

**Preferred (new):** add an effect **type** to `effects_registry.js`:
```js
// effects_registry.js
EffectTypeRegistry.my_new_type = ({ state, sourceKey, targetKey, context, api, params }) => {
  // mutate state (for now) + use api.log/api.float/api.sound for UX
};
```

**Legacy (fallback):** `resolution.js` still contains the old `switch(effectKey)` until migration is complete.

Steps:
1. Pick a new effect `type` (e.g. `'poison'`).
2. Implement it in `effects_registry.js` under `EffectTypeRegistry`.
3. Reference it from a card via `effects: [{ trigger: '...', type: '...', ...params }]`.
4. If the effect introduces a new status/counter, add it to `getBaseStatuses()` (in `core.js`).

---

## Adding a new character

In `data.js`:
1. Add a new entry to `classData`:
   - `maxHp` (optional; defaults to 40)
   - `maxStam`
   - `armor`
   - `passiveDesc`
   - `premise` *(recommended)*: short “character premise” shown in hover tooltips (used by both TCG and Fighting views)
   - `deck: [...]`
2. Add a portrait entry to `charImages`.
3. If the character has abilities, add them to `getAbilityCard(className, index)` (see `core.js`).

---

## Status keywords: FREEZE, BLEED, POISON

These are implemented as counters under `state.<side>.statuses` (e.g. `state.player.statuses.poison`).

- **FREEZE**: existing freeze behavior (counters/limits) and UI badge.
- **BLEED**: stored as `statuses.bleed`. When the character is hit by an **ATTACK**, bleed detonates for extra damage (then is reduced/cleared according to the effect rules).
- **POISON**: stored as `statuses.poison`. Ticks at **turn end** dealing damage, then decreases.

If you add new status keywords, ensure:
1) they exist in `getBaseStatuses()`
2) you define how/when they tick in `resolution.js`
3) you include them in `formatKeywords()` so tooltips work

---

## Notes on scaling (what to change next)

This split is a **safe refactor**: it keeps the same runtime model but makes the code easier to navigate.

For a large team + a big content pipeline (hundreds of cards with synergies) you will likely want these fundamental upgrades:

### 1) Make the engine fully deterministic + server-authoritative (for online 1v1)
We’ve started this direction with `engine_runtime.js`. Next steps:
- expand `EngineRuntime.step()` until **all** rule logic is pure
- replace remaining `Math.random()` uses with the seeded RNG
- move DOM writes behind event handlers only
- server runs the same `step()` and streams events to clients

### 2) Finish migrating effects to the registry
Move cases from the legacy switch in `resolution.js` into `effects_registry.js` incrementally.

### 3) Expand event types (Talishar-style)
Right now the event system is mostly UX (log/sound/floaters). Next:
- `CARD_PLAYED`, `DAMAGE_DEALT`, `STATUS_APPLIED`, `TURN_START`, ...
- trigger/interrupt pipeline for reaction cards

### 4) Move to TypeScript + bundling
- Use TS for reliability and refactor safety
- Introduce unit tests for rules interactions
- Add linting and CI

---

## Refactor status

- ✅ `engine.js` split into multiple files (loaded in `index.html`)
- ✅ Legacy engine preserved as `engine_legacy.js`
- ✅ Action Queue + Event Log introduced (`engine_runtime.js`)
- ✅ First effects moved to registry (`effects_registry.js`)
- ✅ Tiny console test harness (`SplitSecondsTest.run()`)
- ✅ Clear documentation for contributors

Next steps can be done incrementally without changing UX.
