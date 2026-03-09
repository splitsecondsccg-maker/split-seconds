// data/cards.data.js
(function(){
  window.SS_CARDS_DATA = {
    // Rogue
    rogue_quick_jab:        { id: "rogue_quick_jab", name: "Quick Jab", type: "attack", cost: 0, moments: 1, dmg: 2, desc: "A fast, free strike." },
    rogue_flurry:           { id: "rogue_flurry", name: "Flurry", type: "attack", cost: 1, moments: 1, dmg: 3, desc: "Standard assassin strike." },
    rogue_lunging_dagger:   { id: "rogue_lunging_dagger", name: "Lunging Dagger", type: "attack", cost: 1, moments: 2, dmg: 4, desc: "Sacrifices time for reach.", requirements: {'all': ['assassin']} },
    rogue_cutthroat:        { id: "rogue_cutthroat", name: "Cutthroat", type: "attack", cost: 4, moments: 1, dmg: 6, desc: "Never trust a rogue...", requirements: {'all': ['assassin']} },
    rogue_kidney_strike:    { id: "rogue_kidney_strike", name: "Kidney Strike", type: "grab", cost: 1, moments: 1, dmg: 3, desc: "Destroys 1 enemy Stamina on hit.", effects: [{ trigger: "on_hit", type: "exhaust_1", value: 1 }], requirements: {'all': ['assassin']} },
    rogue_sharpen:          { id: "rogue_sharpen", name: "Sharpen", type: "buff", cost: 1, moments: 1, dmg: 0, desc: "+3 DMG to next Attack.", effects: [{ trigger: "on_resolve", type: "buff_next_atk_3", value: 1 }], requirements: {'all': ['assassin']} },
    rogue_coat_with_sedative:{ id: "rogue_coat_with_sedative", name: "Coat with Sedative", type: "enhancer", cost: 1, moments: 0, dmg: 0, desc: "Enhancer (Attack only). On hit: opponent draws 1 less next turn, and you draw 1.", enhance: { dmg: 0, targets: ["attack"], effects: [{ trigger: "on_hit", type: "draw_less", value: 1 }, { trigger: "on_hit", type: "draw_cards", value: 1 }] }, requirements: {'all': ['assassin']} },

    // Brute
    brute_heavy_strike:     { id: "brute_heavy_strike", name: "Heavy Strike", type: "attack", cost: 2, moments: 1, dmg: 3, desc: "Drains stamina, hits hard.", requirements: {'all': ['brute']} },
    brute_cleave:           { id: "brute_cleave", name: "Cleave", type: "attack", cost: 2, moments: 2, dmg: 5, desc: "Wide, heavy swing. Applies EXHAUSTED on hit or block.", effects: [{ trigger: "on_hit", type: "exhausted", value: 1 }, { trigger: "on_blocked", type: "exhausted", value: 1 }], requirements: {'all': ['brute']} },
    brute_dev_blow:         { id: "brute_dev_blow", name: "Devastating Blow", type: "attack", cost: 3, moments: 3, dmg: 9, desc: "Massive, slow attack. Applies EXHAUSTED on hit or block.", effects: [{ trigger: "on_hit", type: "exhausted", value: 1 }, { trigger: "on_blocked", type: "exhausted", value: 1 }], requirements: {'all': ['brute']} },
    brute_suplex:           { id: "brute_suplex", name: "Suplex", type: "grab", cost: 2, moments: 2, dmg: 6, desc: "Massive punish for blocking.", requirements: {'all': ['brute']} },
    brute_sunder:           { id: "brute_sunder", name: "Sunder", type: "attack", cost: 2, moments: 1, dmg: 2, desc: "Enemy loses 2 Armor this turn.", effects: [{ trigger: "on_resolve", type: "sunder", value: 1 }] },
    brute_warcry:           { id: "brute_warcry", name: "Warcry", type: "buff", cost: 2, moments: 2, dmg: 0, desc: "+5 DMG to next Attack.", effects: [{ trigger: "on_resolve", type: "buff_next_atk_5", value: 1 }], requirements: {'all': ['brute']} },

    // Paladin
    paladin_standard_strike:{ id: "paladin_standard_strike", name: "Standard Strike", type: "attack", cost: 1, moments: 1, dmg: 2, desc: "Reliable weapon swing." },
    paladin_shield_bash:    { id: "paladin_shield_bash", name: "Shield Bash", type: "grab", cost: 2, moments: 1, dmg: 4, desc: "High burst against defenders.", requirements: {'all': ['warrior']} },
    paladin_pummel:         { id: "paladin_pummel", name: "Pummel", type: "attack", cost: 2, moments: 2, dmg: 4, desc: "Heavy swing.", requirements: {'all': ['warrior']} },
    paladin_medic_light:    { id: "paladin_medic_light", name: "Medic Light", type: "buff", cost: 1, moments: 1, dmg: 0, desc: "Heals 3 HP.", effects: [{ trigger: "on_resolve", type: "heal_3", value: 1 }], requirements: {'all': ['light']} },
    paladin_bless:          { id: "paladin_bless", name: "Bless", type: "buff", cost: 1, moments: 1, dmg: 0, desc: "+3 DMG to next Attack.", effects: [{ trigger: "on_resolve", type: "buff_next_atk_3", value: 1 }], requirements: {'all': ['light']} },
    paladin_holy_smite:     { id: "paladin_holy_smite", name: "Holy Smite", type: "attack", cost: 3, moments: 2, dmg: 7, desc: "By the Holy light.", requirements: {'all': ['light']} },

    // Vampiress
    vamp_claw_swipe:        { id: "vamp_claw_swipe", name: "Claw Swipe", type: "attack", cost: 0, moments: 1, dmg: 2, desc: "A fast, free scratch." },
    vamp_siphon_strike:     { id: "vamp_siphon_strike", name: "Siphon Strike", type: "attack", cost: 1, moments: 1, dmg: 2, desc: "Deals 2 DMG, Heals 1 HP if succeeded.", effects: [{ trigger: "on_hit", type: "heal_1_on_hit", value: 1 }], requirements: {'all': ['bleed']} },
    vamp_vampiric_bite:     { id: "vamp_vampiric_bite", name: "Vampiric Bite", type: "grab", cost: 1, moments: 1, dmg: 3, desc: "Deals 3 DMG, Heals 1 HP if succeeded.", effects: [{ trigger: "on_hit", type: "heal_1_on_hit", value: 1 }], requirements: {'all': ['vampire']} },
    vamp_lethal_embrace:    { id: "vamp_lethal_embrace", name: "Lethal Embrace", type: "grab", cost: 2, moments: 2, dmg: 7, desc: "Deals 6 DMG, Heals 2 HP if succeeded.", effects: [{ trigger: "on_hit", type: "heal_2_on_hit", value: 1 }], requirements: {'all': ['vampire']} },
    vamp_hypnotic_gaze:     { id: "vamp_hypnotic_gaze", name: "Hypnotic Gaze", type: "buff", cost: 1, moments: 1, dmg: 0, desc: "Steal 1 Stamina from the enemy.", effects: [{ trigger: "on_resolve", type: "steal_stam", value: 1 }], requirements: {'all': ['hypnotic']} },

    // Necromancer
    necro_scare:            { id: "necro_scare", name: "Scare", type: "buff", cost: 0, moments: 1, dmg: 0, desc: "Draw 1. Opponent MUST block next turn.", effects: [{ trigger: "on_resolve", type: "scare", value: 1 }], requirements: {'any': [{'all': ['assassin']}, {'all': ['darkness']}] } },
    necro_siphon_soul:      { id: "necro_siphon_soul", name: "Siphon Soul", type: "grab", cost: 1, moments: 2, dmg: 3, desc: "Upon hit: Next attack gains +3 DMG.", effects: [{ trigger: "on_hit", type: "siphon_soul", value: 1 }], requirements: {'all': ['wizard', 'darkness']} },
    necro_chiller:          { id: "necro_chiller", name: "Chiller", type: "grab", cost: 1, moments: 1, dmg: 2, desc: "Upon hit: Opponent recovers 1 less Stam next turn.", effects: [{ trigger: "on_hit", type: "chiller", value: 1 }], requirements: {'all': ['ice']} },
    necro_skull_blast:      { id: "necro_skull_blast", name: "Skull Blast", type: "attack", cost: 2, moments: 1, dmg: 4, desc: "Fast magic projectile.", requirements: {'all': ['wizard', 'darkness']} },
    necro_necro_blast:      { id: "necro_necro_blast", name: "Necro Blast", type: "attack", cost: 4, moments: 2, dmg: 8, desc: "Massive energy blast.", requirements: {'all': ['wizard', 'darkness']} },
    necro_bone_cage:        { id: "necro_bone_cage", name: "Bone Cage", type: "block", cost: 1, moments: 3, dmg: 0, desc: "Blocks up to 6 total DMG over 3 moments.", currentBlock: 6, requirements: {'all': ['wizard', 'darkness']} },

    // Ice
    ice_cold_wind:          { id: "ice_cold_wind", name: "Cold Wind", type: "buff", cost: 0, moments: 1, dmg: 0, desc: "Apply FREEZE 1. Draw 1.", effects: [{ trigger: "on_resolve", type: "cold_wind", value: 1 }], requirements: {'all': ['ice']} },
    ice_ice_spear:          { id: "ice_ice_spear", name: "Ice Spear", type: "attack", cost: 2, moments: 2, dmg: 5, desc: "5 DMG. On hit: FREEZE 1.", effects: [{ trigger: "on_hit", type: "freeze_1_on_hit", value: 1 }], requirements: {'any': [{'all': ['wizard', 'ice']}, {'all': ['sorcerer', 'ice']}]} },
    ice_break_the_ice:      { id: "ice_break_the_ice", name: "Break the Ice", type: "grab", cost: 2, moments: 1, dmg: 2, desc: "2 DMG. On hit: Remove all FREEZE on opponent. Deal that much DMG.", effects: [{ trigger: "on_hit", type: "break_the_ice", value: 1 }], requirements: {'all': ['ice']} },
    ice_ice_wall:           { id: "ice_ice_wall", name: "Ice Wall", type: "block", cost: 3, moments: 3, dmg: 0, desc: "Blocks up to 8 total DMG over 3 moments. Each time it blocks an attack: FREEZE 1.", currentBlock: 8, requirements: {'any': [{'all': ['wizard', 'ice']}, {'all': ['sorcerer', 'ice']}]} },
    ice_assassin_ice_dagger:{ id: "ice_assassin_ice_dagger", name: "Ice Dagger", type: "attack", cost: 0, moments: 1, dmg: 2, desc: "2 DMG. On hit: FREEZE 1.", effects: [{ trigger: "on_hit", type: "freeze_1_on_hit", value: 1 }], requirements: {'all': ['assassin', 'ice']} },

    // Palea
    palea_fae_whisper:      { id: "palea_fae_whisper", name: "Fae Whisper", type: "buff", cost: 1, moments: 1, dmg: 0, desc: "Apply HYPNOTIZED.", effects: [{ trigger: "on_resolve", type: "hypnotize", value: 1 }], requirements: {'all': ['sorcerer', 'fae']} },
    palea_blink:            { id: "palea_blink", name: "Blink", type: "buff", cost: 1, moments: 1, dmg: 0, desc: "If opponent resolves an ATTACK this moment: negate it, draw 1, and deal 3 DMG.", effects: [{ trigger: "on_resolve", type: "blink", value: 1 }], requirements: {'all': ['sorcerer', 'fae']} },
    palea_dont:             { id: "palea_dont", name: "Don't", type: "utility", cost: 1, moments: 1, dmg: 0, desc: "If opponent is HYPNOTIZED: consume it and negate their action in this moment.", effects: [{ trigger: "on_resolve", type: "dont", value: 1 }], requirements: {'all': ['sorcerer', 'hypnotic']} },
    palea_snap_fingers:     { id: "palea_snap_fingers", name: "Snap Fingers", type: "buff", cost: 1, moments: 1, dmg: 0, desc: "Consume HYPNOTIZED: next attack +2 DMG.", effects: [{ trigger: "on_resolve", type: "snap_fingers", value: 1 }], requirements: {'all': ['sorcerer', 'hypnotic']} },
    palea_puppet_strings:   { id: "palea_puppet_strings", name: "Puppet Strings", type: "buff", cost: 2, moments: 2, dmg: 0, desc: "Consume HYPNOTIZED: opponent draws 1 less next turn.", effects: [{ trigger: "on_resolve", type: "puppet_strings", value: 1 }], requirements: {'all': ['fae', 'hypnotic']} },
    palea_fae_needle:       { id: "palea_fae_needle", name: "Fae Needle", type: "attack", cost: 1, moments: 1, dmg: 2, desc: "2 DMG. On hit: if HYPNOTIZED, consume and deal +2.", effects: [{ trigger: "on_hit", type: "fae_needle", value: 1 }], requirements: {'all': ['fae']} },
    palea_arcane_amp:       { id: "palea_arcane_amp", name: "Arcane Amp", type: "enhancer", cost: 1, moments: 0, dmg: 0, desc: "Enhancer: attached action gains +2 DMG.", enhance: { dmg: 2 }, requirements: {'all': ['sorcerer']} },
    palea_fae_edge:         { id: "palea_fae_edge", name: "Fae Edge", type: "enhancer", cost: 0, moments: 0, dmg: 0, desc: "Enhancer: attached action gains +1 DMG.", enhance: { dmg: 1 }, requirements: {'all': ['fae']} },

    // Proficiency showcase cards
    warrior_shield_discipline:{ id: "warrior_shield_discipline", name: "Shield Discipline", type: "buff", cost: 1, moments: 1, dmg: 0, desc: "Reduce incoming damage by 3 this moment.", effects: [{ trigger: "on_resolve", type: "reduce_dmg_3", value: 1 }], requirements: {'all': ['warrior']} },
    light_sanctified_burst:   { id: "light_sanctified_burst", name: "Sanctified Burst", type: "attack", cost: 2, moments: 2, dmg: 4, desc: "4 DMG. On hit: heal 1.", effects: [{ trigger: "on_hit", type: "heal_1_on_hit", value: 1 }], requirements: {'all': ['light']} },
    brute_earthshatter:       { id: "brute_earthshatter", name: "Earthshatter", type: "attack", cost: 3, moments: 2, dmg: 6, desc: "Heavy impact. Applies EXHAUSTED on hit or block.", effects: [{ trigger: "on_hit", type: "exhausted", value: 1 }, { trigger: "on_blocked", type: "exhausted", value: 1 }], requirements: {'all': ['brute']} },
    assassin_night_thrust:    { id: "assassin_night_thrust", name: "Night Thrust", type: "attack", cost: 1, moments: 1, dmg: 3, desc: "Fast lethal pressure.", requirements: {'all': ['assassin']} },
    wizard_arcane_focus:      { id: "wizard_arcane_focus", name: "Arcane Focus", type: "utility", cost: 1, moments: 1, dmg: 0, desc: "Gain 1 Stamina.", effects: [{ trigger: "on_resolve", type: "gain_stam_1", value: 1 }], requirements: {'all': ['wizard']} },
    darkness_dread_mark:      { id: "darkness_dread_mark", name: "Dread Mark", type: "buff", cost: 1, moments: 1, dmg: 0, desc: "Draw 1. Opponent must block next turn.", effects: [{ trigger: "on_resolve", type: "scare", value: 1 }], requirements: {'all': ['darkness']} },
    darkness_night_blade:     { id: "darkness_night_blade", name: "Night Blade", type: "attack", cost: 2, moments: 1, dmg: 3, desc: "3 DMG. If opponent has no cards in hand, gains +3 DMG.", specialNotes: "Conditional bonus: +3 damage if opponent hand is empty at resolution.", requirements: {'all': ['darkness', 'assassin']} },
    poison_toxic_sting:       { id: "poison_toxic_sting", name: "Toxic Sting", type: "attack", cost: 1, moments: 1, dmg: 1, desc: "1 DMG. On hit: POISON 2.", effects: [{ trigger: "on_hit", type: "poison", value: 2 }], requirements: {'all': ['poison']} },
    vampire_blood_sip:        { id: "vampire_blood_sip", name: "Blood Sip", type: "grab", cost: 1, moments: 1, dmg: 2, desc: "2 DMG. On hit: heal 1.", effects: [{ trigger: "on_hit", type: "heal_1_on_hit", value: 1 }], requirements: {'all': ['vampire']} },
    bleed_open_wound:         { id: "bleed_open_wound", name: "Open Wound", type: "attack", cost: 1, moments: 1, dmg: 1, desc: "1 DMG. On hit: BLEED 2.", effects: [{ trigger: "on_hit", type: "bleed", value: 2 }], requirements: {'all': ['bleed']} },
    hypnotic_false_command:   { id: "hypnotic_false_command", name: "False Command", type: "utility", cost: 1, moments: 1, dmg: 0, desc: "Apply HYPNOTIZED.", effects: [{ trigger: "on_resolve", type: "hypnotize", value: 1 }], requirements: {'all': ['hypnotic']} },
    fae_mirror_prank:         { id: "fae_mirror_prank", name: "Mirror Prank", type: "buff", cost: 1, moments: 1, dmg: 0, desc: "If opponent resolves an ATTACK this moment: negate it, draw 1, and deal 3 DMG.", effects: [{ trigger: "on_resolve", type: "blink", value: 1 }], requirements: {'all': ['fae']} },
    ice_frostbind:            { id: "ice_frostbind", name: "Frostbind", type: "attack", cost: 1, moments: 1, dmg: 2, desc: "2 DMG. On hit: FREEZE 1.", effects: [{ trigger: "on_hit", type: "freeze_1_on_hit", value: 1 }], requirements: {'all': ['ice']} },
    sorcerer_spellweave:      { id: "sorcerer_spellweave", name: "Spellweave", type: "enhancer", cost: 1, moments: 0, dmg: 0, desc: "Enhancer: +1 DMG. On hit: draw 1.", enhance: { dmg: 1, effects: [{ trigger: "on_hit", type: "draw_cards", value: 1 }] }, requirements: {'all': ['sorcerer']} },
    spirit_ether_guard:       { id: "spirit_ether_guard", name: "Ether Guard", type: "buff", cost: 1, moments: 1, dmg: 0, desc: "Next turn: +2 Armor.", effects: [{ trigger: "on_resolve", type: "spirit_form", value: 1 }], requirements: {'all': ['spirit']} },

    // Keyword cards (POISON / BLEED)
    necro_venom_bolt: {
      id: "necro_venom_bolt", name: "Venom Bolt", type: "attack", cost: 1, moments: 1, dmg: 2,
      desc: "2 DMG. On hit: POISON 3.", effects: [{ trigger: "on_hit", type: "poison", value: 3 }]
    },
    necro_plague_grip: {
      id: "necro_plague_grip", name: "Plague Grip", type: "grab", cost: 1, moments: 1, dmg: 2,
      desc: "2 DMG. On hit: POISON 2.", effects: [{ trigger: "on_hit", type: "poison", value: 2 }]
    },
    necro_necrotic_rot: {
      id: "necro_necrotic_rot", name: "Necrotic Rot", type: "attack", cost: 2, moments: 2, dmg: 4,
      desc: "4 DMG. On hit: POISON 4.", effects: [{ trigger: "on_hit", type: "poison", value: 4 }]
    },
    toxic_rain: {
      id: "toxic_rain", name: "Toxic Rain", type: "buff", cost: 2, moments: 2, dmg: 0,
      desc: "POISON 6.", effects: [{ trigger: "on_resolve", type: "poison", value: 6 }]
    },
    vamp_rending_claw: {
      id: "vamp_rending_claw", name: "Rending Claw", type: "attack", cost: 1, moments: 1, dmg: 1,
      desc: "1 DMG. On hit: BLEED 3.", effects: [{ trigger: "on_hit", type: "bleed", value: 3 }]
    },
    vamp_crimson_grapple: {
      id: "vamp_crimson_grapple", name: "Crimson Grapple", type: "grab", cost: 1, moments: 1, dmg: 3,
      desc: "3 DMG. On hit: BLEED 2.", effects: [{ trigger: "on_hit", type: "bleed", value: 2 }]
    },
    vamp_artery_rip: {
      id: "vamp_artery_rip", name: "Artery Bite", type: "grab", cost: 2, moments: 2, dmg: 4,
      desc: "4 DMG. On hit: BLEED 4.", effects: [{ trigger: "on_hit", type: "bleed", value: 4 }]
    },

    // Character abilities
    ability_rogue_1: { id: "ability_rogue_1", name: "Quick Step", type: "utility", cost: 0, moments: 1, dmg: 0, desc: "Gain 1 Stamina", effects: [{ trigger: "on_resolve", type: "gain_stam_1", value: 1 }], isBasic: true, isAbility: true, requirements: {'all': ['assassin']} },
    ability_rogue_2: { id: "ability_rogue_2", name: "Poison Dagger", type: "attack", cost: 0, moments: 1, dmg: 1, desc: "Upon hit: Deal 1 extra Poison DMG", effects: [{ trigger: "on_hit", type: "poison_dagger", value: 1 }], isBasic: true, isAbility: true, requirements: {'all': ['assassin']} },

    ability_brute_1: { id: "ability_brute_1", name: "Poison Skin", type: "utility", cost: 1, moments: 1, dmg: 0, desc: "Next turn, each time you lose life from opponent ATTACK, they gain POISON 2.", effects: [{ trigger: "on_resolve", type: "poison_skin", value: 1 }], isBasic: true, isAbility: true },
    ability_brute_2: { id: "ability_brute_2", name: "Heavy Blow", type: "attack", cost: 0, moments: 3, dmg: 4, desc: "Massive free strike", isBasic: true, isAbility: true },

    ability_paladin_1: { id: "ability_paladin_1", name: "Holy Light", type: "buff", cost: 1, moments: 1, dmg: 0, desc: "Heal 2 HP", effects: [{ trigger: "on_resolve", type: "heal_2", value: 1 }], isBasic: true, isAbility: true },
    ability_paladin_2: { id: "ability_paladin_2", name: "Holy Strike", type: "attack", cost: 0, moments: 2, dmg: 3, desc: "Standard free strike", isBasic: true, isAbility: true },

    ability_vampiress_1: { id: "ability_vampiress_1", name: "Blood Frenzy", type: "utility", cost: 0, moments: 1, dmg: 0, desc: "Draw 1 Card", effects: [{ trigger: "on_resolve", type: "draw_1", value: 1 }], isBasic: true, isAbility: true },
    ability_vampiress_2: { id: "ability_vampiress_2", name: "Draw Blood", type: "attack", cost: 0, moments: 1, dmg: 1, desc: "Upon hit: Next Atk +1", effects: [{ trigger: "on_hit", type: "draw_blood", value: 1 }], isBasic: true, isAbility: true },

    ability_necromancer_1: { id: "ability_necromancer_1", name: "Meditate", type: "utility", cost: 0, moments: 2, dmg: 0, desc: "Draw 1, Gain 2 Stamina", effects: [{ trigger: "on_resolve", type: "meditate", value: 1 }], isBasic: true, isAbility: true },
    ability_necromancer_2: { id: "ability_necromancer_2", name: "Death Touch", type: "attack", cost: 1, moments: 2, dmg: 4, desc: "Cheap, deadly magic", isBasic: true, isAbility: true },

    ability_ice_assassin_1: { id: "ability_ice_assassin_1", name: "Ice Slash", type: "attack", cost: 2, moments: 1, dmg: 3, desc: "3 DMG. On hit: FREEZE 1.", effects: [{ trigger: "on_hit", type: "freeze_1_on_hit", value: 1 }], isBasic: true, isAbility: true },
    ability_ice_assassin_2: { id: "ability_ice_assassin_2", name: "Ice Forge", type: "buff", cost: 0, moments: 1, dmg: 0, desc: "Create Ice Dagger in hand.", effects: [{ trigger: "on_resolve", type: "forge_ice_dagger", value: 1 }], isBasic: true, isAbility: true },
    ability_ice_brute_1: { id: "ability_ice_brute_1", name: "Frost Club", type: "attack", cost: 2, moments: 3, dmg: 5, desc: "5 DMG. On hit: FREEZE 2.", effects: [{ trigger: "on_hit", type: "freeze_2_on_hit", value: 1 }], isBasic: true, isAbility: true },
    ability_ice_brute_2: { id: "ability_ice_brute_2", name: "Frost Hug", type: "grab", cost: 2, moments: 2, dmg: 3, desc: "3 DMG. On hit: if opponent has 10+ FREEZE, deal +5 DMG.", effects: [{ trigger: "on_hit", type: "frost_hug", value: 1 }], isBasic: true, isAbility: true },
    ability_ice_djinn_1: { id: "ability_ice_djinn_1", name: "Spirit Form", type: "buff", cost: 1, moments: 1, dmg: 0, desc: "Next turn: +2 Armor", effects: [{ trigger: "on_resolve", type: "spirit_form", value: 1 }], isBasic: true, isAbility: true },
    ability_ice_djinn_2: { id: "ability_ice_djinn_2", name: "Ice Blast", type: "attack", cost: 3, moments: 3, dmg: 7, desc: "7 DMG. On hit: FREEZE 1", effects: [{ trigger: "on_hit", type: "freeze_1_on_hit", value: 1 }], isBasic: true, isAbility: true },

    ability_palea_1: { id: "ability_palea_1", name: "Mesmer", type: "utility", cost: 0, moments: 1, dmg: 0, desc: "Apply HYPNOTIZED.", effects: [{ trigger: "on_resolve", type: "hypnotize", value: 1 }], isBasic: true, isAbility: true, requirements: {'all': ['sorcerer', 'hypnotic']} },
    ability_palea_2: { id: "ability_palea_2", name: "Glamour Spike", type: "utility", cost: 0, moments: 1, dmg: 0, desc: "Consume HYPNOTIZED: opponent draws 1 less next turn.", effects: [{ trigger: "on_resolve", type: "puppet_strings", value: 1 }], isBasic: true, isAbility: true, requirements: {'all': ['fae', 'hypnotic']} }
  };
})();
