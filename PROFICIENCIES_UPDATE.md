# Proficiency & Deck Legality Update

This update implements **character proficiencies** (class + talents) and enforces **deck/card legality** in the Deck Builder and during deck expansion.

## What stayed the same
- **Project structure** and file names are unchanged.
- `index.html` still loads the same script list in the same order (per README).
- The split engine architecture remains intact.

## Character changes
- Renamed the **character** `Brute` to **`Mauja`**.
  - The **proficiency** `brute` still exists as a class key.
  - Portrait uses the existing `brute.png`.

## New data fields (data.js)
Each character now has:
- `classKey` (string)
- `talents` (string array)

Proficiency sets:
- Rogue: `assassin`, `darkness`, `poison`
- Mauja: `brute`, `poison`
- Paladin: `warrior`, `light`
- Vampiress: `assassin`, `vampire`, `bleed`
- Necromancer: `wizard`, `darkness`, `poison`, `hypnotic`
- Ice Djinn: `spirit`, `ice`, `sorcerer`

## Card legality model (data.js)
Cards can optionally define `requirements`:
- `undefined` => legal for everyone
- `{ all: [..] }` => must have all proficiencies
- `{ any: [ {all:[..]}, {all:[..]} ] }` => OR of AND-clauses

Implemented per your spec:
- **Scare**: `assassin OR darkness`
- **Ice Spear / Ice Wall**: `(wizard+ice) OR (sorcerer+ice)`

## Enforcement points
- **Deck Builder**
  - Only shows cards legal for the currently selected character.
  - Shows requirement icons in the card list.
  - Prevents saving a custom deck if it contains illegal cards.
- **Deck expansion fail-safe**
  - `buildDeckFromDeckId()` skips illegal cards and logs a warning.

## UI additions
- Added `window.ProficiencyIcons` mapping for:
  - warrior ⚔️, light ✨, brute 👊, assassin 🗡️, sorcerer 🪄, spirit 👻
  - plus: wizard 📜, darkness 🌑, poison ☠️, vampire 🩸, bleed 🩸, hypnotic 🌀, ice ❄️

The Deck Builder summary line shows the selected character's proficiency icons.
