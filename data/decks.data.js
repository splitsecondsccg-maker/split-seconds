// data/decks.data.js
(function(){
  window.SS_DECKS_DATA = {
    rogue_base: {
      id: "rogue_base",
      name: "Rogue - Classic",
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
      name: "Brute - Classic",
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
      name: "Paladin - Classic",
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
      name: "Vampiress - Classic",
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

    // Vampiress - Bleed-focused deck
    vampiress_bleed: {
      id: "vampiress_bleed",
      name: "Vampiress - Hemorrhage",
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
      name: "Necromancer - Classic",
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

    // Necromancer - Poison-focused deck
    necromancer_poison: {
      id: "necromancer_poison",
      name: "Necromancer - Plague",
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

    palea_base: {
      id: "palea_base",
      name: "Palea - Hypnotic Bloom",
      character: "Palea",
      description: "Apply HYPNOTIZED, negate key moments, and amplify attacks with enhancers.",
      cards: [
        { cardId: "palea_fae_whisper", copies: 4 },
        { cardId: "palea_dont", copies: 3 },
        { cardId: "palea_snap_fingers", copies: 3 },
        { cardId: "palea_puppet_strings", copies: 2 },
        { cardId: "palea_fae_needle", copies: 4 },
        { cardId: "palea_arcane_amp", copies: 2 },
        { cardId: "palea_fae_edge", copies: 2 }
      ]
    },
    ice_djinn_base: {
      id: "ice_djinn_base",
      name: "Ice Djinn - Classic",
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
})();


