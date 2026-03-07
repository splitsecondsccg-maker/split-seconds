// data.js
// Runtime data APIs and persistence layer.
// Content is split into:
// - data/cards.data.js
// - data/decks.data.js
// - data/characters.data.js

(function () {
  'use strict';

  const CardsDB = JSON.parse(JSON.stringify(window.SS_CARDS_DATA || {}));
  const DecksDB = JSON.parse(JSON.stringify(window.SS_DECKS_DATA || {}));
  const CharactersDB = JSON.parse(JSON.stringify(window.SS_CHARACTERS_DATA || {}));
  const charImages = JSON.parse(JSON.stringify(window.SS_CHAR_IMAGES || {}));
  const ProficiencyIcons = JSON.parse(JSON.stringify(window.SS_PROFICIENCY_ICONS || {}));

  if (!Object.keys(CardsDB).length || !Object.keys(DecksDB).length || !Object.keys(CharactersDB).length) {
    console.error('Data files missing. Ensure cards/decks/characters data scripts are loaded before data.js');
  }

  const classData = CharactersDB;

  const CUSTOM_CARDS_KEY = 'ss_custom_cards_v1';
  const BuiltinCardsDB = JSON.parse(JSON.stringify(CardsDB));
  const CUSTOM_CHARACTERS_KEY = 'ss_custom_characters_v1';
  const BuiltinCharactersDB = JSON.parse(JSON.stringify(CharactersDB));

  function loadCustomCardsMap() {
    try {
      const raw = localStorage.getItem(CUSTOM_CARDS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      return parsed;
    } catch (e) {
      console.warn('Failed to load custom cards:', e);
      return {};
    }
  }

  function saveCustomCardsMap(map) {
    try {
      localStorage.setItem(CUSTOM_CARDS_KEY, JSON.stringify(map || {}));
    } catch (e) {
      console.warn('Failed to save custom cards:', e);
    }
  }

  function applyCustomCardsToDB() {
    const custom = loadCustomCardsMap();
    for (const [id, def] of Object.entries(custom)) {
      if (!id || !def || typeof def !== 'object') continue;
      CardsDB[id] = { ...CardsDB[id], ...def, id };
    }
  }

  function upsertCustomCard(cardDef) {
    if (!cardDef || typeof cardDef !== 'object') return null;
    const id = String(cardDef.id || '').trim();
    if (!id) return null;

    const cleaned = {
      ...cardDef,
      id,
      name: String(cardDef.name || id),
      type: String(cardDef.type || 'attack'),
      cost: Math.max(0, Number(cardDef.cost) || 0),
      moments: Math.max(0, Number(cardDef.moments) || 0),
      dmg: Math.max(0, Number(cardDef.dmg) || 0),
      desc: String(cardDef.desc || '')
    };

    const custom = loadCustomCardsMap();
    custom[id] = cleaned;
    saveCustomCardsMap(custom);
    CardsDB[id] = { ...CardsDB[id], ...cleaned };
    return CardsDB[id];
  }

  function deleteCustomCard(cardId) {
    const id = String(cardId || '').trim();
    if (!id) return false;

    const custom = loadCustomCardsMap();
    if (!custom[id]) return false;
    delete custom[id];
    saveCustomCardsMap(custom);

    if (BuiltinCardsDB[id]) CardsDB[id] = JSON.parse(JSON.stringify(BuiltinCardsDB[id]));
    else delete CardsDB[id];

    return true;
  }

  function isCustomCard(cardId) {
    const custom = loadCustomCardsMap();
    return !!custom[String(cardId || '')];
  }

  applyCustomCardsToDB();
  function loadCustomCharactersMap() {
    try {
      const raw = localStorage.getItem(CUSTOM_CHARACTERS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      return parsed;
    } catch (e) {
      console.warn('Failed to load custom characters:', e);
      return {};
    }
  }

  function saveCustomCharactersMap(map) {
    try {
      localStorage.setItem(CUSTOM_CHARACTERS_KEY, JSON.stringify(map || {}));
    } catch (e) {
      console.warn('Failed to save custom characters:', e);
    }
  }

  function applyCustomCharactersToDB() {
    const custom = loadCustomCharactersMap();
    for (const [charName, patch] of Object.entries(custom)) {
      if (!charName || !patch || typeof patch !== 'object') continue;
      if (!CharactersDB[charName]) continue;
      CharactersDB[charName] = { ...CharactersDB[charName], ...patch };
      classData[charName] = CharactersDB[charName];
    }
  }

  function upsertCustomCharacter(charName, patch) {
    const key = String(charName || '').trim();
    if (!key || !CharactersDB[key] || !patch || typeof patch !== 'object') return null;

    const cleaned = { ...patch };
    if (Object.prototype.hasOwnProperty.call(cleaned, 'displayName')) {
      cleaned.displayName = String(cleaned.displayName || '').trim();
    }
    if (cleaned.abilityIds && typeof cleaned.abilityIds === 'object') {
      cleaned.abilityIds = {
        1: String(cleaned.abilityIds[1] || cleaned.abilityIds['1'] || '').trim(),
        2: String(cleaned.abilityIds[2] || cleaned.abilityIds['2'] || '').trim()
      };
    }

    const custom = loadCustomCharactersMap();
    custom[key] = { ...(custom[key] || {}), ...cleaned };
    saveCustomCharactersMap(custom);

    CharactersDB[key] = { ...CharactersDB[key], ...cleaned };
    classData[key] = CharactersDB[key];
    return CharactersDB[key];
  }

  function deleteCustomCharacter(charName) {
    const key = String(charName || '').trim();
    if (!key) return false;
    const custom = loadCustomCharactersMap();
    if (!custom[key]) return false;
    delete custom[key];
    saveCustomCharactersMap(custom);
    if (BuiltinCharactersDB[key]) {
      CharactersDB[key] = JSON.parse(JSON.stringify(BuiltinCharactersDB[key]));
      classData[key] = CharactersDB[key];
    }
    return true;
  }

  function isCustomCharacter(charName) {
    const custom = loadCustomCharactersMap();
    return !!custom[String(charName || '')];
  }

  function getCharacterDisplayName(charName) {
    const c = CharactersDB?.[charName];
    const dn = c?.displayName;
    return (typeof dn === 'string' && dn.trim()) ? dn.trim() : String(charName || '');
  }

  applyCustomCharactersToDB();

  const CUSTOM_DECKS_KEY = 'ss_custom_decks_v1';


  function loadCustomDecksMap() {
    try {
      const raw = localStorage.getItem(CUSTOM_DECKS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      return parsed;
    } catch (e) {
      console.warn('Failed to load custom decks:', e);
      return {};
    }
  }

  function saveCustomDecksMap(map) {
    try {
      localStorage.setItem(CUSTOM_DECKS_KEY, JSON.stringify(map || {}));
    } catch (e) {
      console.warn('Failed to save custom decks:', e);
    }
  }

  function isCustomDeckId(deckId) {
    return typeof deckId === 'string' && deckId.startsWith('custom_');
  }

  function getDeckDef(deckId) {
    if (!deckId) return null;
    if (DecksDB[deckId]) return DecksDB[deckId];
    const custom = loadCustomDecksMap();
    return custom?.[deckId] || null;
  }

  function listCustomDecksForCharacter(charName) {
    const custom = loadCustomDecksMap();
    return Object.values(custom)
      .filter((d) => d && d.character === charName)
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }

  function upsertCustomDeck(deckDef) {
    if (!deckDef || typeof deckDef !== 'object') return null;
    const id = String(deckDef.id || '');
    if (!isCustomDeckId(id)) {
      console.warn('Custom deck id must start with custom_:', id);
      return null;
    }
    const custom = loadCustomDecksMap();
    custom[id] = {
      id,
      name: String(deckDef.name || 'Custom Deck'),
      character: String(deckDef.character || ''),
      description: String(deckDef.description || ''),
      cards: Array.isArray(deckDef.cards) ? deckDef.cards : []
    };
    saveCustomDecksMap(custom);
    return custom[id];
  }

  function deleteCustomDeck(deckId) {
    if (!isCustomDeckId(deckId)) return false;
    const custom = loadCustomDecksMap();
    if (!custom[deckId]) return false;
    delete custom[deckId];
    saveCustomDecksMap(custom);
    return true;
  }


  function getCharacterProficiencies(charName) {
    const c = CharactersDB?.[charName] || classData?.[charName];
    if (!c) return new Set();
    const set = new Set();
    if (c.class) set.add(String(c.class).toLowerCase());
    for (const t of c.talents || []) set.add(String(t).toLowerCase());
    return set;
  }

  function isRequirementsSatisfied(req, profSet) {
    if (!req) return true;
    if (req.all) {
      return req.all.every((p) => profSet.has(String(p).toLowerCase()));
    }
    if (req.any) {
      return req.any.some((group) => (group.all || []).every((p) => profSet.has(String(p).toLowerCase())));
    }
    return true;
  }

  function isCardLegalForCharacter(cardOrId, charName) {
    const card = typeof cardOrId === 'string' ? CardsDB?.[cardOrId] : cardOrId;
    if (!card) return false;
    const prof = getCharacterProficiencies(charName);
    return isRequirementsSatisfied(card.requirements, prof);
  }

  function buildDeckFromDeckId(deckId) {
    const def = getDeckDef(deckId);
    if (!def) {
      console.warn('Deck not found:', deckId);
      return [];
    }

    const deck = [];
    let counter = 0;
    for (const entry of def.cards || []) {
      const base = CardsDB[entry.cardId];
      if (!base) {
        console.warn('Card not found:', entry.cardId, 'in deck', deckId);
        continue;
      }

      const deckCharName = def.character || def.characterName || def.charName || null;
      if (deckCharName && !isCardLegalForCharacter(base, deckCharName)) {
        console.warn('Illegal card removed from deck:', entry.cardId, 'for', deckCharName, 'in deck', deckId);
        continue;
      }

      const copies = Math.max(0, Number(entry.copies) || 0);
      for (let i = 0; i < copies; i++) {
        counter++;
        deck.push({
          ...base,
          dmg: base.dmg || 0,
          currentBlock: typeof base.currentBlock === 'number' ? base.currentBlock : undefined,
          uniqueId: base.id + '_' + counter,
          _deckId: def.id
        });
      }
    }
    return deck;
  }


  function getDecksForCharacter(charName) {
    const c = CharactersDB[charName];
    const builtinIds = c?.deckIds || [];
    const builtin = builtinIds.map((id) => DecksDB[id]).filter(Boolean);
    const custom = listCustomDecksForCharacter(charName);
    return [...builtin, ...custom];
  }

  function getDefaultDeckIdForCharacter(charName) {
    const c = CharactersDB[charName];
    return c?.defaultDeckId || c?.deckIds?.[0] || null;
  }

  function pickRandomDeckIdForCharacter(charName) {
    const decks = getDecksForCharacter(charName);
    if (!decks || decks.length === 0) return null;
    return decks[Math.floor(Math.random() * decks.length)].id;
  }

  function getCharacterList() {
    return Object.keys(CharactersDB);
  }

  function getAbilityIdForCharacter(charName, index) {
    const c = CharactersDB[charName];
    return c?.abilityIds?.[index] || null;
  }

  window.CardsDB = CardsDB;
  window.DecksDB = DecksDB;
  window.CharactersDB = CharactersDB;
  window.classData = classData;
  window.charImages = charImages;
  window.ProficiencyIcons = ProficiencyIcons;

  window.buildDeckFromDeckId = buildDeckFromDeckId;
  window.isCardLegalForCharacter = isCardLegalForCharacter;
  window.isRequirementsSatisfied = isRequirementsSatisfied;
  window.getCharacterProficiencies = getCharacterProficiencies;
  window.getDecksForCharacter = getDecksForCharacter;
  window.getDefaultDeckIdForCharacter = getDefaultDeckIdForCharacter;
  window.pickRandomDeckIdForCharacter = pickRandomDeckIdForCharacter;
  window.getCharacterList = getCharacterList;

  window.getDeckDef = getDeckDef;
  window.isCustomDeckId = isCustomDeckId;
  window.upsertCustomDeck = upsertCustomDeck;
  window.deleteCustomDeck = deleteCustomDeck;
  window.listCustomDecksForCharacter = listCustomDecksForCharacter;

  window.loadCustomCardsMap = loadCustomCardsMap;
  window.upsertCustomCard = upsertCustomCard;
  window.deleteCustomCard = deleteCustomCard;
  window.isCustomCard = isCustomCard;
  window.BuiltinCardsDB = BuiltinCardsDB;
  window.BuiltinCharactersDB = BuiltinCharactersDB;

  window.getAbilityIdForCharacter = getAbilityIdForCharacter;
  window.loadCustomCharactersMap = loadCustomCharactersMap;
  window.upsertCustomCharacter = upsertCustomCharacter;
  window.deleteCustomCharacter = deleteCustomCharacter;
  window.isCustomCharacter = isCustomCharacter;
  window.getCharacterDisplayName = getCharacterDisplayName;
})();





