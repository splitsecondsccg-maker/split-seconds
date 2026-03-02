# Adding new characters (and their decks)

This project is **data-driven**:

- **Cards** live in `data.js` under `CardsDB`.
- **Decks** live in `data.js` under `DecksDB`.
- **Characters** live in `data.js` under `CharactersDB` (also exported as `classData`).
- The character rosters (both **TCG View** and **Fighting View**) are built automatically from `CharactersDB`.

So, in most cases, adding a new character means **only editing `data.js` + adding an image file**.

---

## 1) Add the portrait image

1. Put the image in the project folder next to the existing portraits.
2. Add it to the `charImages` map in `data.js`:

```js
const charImages = {
  // ...
  "My New Character": "my_new_character.png"
};
```

> Keep the aspect ratio roughly portrait-like (most current portraits are tall).

---

## 2) Add the character entry

In `data.js`, add a new entry under `CharactersDB`:

```js
const CharactersDB = {
  // ...
  "My New Character": {
    maxHp: 40,           // optional (defaults to 40 if omitted)
    maxStam: 7,
    armor: 3,

    passiveDesc: "A short passive description that appears in the UI.",
    premise: "A longer pitch that appears as a tooltip when hovering the character.",

    deckIds: ["my_character_deck_a", "my_character_deck_b"],
    defaultDeckId: "my_character_deck_a",

    // Abilities are also data-driven: point to ability cardIds in CardsDB.
    abilityIds: {
      1: "ability_mychar_1",
      2: "ability_mychar_2"
    }
  }
};
```

Notes:
- `premise` is used for the tooltip in **TCG View** and for the fighting view flavor.
- `deckIds` is the list of *built-in* decks. Custom decks created via the Deck Builder are added automatically.

---

## 3) Add ability cards

Ability cards are regular card definitions in `CardsDB`, but marked with `isAbility: true` and typically `isBasic: true`.

Example:

```js
const CardsDB = {
  // ...
  ability_mychar_1: {
    id: "ability_mychar_1",
    name: "My Ability 1",
    type: "utility",
    cost: 0,
    moments: 1,
    dmg: 0,
    desc: "Describe the effect.",
    effect: "gain_stam_1", // can be a legacy effect string or use the `effects` array
    isBasic: true,
    isAbility: true
  },

  ability_mychar_2: {
    id: "ability_mychar_2",
    name: "My Ability 2",
    type: "attack",
    cost: 1,
    moments: 2,
    dmg: 4,
    desc: "Describe the effect.",
    isBasic: true,
    isAbility: true
  }
};
```

---

## 4) Add new cards

Add each card to `CardsDB` with a **globally unique** `id`.

Example (using the new keyword system):

```js
const CardsDB = {
  // ...
  mychar_bleeding_slash: {
    id: "mychar_bleeding_slash",
    name: "Bleeding Slash",
    type: "attack",
    cost: 1,
    moments: 1,
    dmg: 2,
    desc: "2 DMG. On hit: BLEED 3.",
    effects: [{ trigger: "on_hit", type: "bleed", value: 3 }]
  }
};
```

Supported keyword effect types (see `effects_registry.js`):
- `poison` (applies POISON stacks)
- `bleed` (applies BLEED stacks)
- plus other effect types used in the game

You can also use legacy string effects like `effect: "heal_3"` for existing behaviors.

---

## 5) Create one or more decks for that character

Add deck definitions under `DecksDB`:

```js
const DecksDB = {
  // ...
  my_character_deck_a: {
    id: "my_character_deck_a",
    name: "My Character — Classic",
    character: "My New Character",
    description: "What this deck tries to do.",
    cards: [
      { cardId: "mychar_bleeding_slash", copies: 4 },
      { cardId: "rogue_quick_jab", copies: 2 } // decks can reuse ANY cardId from CardsDB
    ]
  }
};
```

Then make sure the deckId appears in the character’s `deckIds` list.

---

## 6) Optional: use the Deck Builder instead

You can also:
1. Launch the game
2. Click **Deck Builder**
3. Choose the character
4. Add cards and click **Save**

This creates a **custom deck** stored in your browser (localStorage) and shows it in the deck picker automatically.

---

## Common gotchas

- **Unique IDs:** every `CardsDB` entry must have a unique `id`.
- **Remember to add `charImages`:** if a character has no image mapping, the roster will still appear, but it won’t render correctly.
- **Ability cards:** must be referenced by `abilityIds` and should have `isAbility: true` so they don’t appear in Deck Builder.
