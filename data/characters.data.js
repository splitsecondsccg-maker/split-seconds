// data/characters.data.js
(function(){
  window.SS_CHARACTERS_DATA = {
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
    Palea: {
      class: "sorcerer",
      talents: ["fae", "hypnotic"],
      maxHp: 38,
      maxStam: 7,
      armor: 2,
      passiveDesc: "When you consume HYPNOTIZED, gain 1 Stamina.",
      premise: "A fae hypnotizer who marks opponents, cancels their key moment, then amplifies precise strikes.",
      deckIds: ["palea_base"],
      defaultDeckId: "palea_base",
      abilityIds: { 1: "ability_palea_1", 2: "ability_palea_2" }
    },
    "Ice Assassin": {
      class: "assassin",
      talents: ["ice"],
      maxHp: 40,
      maxStam: 7,
      armor: 2,
      passiveDesc: "If the opponent has 5+ FREEZE counters, your ATTACKs have +1 DMG.",
      premise: "A tempo assassin that turns stacked FREEZE into clean finishing pressure.",
      deckIds: ["ice_assassin_base"],
      defaultDeckId: "ice_assassin_base",
      abilityIds: { 1: "ability_ice_assassin_1", 2: "ability_ice_assassin_2" }
    },
    "Ice Brute": {
      class: "brute",
      talents: ["ice"],
      maxHp: 40,
      maxStam: 5,
      armor: 2,
      passiveDesc: "When you lose life from an opponent ATTACK, they gain FREEZE 1.",
      premise: "A heavy bruiser that punishes enemy aggression by freezing attackers, then cashes out with crushing grabs.",
      deckIds: ["ice_brute_base"],
      defaultDeckId: "ice_brute_base",
      abilityIds: { 1: "ability_ice_brute_1", 2: "ability_ice_brute_2" }
    },
    "Fae Brute": {
      class: "brute",
      talents: ["fae", "hypnotic"],
      maxHp: 40,
      maxStam: 5,
      armor: 2,
      passiveDesc: "When you lose life from an opponent ATTACK, they become HYPNOTIZED.",
      premise: "A brute wrapped in fae hypnosis magic: punish aggression, then force awkward timing windows.",
      deckIds: ["brute_base"],
      defaultDeckId: "brute_base",
      abilityIds: { 1: "ability_brute_1", 2: "ability_brute_2" }
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

  window.SS_CHAR_IMAGES = {
    Rogue: "rogue.png",
    Mauja: "brute.png",
    Paladin: "paladin.png",
    Vampiress: "vampiress.png",
    Necromancer: "necromancer.png",
    "Ice Djinn": "ice_djinn.png",
    Palea: "palea.png",
    "Ice Assassin": "ice_assassin.png",
    "Ice Brute": "ice_brute.png",
    "Fae Brute": "poom.png"
  };

  window.SS_PROFICIENCY_ICONS = {
    warrior: "WARRIOR",
    light: "LIGHT",
    brute: "BRUTE",
    assassin: "ASSASSIN",
    wizard: "WIZARD",
    darkness: "DARKNESS",
    poison: "POISON",
    vampire: "VAMPIRE",
    bleed: "BLEED",
    hypnotic: "HYPNOTIC",
    fae: "FAE",
    ice: "ICE",
    sorcerer: "SORCERER",
    spirit: "SPIRIT"
  };
})();
