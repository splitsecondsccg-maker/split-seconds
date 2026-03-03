# Proficiency system

Each character has **proficiencies** (class + talents).  
Each card can define `requirements` to control deck legality.

## Character proficiencies

In `data.js`, each character includes:

- `class`: one primary tag (e.g. `assassin`, `warrior`, `brute`, `wizard`, `spirit`)
- `talents`: extra tags (e.g. `darkness`, `poison`, `light`, `bleed`, `vampire`, `ice`, `hypnotic`, `sorcerer`)

The character's proficiency set is:
`{ class } ∪ talents`

## Card requirements

Each card entry in `CardsDB` can include:

### Generic (no requirements)
Omit `requirements` or set it to `null`.

### AND requirement
```js
requirements: { all: ["poison", "assassin"] }
```

### OR-of-AND groups
```js
requirements: {
  any: [
    { all: ["wizard", "ice"] },
    { all: ["sorcerer", "ice"] }
  ]
}
```

## Enforcement

- The Deck Builder disables illegal cards for the chosen character and shows requirement icons.
- Built-in decks are auto-cleaned at runtime: illegal cards are removed when building a deck.

## Icons

`data.js` exposes `window.ProficiencyIcons`.  
To change an icon (e.g. vampire), edit that map.
