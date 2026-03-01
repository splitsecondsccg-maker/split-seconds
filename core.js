// engine.js

// 1. ADDED heavy_impact TO THE SOUNDS DICTIONARY
const sounds = { 
    draw: new Audio('draw.mp3'), hit: new Audio('hit.mp3'), heavy_impact: new Audio('heavy_impact.mp3'),
    block: new Audio('block.mp3'), heal: new Audio('heal.mp3'),
    place1: new Audio('place1.mp3'), place2: new Audio('place2.mp3'), 
    place3: new Audio('place3.mp3'), lock: new Audio('lock.mp3') 
};
// ===== Balatro-snappy resolve pacing =====
const SPEED_MULT = 0.7; // lower = faster
const RESOLVE_DELAY = Math.round(650 * SPEED_MULT);        // empty moments
const LIGHT_IMPACT_DELAY = Math.round(700 * SPEED_MULT);  // small/medium hit
const HEAVY_IMPACT_DELAY = Math.round(1200 * SPEED_MULT); // big hit
const END_ROUND_DELAY = Math.round(800 * SPEED_MULT);

Object.values(sounds).forEach(sound => sound.volume = 0.6);
const music = { select: new Audio('select.mp3'), battle: new Audio('battle.mp3') };
music.select.loop = true; music.select.volume = 0.5; music.battle.loop = true; music.battle.volume = 0.4;
function playSound(name) { sounds[name].currentTime = 0; sounds[name].play().catch(e=>console.log("Audio muted")); }

function playPlaceSound(moments) {
    if(moments === 1) playSound('place1');
    else if(moments === 2) playSound('place2');
    else playSound('place3');
}

function triggerShake(power = 1) {
    const screen = document.body;
    screen.classList.remove('shake', 'shake-heavy');
    void screen.offsetWidth;

    if (power >= 2) {
        screen.classList.add('shake-heavy');
        setTimeout(() => screen.classList.remove('shake-heavy'), 260);
    } else if (power >= 1) {
        screen.classList.add('shake');
        setTimeout(() => screen.classList.remove('shake'), 180);
    }
}

function punchPortrait(targetKey, power = 1) {
    const selector = targetKey === 'player' ? '#player-stats .portrait' : '#ai-stats .portrait';
    const el = document.querySelector(selector);
    if (!el) return;

    el.classList.remove('portrait-punch', 'portrait-punch-heavy');
    void el.offsetWidth;

    if (power >= 2) el.classList.add('portrait-punch-heavy');
    else el.classList.add('portrait-punch');
}


function getIcon(type) {
    if(type === 'attack') return '⚔️';
    if(type === 'grab') return '🤚';
    if(type === 'block') return '🛡️';
    if(type === 'parry') return '🤺';
    if(type === 'utility') return '💨';
    return '✨'; // buff
}

const getBaseStatuses = () => ({ 
    dmgMod: 0,
    nextAtkMod: 0,
    nextGrabMod: 0,
    dmgReduction: 0,
    stamOnBlock: false,
    drawOnBlock: false,
    forceBlock: false,
    drawLess: 0,
    armorDebuff: 0,
    bonusArmor: 0,      // temporary armor for this turn
    armorNextTurn: 0,   // queued armor gain applied at start of next turn
    mustBlock: 0,
    stamPenalty: 0,
    rogueDebuff: 0,
    freeze: 0           // persistent counters (NOT cleared end of turn)
});

const KEYWORD_DEFS = {
    FREEZE: 'Stackable debuff that is NOT removed at end of turn. At 10+ FREEZE, all your ATTACKS cost +1 stamina.'
};

function formatKeywords(text = '') {
    if (!text) return '';
    return text.replace(/\b(FREEZE)\b/g, (m) => {
        const tip = KEYWORD_DEFS[m] || '';
        return `<span class="keyword" data-tip="${tip}">${m}</span>`;
    });
}

function getAttackTax(charKey) {
    return ((state?.[charKey]?.statuses?.freeze) || 0) >= 10 ? 1 : 0;
}

function getMoveCost(charKey, card) {
    if (!card) return 0;
    const base = card.cost || 0;
    return base + ((card.type === 'attack') ? getAttackTax(charKey) : 0);
}

function getEffectiveArmor(charKey) {
    const c = state?.[charKey];
    if (!c) return 0;
    return Math.max(0, (c.armor || 0) + (c.statuses.bonusArmor || 0) - (c.statuses.armorDebuff || 0));
}

function applyFreezeCounters(sourceKey, targetKey, amount) {
    const source = state?.[sourceKey];
    const target = state?.[targetKey];
    if (!target || amount <= 0) return;

    target.statuses.freeze = (target.statuses.freeze || 0) + amount;
    if (source) source.roundData.appliedStatus = true;

    spawnFloatingText(targetKey, `+${amount}❄`, 'float-freeze');
    log(`${targetKey === 'player' ? 'Player' : 'AI'} gains ${amount} FREEZE (${target.statuses.freeze}).`);
}

let state = {
    player: { class: '', hp: 40, maxHp: 40, stam: 6, maxStam: 6, armor: 0, deck: [], hand: [], timeline: [null, null, null, null, null], statuses: getBaseStatuses(), roundData: { lostLife: false, appliedStatus: false } },
    ai: { class: '', hp: 40, maxHp: 40, stam: 6, maxStam: 6, armor: 0, deck: [], hand: [], timeline: [null, null, null, null, null], statuses: getBaseStatuses(), roundData: { lostLife: false, appliedStatus: false } },
    phase: 'planning', currentMoment: 0,
    // EngineRuntime can run deterministically for future online play.
    // Keep false for identical single-player randomness.
    useDeterministicRng: false,
    rngSeed: (Date.now() & 0xffffffff) >>> 0
};

// Expose for engine_runtime.js (which intentionally uses window.state).
window.state = state;

let selectedPlayer = 'Rogue'; let selectedAI = 'Brute';

function selectChar(target, charName) {
    if(music.select.paused) music.select.play().catch(e=>console.log("BGM blocked"));
    const roster = document.getElementById(`${target}-roster`).children;
    for(let btn of roster) btn.classList.remove(target === 'player' ? 'selected' : 'ai-selected');
    event.currentTarget.classList.add(target === 'player' ? 'selected' : 'ai-selected');
    if(target === 'player') selectedPlayer = charName;
    if(target === 'ai') selectedAI = charName;
}

function startGame() {
    music.select.pause(); music.select.currentTime = 0; music.battle.play().catch(e=>console.log("Battle BGM blocked"));
    document.getElementById('char-select-screen').style.display = 'none'; document.getElementById('game-screen').style.display = 'flex';
    
    // RESTORED: This builds the decks and stats!
    const pData = classData[selectedPlayer];
    state.player = { class: selectedPlayer, hp: pData.maxHp || 40, maxHp: pData.maxHp || 40, stam: pData.maxStam, maxStam: pData.maxStam, armor: pData.armor, timeline: [null, null, null, null, null], hand: [], deck: buildDeck(pData.deck), statuses: getBaseStatuses(), roundData: { lostLife: false, appliedStatus: false } };
    
    const aiData = classData[selectedAI];
    state.ai = { class: selectedAI, hp: aiData.maxHp || 40, maxHp: aiData.maxHp || 40, stam: aiData.maxStam, maxStam: aiData.maxStam, armor: aiData.armor, timeline: [null, null, null, null, null], hand: [], deck: buildDeck(aiData.deck), statuses: getBaseStatuses(), roundData: { lostLife: false, appliedStatus: false } };

    document.getElementById('p-class-name').innerText = selectedPlayer; document.getElementById('p-armor').innerText = pData.armor;
    document.getElementById('ai-class-name').innerText = selectedAI; document.getElementById('ai-armor').innerText = aiData.armor;
    document.getElementById('p-portrait').style.backgroundImage = `url('${charImages[selectedPlayer]}')`;
    document.getElementById('ai-portrait').style.backgroundImage = `url('${charImages[selectedAI]}')`;

    // Tooltips added successfully
    document.getElementById('p-portrait-tooltip').innerText = pData.passiveDesc || 'No passive ability.';
    document.getElementById('ai-portrait-tooltip').innerText = aiData.passiveDesc || 'No passive ability.';

    document.getElementById('battle-log').innerHTML = '<strong>Battle Log</strong>';
    drawCards(3, 'player'); drawCards(3, 'ai'); 
    nextTurn(true);
}

function backToMenu() {
    music.battle.pause(); music.battle.currentTime = 0; music.select.play().catch(e=>console.log("Select BGM blocked"));
    document.getElementById('game-screen').style.display = 'none'; document.getElementById('char-select-screen').style.display = 'flex';
}

function log(msg) { 
    const el = document.getElementById('battle-log'); 
    el.innerHTML += `<div>${msg}</div>`; 
    el.scrollTop = el.scrollHeight; 
}

function getAbilityCard(className, index) {
    if(className === 'Rogue') {
        if(index === 1) return { name: 'Quick Step', type: 'utility', cost: 0, moments: 1, dmg: 0, desc: 'Gain 1 Stamina', effect: 'gain_stam_1', isBasic: true };
        if(index === 2) return { name: 'Poison Dagger', type: 'attack', cost: 0, moments: 1, dmg: 1, desc: 'Upon hit: Deal 1 extra Poison DMG', effect: 'poison_dagger', isBasic: true };
    }
    if(className === 'Brute') {
        if(index === 1) return { name: 'Enrage', type: 'utility', cost: 0, moments: 2, dmg: 0, desc: 'Gain 2 Stamina', effect: 'gain_stam_2', isBasic: true };
        if(index === 2) return { name: 'Heavy Blow', type: 'attack', cost: 0, moments: 3, dmg: 4, desc: 'Massive free strike', isBasic: true };
    }
    if(className === 'Paladin') {
        if(index === 1) return { name: 'Holy Light', type: 'buff', cost: 1, moments: 1, dmg: 0, desc: 'Heal 2 HP', effect: 'heal_2', isBasic: true };
        if(index === 2) return { name: 'Holy Strike', type: 'attack', cost: 0, moments: 2, dmg: 3, desc: 'Standard free strike', isBasic: true };
    }
    if(className === 'Vampiress') {
        if(index === 1) return { name: 'Blood Frenzy', type: 'utility', cost: 0, moments: 1, dmg: 0, desc: 'Draw 1 Card', effect: 'draw_1', isBasic: true };
        if(index === 2) return { name: 'Draw Blood', type: 'attack', cost: 0, moments: 1, dmg: 1, desc: 'Upon hit: Next Atk +1', effect: 'draw_blood', isBasic: true };
    }
    if(className === 'Necromancer') {
        if(index === 1) return { name: 'Meditate', type: 'utility', cost: 0, moments: 2, dmg: 0, desc: 'Draw 1, Gain 2 Stamina', effect: 'meditate', isBasic: true };
        if(index === 2) return { name: 'Death Touch', type: 'attack', cost: 1, moments: 2, dmg: 4, desc: 'Cheap, deadly magic', isBasic: true };
    }
    if(className === 'Ice Djinn') {
        if(index === 1) return { name: 'Spirit Form', type: 'buff', cost: 1, moments: 1, dmg: 0, desc: 'Next turn: +2 Armor', effect: 'spirit_form', isBasic: true };
        if(index === 2) return { name: 'Ice Blast', type: 'attack', cost: 3, moments: 3, dmg: 7, desc: '7 DMG. On hit: FREEZE 1', effect: 'freeze_1_on_hit', isBasic: true };
    }
    return null;
}

function useAbility(index) {
    if (!window.EngineRuntime) return;
    window.EngineRuntime.dispatch({
        type: window.EngineRuntime.ActionTypes.USE_ABILITY,
        payload: { index }
    });
}
function spawnFloatingText(target, text, cssClass) {
    const anchor = document.getElementById(target === 'player' ? 'p-portrait-anchor' : 'ai-portrait-anchor');
    const floater = document.createElement('div'); floater.className = `floating-text ${cssClass}`; floater.innerText = text;
    floater.style.left = '60px'; floater.style.top = '10px';
    anchor.appendChild(floater); setTimeout(() => floater.remove(), 1200);
}

function updateUI() {
    // UI Phase Lock: Strictly enforce which buttons are visible!
    const exertUI = document.getElementById('exert-controls');
    const actionUI = document.getElementById('action-controls');
    
    if (state.phase === 'exert') {
        if (exertUI) exertUI.style.display = 'flex';
        if (actionUI) actionUI.style.display = 'none';
    } else if (state.phase === 'planning' || state.phase === 'pivot_wait') { // <-- FIXED HERE
        if (exertUI) exertUI.style.display = 'none';
        if (actionUI) actionUI.style.display = 'flex';
    } else {
        // Hide both during clash/resolution
        if (exertUI) exertUI.style.display = 'none';
        if (actionUI) actionUI.style.display = 'none';
    }
    
    document.getElementById('p-hp-bar').style.height = `${(state.player.hp / state.player.maxHp) * 100}%`;
    document.getElementById('p-hp-label').innerText = `${state.player.hp}/${state.player.maxHp}`;
    document.getElementById('p-stam-bar').style.height = `${(state.player.stam / state.player.maxStam) * 100}%`;
    document.getElementById('p-stam-label').innerText = `${state.player.stam}/${state.player.maxStam}`;

    document.getElementById('ai-hp-bar').style.height = `${(state.ai.hp / state.ai.maxHp) * 100}%`;
    document.getElementById('ai-hp-label').innerText = `${state.ai.hp}/${state.ai.maxHp}`;
    document.getElementById('ai-stam-bar').style.height = `${(state.ai.stam / state.ai.maxStam) * 100}%`;
    document.getElementById('ai-stam-label').innerText = `${state.ai.stam}/${state.ai.maxStam}`;

    // Dynamic armor (includes temporary bonuses / debuffs)
    const pArmorEl = document.getElementById('p-armor');
    const aiArmorEl = document.getElementById('ai-armor');
    if (pArmorEl) pArmorEl.innerText = getEffectiveArmor('player');
    if (aiArmorEl) aiArmorEl.innerText = getEffectiveArmor('ai');
    
    renderStatuses('player');
    renderStatuses('ai');
    renderHand();
    renderAbilities();

    const aiHandEl = document.getElementById('ai-hand-count');
    if(aiHandEl) {
        let hiddenCards = state.ai.timeline.filter(c => c && c !== 'occupied' && !c.isBasic).length;
        aiHandEl.innerText = `Cards in Hand: ${state.ai.hand.length + hiddenCards}`;
    }
}

function renderAbilities() {
    ['player', 'ai'].forEach(char => {
        const container = document.getElementById(`${char}-ability-container`);
        if (!container) return;
        container.innerHTML = ''; 
        
        for(let i=1; i<=2; i++) {
            const ability = getAbilityCard(state[char].class, i);
            if (!ability) continue;
            const costDisplay = (char === 'player') ? getMoveCost('player', ability) : (ability.cost || 0);
            
            container.innerHTML += `
                <div class="ability-wrapper">
                    <button class="ability-btn" ${char === 'player' ? `onclick="useAbility(${i})"` : ''}>
                        🌟 <b>${ability.name}</b>
                    </button>
                    <div class="ability-tooltip ${char}-tooltip">
                        <b style="color: #f1c40f;">${ability.name}</b><br><hr style="border-color: #555; margin: 4px 0;">
                        Cost: ${costDisplay}⚡ | Time: ${ability.moments}⏳<br>
                        ${ability.dmg > 0 ? `<span style="color:#ffcccc;">DMG: ${ability.dmg}⚔️</span><br>` : ''}
                        <i>${formatKeywords(ability.desc)}</i>
                    </div>
                </div>
            `;
        }
    });
}

function renderStatuses(target) {
    const statuses = state[target].statuses;
    const container = document.getElementById(`${target === 'player' ? 'p' : 'ai'}-statuses`);
    
    let html = '<div style="font-size: 11px; color: #bbb; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; border-bottom: 1px solid #555;">Active Effects</div>';
    let count = 0;
    
    if(statuses.nextAtkMod > 0) { html += `<div class="status-badge status-buff">Next Atk +${statuses.nextAtkMod}</div>`; count++; }
    if(statuses.nextGrabMod > 0) { html += `<div class="status-badge status-buff">Next Grab +${statuses.nextGrabMod}</div>`; count++; }
    if(statuses.dmgReduction > 0) { html += `<div class="status-badge status-buff">Guard -${statuses.dmgReduction} DMG</div>`; count++; }
    if(statuses.forceBlock) { html += `<div class="status-badge status-debuff">Intimidated (Must Block)</div>`; count++; }
    if(statuses.mustBlock > 0) { html += `<div class="status-badge status-debuff">Scared (${statuses.mustBlock}x Block Req)</div>`; count++; }
    if(statuses.stamPenalty > 0) { html += `<div class="status-badge status-debuff">Chilled (-${statuses.stamPenalty} Stam Recov)</div>`; count++; }
    if((statuses.bonusArmor || 0) > 0) { html += `<div class="status-badge status-buff">+${statuses.bonusArmor} Armor (this turn)</div>`; count++; }
    if((statuses.freeze || 0) > 0) {
        const fr = statuses.freeze;
        const taxed = fr >= 10;
        html += `<div class="status-badge status-debuff">${taxed ? 'FROZEN' : 'Freeze'} (${fr})${taxed ? ' · Attacks +1⚡' : ''}</div>`;
        count++;
    }
    if(statuses.drawOnBlock) { html += `<div class="status-badge status-buff">Draw on Block</div>`; count++; }
    if(statuses.stamOnBlock) { html += `<div class="status-badge status-buff">Stamina on Block</div>`; count++; }
    
    if(count === 0) html += `<div style="font-size: 11px; color: #666; font-style: italic;">None</div>`;
    container.innerHTML = html;
}

function drawCards(amount, target = 'player') {
    const charState = state[target];
    for(let i=0; i<amount; i++) {
        if(charState.hand.length >= 7) { 
            if(target === 'player') log("Hand full! Discarded drawn card."); 
            break; 
        }
        let card = {...charState.deck[Math.floor(Math.random() * charState.deck.length)], uniqueId: 'uid_'+Math.random()};
        charState.hand.push(card);
    }
    if(target === 'player') { playSound('draw'); updateUI(); }
}

// Hook up default event handlers once core UI helpers exist.
if (window.EngineRuntime && !window.__splitSecondsHandlersInstalled) {
    window.EngineRuntime.installDefaultHandlers();
    window.__splitSecondsHandlersInstalled = true;
}

