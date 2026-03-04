// data.js
//
// Split Seconds content registries.
//
// Goal:
// - make cards shareable across characters
// - allow multiple decks per character
// - support a lightweight Deck Builder (custom decks stored in localStorage)
//
// - CardsDB: canonical card definitions (shared across decks)
// - DecksDB: built-in deck lists (a character + list of cardIds + copies)
// - CharactersDB (aka classData): character stats + passive + which deckIds they can use
//
// NOTE: Keep this file mostly data-only. Game logic should live in core/ui/game/resolution.

(function () {
  "use strict";

  // ------------------------
  // 1) Cards
  // ------------------------
  /** @type {Record<string, any>} */
  const CardsDB = {
    // Rogue
    rogue_quick_jab:        { id: "rogue_quick_jab", name: "Quick Jab", type: "attack", cost: 0, moments: 1, dmg: 2, desc: "A fast, free strike." },
    rogue_flurry:           { id: "rogue_flurry", name: "Flurry", type: "attack", cost: 1, moments: 1, dmg: 3, desc: "Standard assassin strike." },
    rogue_lunging_dagger:   { id: "rogue_lunging_dagger", name: "Lunging Dagger", type: "attack", cost: 1, moments: 2, dmg: 4, desc: "Sacrifices time for reach." , requirements: {'all': ['assassin']}},
    rogue_cutthroat:        { id: "rogue_cutthroat", name: "Cutthroat", type: "attack", cost: 4, moments: 1, dmg: 6, desc: "Never trust a rogue..." , requirements: {'all': ['assassin']}},
    rogue_kidney_strike:    { id: "rogue_kidney_strike", name: "Kidney Strike", type: "grab", cost: 1, moments: 1, dmg: 3, desc: "Destroys 1 enemy Stamina on hit.", effects: [{ trigger: "on_hit", type: "exhaust_1", value: 1 }] , requirements: {'all': ['assassin']}},
    rogue_sharpen:          { id: "rogue_sharpen", name: "Sharpen", type: "buff", cost: 1, moments: 1, dmg: 0, desc: "+3 DMG to next Attack.", effects: [{ trigger: "on_play", type: "buff_next_atk_3", value: 1 }] },

    // Brute
    brute_heavy_strike:     { id: "brute_heavy_strike", name: "Heavy Strike", type: "attack", cost: 2, moments: 1, dmg: 3, desc: "Drains stamina, hits hard." , requirements: {'all': ['brute']}},
    brute_cleave:           { id: "brute_cleave", name: "Cleave", type: "attack", cost: 2, moments: 2, dmg: 5, desc: "Wide, heavy swing." , requirements: {'all': ['brute']}},
    brute_dev_blow:         { id: "brute_dev_blow", name: "Devastating Blow", type: "attack", cost: 3, moments: 3, dmg: 9, desc: "Massive, slow attack." , requirements: {'all': ['brute']}},
    brute_suplex:           { id: "brute_suplex", name: "Suplex", type: "grab", cost: 2, moments: 2, dmg: 6, desc: "Massive punish for blocking." , requirements: {'all': ['brute']}},
    brute_sunder:           { id: "brute_sunder", name: "Sunder", type: "attack", cost: 2, moments: 1, dmg: 2, desc: "Enemy loses 2 Armor this turn.", effects: [{ trigger: "on_play", type: "sunder", value: 1 }] },
    brute_warcry:           { id: "brute_warcry", name: "Warcry", type: "buff", cost: 2, moments: 2, dmg: 0, desc: "+5 DMG to next Attack.", effects: [{ trigger: "on_play", type: "buff_next_atk_5", value: 1 }] , requirements: {'all': ['brute']}},

    // Paladin
    paladin_standard_strike:{ id: "paladin_standard_strike", name: "Standard Strike", type: "attack", cost: 1, moments: 1, dmg: 2, desc: "Reliable weapon swing." },
    paladin_shield_bash:    { id: "paladin_shield_bash", name: "Shield Bash", type: "grab", cost: 2, moments: 1, dmg: 4, desc: "High burst against defenders." , requirements: {'all': ['warrior']}},
    paladin_pummel:         { id: "paladin_pummel", name: "Pummel", type: "attack", cost: 2, moments: 2, dmg: 4, desc: "Heavy swing." , requirements: {'all': ['warrior']}},
    paladin_medic_light:    { id: "paladin_medic_light", name: "Medic Light", type: "buff", cost: 1, moments: 1, dmg: 0, desc: "Heals 3 HP.", effects: [{ trigger: "on_play", type: "heal_3", value: 1 }] , requirements: {'all': ['light']}},
    paladin_bless:          { id: "paladin_bless", name: "Bless", type: "buff", cost: 1, moments: 1, dmg: 0, desc: "+3 DMG to next Attack.", effects: [{ trigger: "on_play", type: "buff_next_atk_3", value: 1 }] , requirements: {'all': ['light']}},
    paladin_holy_smite:     { id: "paladin_holy_smite", name: "Holy Smite", type: "attack", cost: 3, moments: 2, dmg: 7, desc: "By the Holy light." , requirements: {'all': ['light']}},

    // Vampiress
    vamp_claw_swipe:        { id: "vamp_claw_swipe", name: "Claw Swipe", type: "attack", cost: 0, moments: 1, dmg: 2, desc: "A fast, free scratch." },
    vamp_siphon_strike:     { id: "vamp_siphon_strike", name: "Siphon Strike", type: "attack", cost: 1, moments: 1, dmg: 2, desc: "Deals 2 DMG, Heals 1 HP if succeeded.", effects: [{ trigger: "on_hit", type: "heal_1_on_hit", value: 1 }] , requirements: {'all': ['bleed']}},
    vamp_vampiric_bite:     { id: "vamp_vampiric_bite", name: "Vampiric Bite", type: "grab", cost: 1, moments: 1, dmg: 3, desc: "Deals 3 DMG, Heals 1 HP if succeeded.", effects: [{ trigger: "on_hit", type: "heal_1_on_hit", value: 1 }] , requirements: {'all': ['vampire']}},
    vamp_lethal_embrace:    { id: "vamp_lethal_embrace", name: "Lethal Embrace", type: "grab", cost: 2, moments: 2, dmg: 7, desc: "Deals 6 DMG, Heals 2 HP if succeeded.", effects: [{ trigger: "on_hit", type: "heal_2_on_hit", value: 1 }] , requirements: {'all': ['vampire']}},
    vamp_hypnotic_gaze:     { id: "vamp_hypnotic_gaze", name: "Hypnotic Gaze", type: "buff", cost: 1, moments: 1, dmg: 0, desc: "Steal 1 Stamina from the enemy.", effects: [{ trigger: "on_play", type: "steal_stam", value: 1 }] , requirements: {'all': ['hypnotic']}},

    // Necromancer
    necro_scare:            { id: "necro_scare", name: "Scare", type: "buff", cost: 0, moments: 1, dmg: 0, desc: "Draw 1. Opponent MUST block next turn.", effects: [{ trigger: "on_play", type: "scare", value: 1 }], requirements: {'any': [{'all': ['assassin']}, {'all': ['darkness']}]}},
    necro_siphon_soul:      { id: "necro_siphon_soul", name: "Siphon Soul", type: "grab", cost: 1, moments: 2, dmg: 3, desc: "Upon hit: Next attack gains +3 DMG.", effects: [{ trigger: "on_hit", type: "siphon_soul", value: 1 }], requirements: {'all': ['wizard', 'darkness']}},
    necro_chiller:          { id: "necro_chiller", name: "Chiller", type: "grab", cost: 1, moments: 1, dmg: 2, desc: "Upon hit: Opponent recovers 1 less Stam next turn.", effects: [{ trigger: "on_hit", type: "chiller", value: 1 }], requirements: {'all': ['ice']}},
    necro_skull_blast:      { id: "necro_skull_blast", name: "Skull Blast", type: "attack", cost: 2, moments: 1, dmg: 4, desc: "Fast magic projectile." , requirements: {'all': ['wizard', 'darkness']}},
    necro_necro_blast:      { id: "necro_necro_blast", name: "Necro Blast", type: "attack", cost: 4, moments: 2, dmg: 8, desc: "Massive energy blast." , requirements: {'all': ['wizard', 'darkness']}},
    necro_bone_cage:        { id: "necro_bone_cage", name: "Bone Cage", type: "block", cost: 1, moments: 3, dmg: 0, desc: "Blocks up to 6 total DMG over 3 moments.", currentBlock: 6 , requirements: {'all': ['wizard', 'darkness']}},

    // Ice Djinn
    ice_cold_wind:          { id: "ice_cold_wind", name: "Cold Wind", type: "buff", cost: 0, moments: 1, dmg: 0, desc: "Apply FREEZE 1. Draw 1.", effects: [{ trigger: "on_play", type: "cold_wind", value: 1 }], requirements: {'all': ['ice']}},
    ice_ice_spear:          { id: "ice_ice_spear", name: "Ice Spear", type: "attack", cost: 2, moments: 2, dmg: 5, desc: "5 DMG. On hit: FREEZE 1.", effects: [{ trigger: "on_hit", type: "freeze_1_on_hit", value: 1 }], requirements: {'any': [{'all': ['wizard', 'ice']}, {'all': ['sorcerer', 'ice']}]}},
    ice_break_the_ice:      { id: "ice_break_the_ice", name: "Break the Ice", type: "grab", cost: 2, moments: 1, dmg: 2, desc: "2 DMG. On hit: Remove all FREEZE on opponent. Deal that much DMG.", effects: [{ trigger: "on_hit", type: "break_the_ice", value: 1 }], requirements: {'all': ['ice']}},
    ice_ice_wall:           { id: "ice_ice_wall", name: "Ice Wall", type: "block", cost: 3, moments: 3, dmg: 0, desc: "Blocks up to 8 total DMG over 3 moments. Each time it blocks an attack: FREEZE 1.", currentBlock: 8, effects: [{ trigger: "on_block", type: "freeze", value: 1 }], requirements: {'any': [{'all': ['wizard', 'ice']}, {'all': ['sorcerer', 'ice']}]}},

    // ------------------------
    // Keyword cards (POISON / BLEED)
    // ------------------------

    // Necromancer — Poison deck cards
    necro_venom_bolt: {
      id: "necro_venom_bolt",
      name: "Venom Bolt",
      type: "attack",
      cost: 1,
      moments: 1,
      dmg: 2,
      desc: "2 DMG. On hit: POISON 3.",
      effects: [{ trigger: "on_hit", type: "poison", value: 3 }],
      requirements: { all: ["wizard", "poison"] }
    },
    necro_plague_grip: {
      id: "necro_plague_grip",
      name: "Plague Grip",
      type: "grab",
      cost: 1,
      moments: 1,
      dmg: 2,
      desc: "2 DMG. On hit: POISON 2.",
      effects: [{ trigger: "on_hit", type: "poison", value: 2 }],
      requirements: { all: ["wizard", "poison"] }
    },
    necro_necrotic_rot: {
      id: "necro_necrotic_rot",
      name: "Necrotic Rot",
      type: "attack",
      cost: 2,
      moments: 2,
      dmg: 4,
      desc: "4 DMG. On hit: POISON 4.",
      effects: [{ trigger: "on_hit", type: "poison", value: 4 }],
      requirements: { all: ["wizard", "poison"] }
    },
    toxic_rain: {
      id: "toxic_rain",
      name: "Toxic Rain",
      type: "buff",
      cost: 2,
      moments: 2,
      dmg: 0,
      desc: "POISON 6.",
      effects: [{ trigger: "on_play", type: "poison", value: 6 }],
      requirements: { all: ["poison"] }
    },

    // Vampiress — Bleed deck cards
    vamp_rending_claw: {
      id: "vamp_rending_claw",
      name: "Rending Claw",
      type: "attack",
      cost: 1,
      moments: 1,
      dmg: 1,
      desc: "1 DMG. On hit: BLEED 3.",
      effects: [{ trigger: "on_hit", type: "bleed", value: 3 }],
      requirements: { all: ["bleed"] }
    },
    vamp_crimson_grapple: {
      id: "vamp_crimson_grapple",
      name: "Crimson Grapple",
      type: "grab",
      cost: 1,
      moments: 1,
      dmg: 3,
      desc: "3 DMG. On hit: BLEED 2.",
      effects: [{ trigger: "on_hit", type: "bleed", value: 2 }],
      requirements: { all: ["bleed"] }
    },
    vamp_artery_rip: {
      id: "vamp_artery_rip",
      name: "Artery Bite",
      type: "grab",
      cost: 2,
      moments: 2,
      dmg: 4,
      desc: "4 DMG. On hit: BLEED 4.",
      effects: [{ trigger: "on_hit", type: "bleed", value: 4 }],
      requirements: { all: ["bleed"] }
    },

    // ------------------------
    // Character abilities (not part of main deck)
    // Marked with isAbility so Deck Builder can hide them.
    // ------------------------

    ability_rogue_1: { id: "ability_rogue_1", name: "Quick Step", type: "utility", cost: 0, moments: 1, dmg: 0, desc: "Gain 1 Stamina", effects: [{ trigger: "on_play", type: "gain_stam_1", value: 1 }], isBasic: true, isAbility: true , requirements: {'all': ['assassin']}},
    ability_rogue_2: { id: "ability_rogue_2", name: "Poison Dagger", type: "attack", cost: 0, moments: 1, dmg: 1, desc: "On hit: Deal 1 extra poison DMG", effects: [{ trigger: "on_hit", type: "poison_dagger", value: 1 }], isBasic: true, isAbility: true , requirements: {'all': ['assassin']}},

    ability_brute_1: { id: "ability_brute_1", name: "Enrage", type: "utility", cost: 0, moments: 2, dmg: 0, desc: "Gain 2 Stamina", effects: [{ trigger: "on_play", type: "gain_stam_2", value: 1 }], isBasic: true, isAbility: true },
    ability_brute_2: { id: "ability_brute_2", name: "Heavy Blow", type: "attack", cost: 0, moments: 3, dmg: 4, desc: "Massive free strike", isBasic: true, isAbility: true },

    ability_paladin_1: { id: "ability_paladin_1", name: "Holy Light", type: "buff", cost: 1, moments: 1, dmg: 0, desc: "Heal 2 HP", effects: [{ trigger: "on_play", type: "heal_2", value: 1 }], isBasic: true, isAbility: true },
    ability_paladin_2: { id: "ability_paladin_2", name: "Holy Strike", type: "attack", cost: 0, moments: 2, dmg: 3, desc: "Standard free strike", isBasic: true, isAbility: true },

    ability_vampiress_1: { id: "ability_vampiress_1", name: "Blood Frenzy", type: "utility", cost: 0, moments: 1, dmg: 0, desc: "Draw 1 Card", effects: [{ trigger: "on_play", type: "draw_1", value: 1 }], isBasic: true, isAbility: true },
    ability_vampiress_2: { id: "ability_vampiress_2", name: "Draw Blood", type: "attack", cost: 0, moments: 1, dmg: 1, desc: "On hit: Next attack +1 DMG", effects: [{ trigger: "on_hit", type: "buff_next_atk_1", value: 1 }], isBasic: true, isAbility: true },

    ability_necromancer_1: { id: "ability_necromancer_1", name: "Meditate", type: "utility", cost: 0, moments: 2, dmg: 0, desc: "Draw 1, Gain 2 Stamina", effects: [{ trigger: "on_play", type: "meditate", value: 1 }], isBasic: true, isAbility: true },
    ability_necromancer_2: { id: "ability_necromancer_2", name: "Death Touch", type: "attack", cost: 1, moments: 2, dmg: 4, desc: "Cheap, deadly magic", isBasic: true, isAbility: true },

    ability_ice_djinn_1: { id: "ability_ice_djinn_1", name: "Spirit Form", type: "buff", cost: 1, moments: 1, dmg: 0, desc: "Next turn: +2 Armor", effects: [{ trigger: "on_play", type: "spirit_form", value: 1 }], isBasic: true, isAbility: true },
    ability_ice_djinn_2: { id: "ability_ice_djinn_2", name: "Ice Blast", type: "attack", cost: 3, moments: 3, dmg: 7, desc: "7 DMG. On hit: FREEZE 1", effects: [{ trigger: "on_hit", type: "freeze_1_on_hit", value: 1 }], isBasic: true, isAbility: true }
  };

  // ------------------------
  // 2) Built-in Decks
  // ------------------------
  /** @type {Record<string, any>} */
  const DecksDB = {
    rogue_base: {
      id: "rogue_base",
      name: "Rogue — Classic",
      character: "Rogue",
      description: "Fast, low-cost attacks with spike damage and strong tempo.",
      cards: [
        { cardId: "rogue_quick_jab", copies: 3 },
        { cardId: "rogue_flurry", copies: 3 },
        { cardId: "rogue_lunging_dagger", copies: 3 },
        { cardId: "rogue_cutthroat", copies: 3 },
        { cardId: "rogue_kidney_strike", copies: 4 },
        { cardId: "rogue_sharpen", copies: 6 }
      ]
    },

    brute_base: {
      id: "brute_base",
      name: "Brute — Classic",
      character: "Mauja",
      description: "Slow, heavy hits and huge payoffs.",
      cards: [
        { cardId: "brute_heavy_strike", copies: 3 },
        { cardId: "brute_cleave", copies: 3 },
        { cardId: "brute_dev_blow", copies: 2 },
        { cardId: "brute_suplex", copies: 2 },
        { cardId: "brute_sunder", copies: 3 },
        { cardId: "brute_warcry", copies: 2 }
      ]
    },

    paladin_base: {
      id: "paladin_base",
      name: "Paladin — Classic",
      character: "Paladin",
      description: "Defense, sustain, and punishing counter-attacks.",
      cards: [
        { cardId: "paladin_standard_strike", copies: 4 },
        { cardId: "paladin_shield_bash", copies: 4 },
        { cardId: "paladin_pummel", copies: 2 },
        { cardId: "paladin_medic_light", copies: 4 },
        { cardId: "paladin_bless", copies: 4 },
        { cardId: "paladin_holy_smite", copies: 2 }
      ]
    },

    vampiress_base: {
      id: "vampiress_base",
      name: "Vampiress — Classic",
      character: "Vampiress",
      description: "Grabs, lifesteal, and stamina disruption.",
      cards: [
        { cardId: "vamp_claw_swipe", copies: 4 },
        { cardId: "vamp_siphon_strike", copies: 4 },
        { cardId: "vamp_vampiric_bite", copies: 4 },
        { cardId: "vamp_lethal_embrace", copies: 3 },
        { cardId: "vamp_hypnotic_gaze", copies: 2 },
        { cardId: "necro_scare", copies: 5 }
      ]
    },

    // Vampiress — Bleed-focused deck
    vampiress_bleed: {
      id: "vampiress_bleed",
      name: "Vampiress — Hemorrhage",
      character: "Vampiress",
      description: "Set up BLEED counters, then land attacks to detonate them.",
      cards: [
        { cardId: "vamp_claw_swipe", copies: 3 },
        { cardId: "vamp_rending_claw", copies: 4 },
        { cardId: "vamp_artery_rip", copies: 3 },
        { cardId: "vamp_crimson_grapple", copies: 3 },
        { cardId: "vamp_vampiric_bite", copies: 3 },
        { cardId: "vamp_hypnotic_gaze", copies: 2 },
        { cardId: "necro_scare", copies: 3 }
      ]
    },

    necromancer_base: {
      id: "necromancer_base",
      name: "Necromancer — Classic",
      character: "Necromancer",
      description: "Status tricks and delayed nukes. Wants to apply any status to fuel the passive.",
      cards: [
        { cardId: "necro_scare", copies: 3 },
        { cardId: "necro_siphon_soul", copies: 2 },
        { cardId: "necro_chiller", copies: 3 },
        { cardId: "necro_skull_blast", copies: 3 },
        { cardId: "necro_necro_blast", copies: 2 },
        { cardId: "necro_bone_cage", copies: 2 }
      ]
    },

    // Necromancer — Poison-focused deck
    necromancer_poison: {
      id: "necromancer_poison",
      name: "Necromancer — Plague",
      character: "Necromancer",
      description: "Stack POISON early to bleed HP at end-of-turn and trigger the passive consistently.",
      cards: [
        { cardId: "necro_scare", copies: 2 },
        { cardId: "necro_plague_grip", copies: 4 },
        { cardId: "necro_venom_bolt", copies: 5 },
        { cardId: "necro_necrotic_rot", copies: 3 },
        { cardId: "necro_skull_blast", copies: 2 },
        { cardId: "necro_bone_cage", copies: 2 }
      ]
    },

    ice_djinn_base: {
      id: "ice_djinn_base",
      name: "Ice Djinn — Classic",
      character: "Ice Djinn",
      description: "Control with FREEZE, then burst for big damage.",
      cards: [
        { cardId: "ice_cold_wind", copies: 6 },
        { cardId: "ice_ice_spear", copies: 4 },
        { cardId: "ice_break_the_ice", copies: 2 },
        { cardId: "ice_ice_wall", copies: 4 }
      ]
    }
  };

  // ------------------------
  // 3) Characters (aka classData)
  // ------------------------
  /** @type {Record<string, any>} */
  const CharactersDB = {
    Rogue: {
      class: "assassin",
      talents: ["darkness"],
      maxStam: 7,
      armor: 2,
      passiveDesc: "Upon hit, opponent next attack has -1 DMG.",
      premise: "Fly like a butterfly, sting like a bee. Fast attacks, low costs, and sudden damage spikes.",
      deckIds: ["rogue_base"],
      defaultDeckId: "rogue_base",
      abilityIds: { 1: "ability_rogue_1", 2: "ability_rogue_2" }
    },
    Mauja: {
      class: "brute",
      talents: ["poison"],
      maxStam: 5,
      armor: 2,
      passiveDesc: "End of turn: If you lost life this turn, gain 1 Stamina.",
      premise: "The king of raw damage. Slow, devastating attacks that crush through defenses.",
      deckIds: ["brute_base"],
      defaultDeckId: "brute_base",
      abilityIds: { 1: "ability_brute_1", 2: "ability_brute_2" }
    },
    Paladin: {
      class: "warrior",
      talents: ["light"],
      maxStam: 6,
      armor: 4,
      passiveDesc: "Upon blocking an attack, your next attack gains +1 DMG.",
      premise: "The defensive powerhouse. High armor, strong sustain, and punishing blocks.",
      deckIds: ["paladin_base"],
      defaultDeckId: "paladin_base",
      abilityIds: { 1: "ability_paladin_1", 2: "ability_paladin_2" }
    },
    Vampiress: {
      class: "assassin",
      talents: ["vampire", "bleed"],
      maxStam: 7,
      armor: 3,
      passiveDesc: "Upon hit, your next attack gains +1 DMG this turn.",
      premise: "The relentless grappler. Bypasses shields with life-stealing grabs and forced blocks.",
      deckIds: ["vampiress_base", "vampiress_bleed"],
      defaultDeckId: "vampiress_base",
      abilityIds: { 1: "ability_vampiress_1", 2: "ability_vampiress_2" }
    },
    Necromancer: {
      class: "wizard",
      talents: ["darkness", "poison", "hypnotic"],
      maxStam: 7,
      armor: 2,
      passiveDesc: "End of turn: Gain 1 Stamina if you applied a status effect this turn.",
      premise: "The stamina-hungry joker. Feeds on status effects to fuel massive, delayed nukes.",
      deckIds: ["necromancer_base", "necromancer_poison"],
      defaultDeckId: "necromancer_base",
      abilityIds: { 1: "ability_necromancer_1", 2: "ability_necromancer_2" }
    },
    "Ice Djinn": {
      class: "spirit",
      talents: ["ice", "sorcerer"],
      maxHp: 37,
      maxStam: 7,
      armor: 3,
      passiveDesc: "Upon successful Parry: apply FREEZE 2 to the enemy.",
      premise: "A slow-burn control spirit. Stalls early with FREEZE and defensive magic, then bursts for huge damage later.",
      deckIds: ["ice_djinn_base"],
      defaultDeckId: "ice_djinn_base",
      abilityIds: { 1: "ability_ice_djinn_1", 2: "ability_ice_djinn_2" }
    }
  };

  // Backward-compatible alias used by existing code.
  const classData = CharactersDB;

  // Character portraits
  const charImages = {
    Rogue: "rogue.png",
    Mauja: "brute.png",
    Paladin: "paladin.png",
    Vampiress: "vampiress.png",
    Necromancer: "necromancer.png",
    "Ice Djinn": "ice_djinn.png"
  };

  // ------------------------
  // 4) Custom decks (Deck Builder)
  // ------------------------

  const CUSTOM_DECKS_KEY = "ss_custom_decks_v1";

  function loadCustomDecksMap() {
    try {
      const raw = localStorage.getItem(CUSTOM_DECKS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return {};
      return parsed;
    } catch (e) {
      console.warn("Failed to load custom decks:", e);
      return {};
    }
  }

  function saveCustomDecksMap(map) {
    try {
      localStorage.setItem(CUSTOM_DECKS_KEY, JSON.stringify(map || {}));
    } catch (e) {
      console.warn("Failed to save custom decks:", e);
    }
  }

  function isCustomDeckId(deckId) {
    return typeof deckId === "string" && deckId.startsWith("custom_");
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
    if (!deckDef || typeof deckDef !== "object") return null;
    const id = String(deckDef.id || "");
    if (!isCustomDeckId(id)) {
      console.warn("Custom deck id must start with custom_:", id);
      return null;
    }
    const custom = loadCustomDecksMap();
    custom[id] = {
      id,
      name: String(deckDef.name || "Custom Deck"),
      character: String(deckDef.character || ""),
      description: String(deckDef.description || ""),
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

  // ------------------------
  // 5) Helpers
  // ------------------------

  /**
   * Expand a deck definition into an array of card objects.
   * Cards in the expanded list include:
   * - uniqueId: used for UI identity (hand dragging etc)
   * - dmg defaults to 0 if not set
   */
  function buildDeckFromDeckId(deckId) {
    const def = getDeckDef(deckId);
    if (!def) {
      console.warn("Deck not found:", deckId);
      return [];
    }

    const deck = [];
    let counter = 0;
    for (const entry of def.cards || []) {
      const base = CardsDB[entry.cardId];
      if (!base) {
        console.warn("Card not found:", entry.cardId, "in deck", deckId);
        continue;

// FILTER_ILLEGAL_IN_BUILDDECK: remove illegal cards from built-in decks automatically
const deckCharName = (def.character || def.characterName || def.charName || null);
if(deckCharName && typeof isCardLegalForCharacter === 'function' && !isCardLegalForCharacter(base, deckCharName)){
  console.warn("Illegal card removed from deck:", entry.cardId, "for", deckCharName, "in deck", deckId);
  continue;
}
      }
      const copies = Math.max(0, Number(entry.copies) || 0);
      for (let i = 0; i < copies; i++) {
        counter++
        // Clone to avoid shared mutable fields like currentBlock
        deck.push({
          ...base,
          dmg: base.dmg || 0,
          currentBlock: (typeof base.currentBlock === "number") ? base.currentBlock : undefined,
          uniqueId: `${base.id}_${counter}`,
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
    // Preserve insertion order (the order defined in CharactersDB)
    return Object.keys(CharactersDB);
  }

  function getAbilityIdForCharacter(charName, index) {
    const c = CharactersDB[charName];
    return c?.abilityIds?.[index] || null;
  }

  // ------------------------
  
// Proficiency icons (Deck Builder chips)
const ProficiencyIcons = {
  warrior: "⚔️",
  light: "✨",
  brute: "👊",
  assassin: "🗡️",
  wizard: "📜",
  darkness: "🌑",
  poison: "☠️",
  vampire: "🧛",
  bleed: "🩸",
  hypnotic: "🌀",
  ice: "❄️",
  sorcerer: "🪄",
  spirit: "👻"
};


// ------------------------
// 5.5) Proficiency legality helpers
// ------------------------
function getCharacterProficiencies(charName){
  const c = CharactersDB?.[charName] || classData?.[charName];
  if(!c) return new Set();
  const set = new Set();
  if(c.class) set.add(String(c.class).toLowerCase());
  for(const t of (c.talents || [])) set.add(String(t).toLowerCase());
  return set;
}

function isRequirementsSatisfied(req, profSet){
  if(!req) return true;
  if(req.all){
    return req.all.every(p => profSet.has(String(p).toLowerCase()));
  }
  if(req.any){
    return req.any.some(group => (group.all || []).every(p => profSet.has(String(p).toLowerCase())));
  }
  return true;
}

function isCardLegalForCharacter(cardOrId, charName){
  const card = typeof cardOrId === 'string' ? CardsDB?.[cardOrId] : cardOrId;
  if(!card) return false;
  const prof = getCharacterProficiencies(charName);
  return isRequirementsSatisfied(card.requirements, prof);
}

// 6) Expose globals (explicit)
  // ------------------------
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

  // Custom deck APIs
  window.getDeckDef = getDeckDef;
  window.isCustomDeckId = isCustomDeckId;
  window.upsertCustomDeck = upsertCustomDeck;
  window.deleteCustomDeck = deleteCustomDeck;
  window.listCustomDecksForCharacter = listCustomDecksForCharacter;

  // Abilities API (data-driven)
  window.getAbilityIdForCharacter = getAbilityIdForCharacter;

})();
