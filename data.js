// data.js

function buildDeck(blueprint) {
    let deck = [];
    blueprint.forEach(c => {
        for(let i=0; i<c.copies; i++) { deck.push({ ...c, uniqueId: c.id + '_' + i, dmg: c.dmg || 0 }); }
    });
    return deck;
}

const classData = {
    'Rogue': {
        maxStam: 8, armor: 3, 
        passiveDesc: 'Upon hit, opponent next attack has -1 DMG.',
        deck: [
            { id: 'r1', copies: 3, name: 'Quick Jab', type: 'attack', cost: 0, moments: 1, dmg: 2, desc: 'A fast, free strike.' },
            { id: 'r2', copies: 3, name: 'Flurry', type: 'attack', cost: 1, moments: 1, dmg: 3, desc: 'Standard assassin strike.' },
            { id: 'r3', copies: 3, name: 'Lunging Dagger', type: 'attack', cost: 1, moments: 2, dmg: 4, desc: 'Sacrifices time for reach.' },
            { id: 'r4', copies: 4, name: 'Kidney Strike', type: 'grab', cost: 1, moments: 1, dmg: 3, desc: 'Destroys 1 enemy Stamina on hit.', effect: 'exhaust_1' },
            { id: 'r6', copies: 4, name: 'Sharpen', type: 'buff', cost: 1, moments: 1, desc: '+3 DMG to next Attack.', effect: 'buff_next_atk_3' }
        ]
    },
    'Brute': {
        maxStam: 5, armor: 2, 
        passiveDesc: 'End of turn: If you lost life this turn, gain 1 Stamina.',
        deck: [
            { id: 'b1', copies: 3, name: 'Heavy Strike', type: 'attack', cost: 2, moments: 1, dmg: 3, desc: 'Drains stamina, hits hard.' },
            { id: 'b2', copies: 3, name: 'Cleave', type: 'attack', cost: 2, moments: 2, dmg: 5, desc: 'Wide, heavy swing.' },
            { id: 'b3', copies: 2, name: 'Devastating Blow', type: 'attack', cost: 3, moments: 3, dmg: 9, desc: 'Massive, slow attack.' },
            { id: 'b4', copies: 2, name: 'Suplex', type: 'grab', cost: 2, moments: 2, dmg: 5, desc: 'Massive punish for blocking.' },
            { id: 'b5', copies: 3, name: 'Sunder', type: 'attack', cost: 2, moments: 1, dmg: 2, desc: 'Enemy loses 2 Armor this turn.', effect: 'sunder' },
            { id: 'b6', copies: 2, name: 'Warcry', type: 'buff', cost: 2, moments: 2, desc: '+5 DMG to next Attack.', effect: 'buff_next_atk_5' }
        ]
    },
    'Paladin': {
        maxStam: 6, armor: 4, 
        passiveDesc: 'Upon blocking an attack, your next attack gains +1 DMG.',
        deck: [
            { id: 'p1', copies: 4, name: 'Standard Strike', type: 'attack', cost: 1, moments: 1, dmg: 2, desc: 'Reliable weapon swing.' },
            { id: 'p2', copies: 4, name: 'Shield Bash', type: 'grab', cost: 2, moments: 1, dmg: 4, desc: 'High burst against defenders.' },
            { id: 'b2', copies: 2, name: 'Pummel', type: 'attack', cost: 2, moments: 2, dmg: 4, desc: 'Heavy swing.' },
            { id: 'p3', copies: 4, name: 'Medic Light', type: 'buff', cost: 1, moments: 1, desc: 'Heals 3 HP.', effect: 'heal_3' },
            { id: 'r6', copies: 4, name: 'Bless', type: 'buff', cost: 1, moments: 1, desc: '+3 DMG to next Attack.', effect: 'buff_next_atk_3' },
            { id: 'p6', copies: 2, name: 'Holy Smite', type: 'attack', cost: 3, moments: 2, dmg: 7, desc: 'By the Holy light.'}  
        ]
    },
    'Vampiress': {
        maxStam: 7, armor: 3, 
        passiveDesc: 'Upon hit, your next attack gains +1 DMG this turn.',
        deck: [
            { id: 'v1', copies: 4, name: 'Claw Swipe', type: 'attack', cost: 0, moments: 1, dmg: 2, desc: 'A fast, free scratch.' },
            { id: 'v2', copies: 3, name: 'Siphon Strike', type: 'attack', cost: 1, moments: 1, dmg: 2, desc: 'Deals 2 DMG, Heals 1 HP if succeeded.', effect: 'heal_1_on_hit' },
            { id: 'v3', copies: 4, name: 'Vampiric Bite', type: 'grab', cost: 1, moments: 1, dmg: 3, desc: 'Deals 3 DMG, Heals 1 HP if succeeded.', effect: 'heal_1_on_hit' },
            { id: 'v4', copies: 3, name: 'Lethal Embrace', type: 'grab', cost: 2, moments: 2, dmg: 6, desc: 'Deals 6 DMG, Heals 2 HP if succeeded.', effect: 'heal_2_on_hit' },
            { id: 'v5', copies: 2, name: 'Hypnotic Gaze', type: 'buff', cost: 1, moments: 1, desc: 'Steal 1 Stamina from the enemy.', effect: 'steal_stam' },
            { id: 'n1', copies: 4, name: 'Scare', type: 'buff', cost: 0, moments: 1, desc: 'Draw 1. Opponent MUST block next turn.', effect: 'scare' },
        ]
    },
    'Necromancer': {
        maxStam: 7, armor: 2, 
        passiveDesc: 'End of turn: Gain 1 Stamina if you applied a status effect this turn.',
        deck: [
            { id: 'n1', copies: 3, name: 'Scare', type: 'buff', cost: 0, moments: 1, desc: 'Draw 1. Opponent MUST block next turn.', effect: 'scare' },
            { id: 'n2', copies: 2, name: 'Siphon Soul', type: 'grab', cost: 1, moments: 2, dmg: 3, desc: 'Upon hit: Next attack gains +3 DMG.', effect: 'siphon_soul' },
            { id: 'n3', copies: 3, name: 'Chiller', type: 'grab', cost: 1, moments: 1, dmg: 2, desc: 'Upon hit: Opponent recovers 1 less Stam next turn.', effect: 'chiller' },
            { id: 'n4', copies: 3, name: 'Skull Blast', type: 'attack', cost: 2, moments: 1, dmg: 4, desc: 'Fast magic projectile.' },
            { id: 'n5', copies: 2, name: 'Necro Blast', type: 'attack', cost: 4, moments: 2, dmg: 8, desc: 'Massive energy blast.' },
            { id: 'n6', copies: 2, name: 'Bone Cage', type: 'block', cost: 1, moments: 3, dmg: 0, desc: 'Blocks up to 6 total DMG over 3 moments.', currentBlock: 6 }
        ]
    }
};

const charImages = { 'Rogue': 'rogue.png', 'Brute': 'brute.png', 'Paladin': 'paladin.png', 'Vampiress': 'vampiress.png', 'Necromancer': 'necromancer.png' };