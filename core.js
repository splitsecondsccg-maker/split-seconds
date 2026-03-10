// engine.js

// INPUT MODE DETECTION

window.INPUT_MODE = (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
) ? 'touch' : 'mouse';

window.isTouch = window.INPUT_MODE === 'touch';


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
    if(type === 'attack') return '\u2694\uFE0F';
    if(type === 'grab') return '\u270B';
    if(type === 'block') return '\uD83D\uDEE1\uFE0F';
    if(type === 'parry') return '\uD83E\uDD3A';
    if(type === 'enhancer') return '\u2728';
    if(type === 'utility') return '\uD83D\uDCA8';
    return '\u2728';
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
    freeze: 0,          // persistent counters (NOT cleared end of turn)
    bleed: 0,           // persistent counters (NOT cleared end of turn)
    poison: 0,          // persistent counters (NOT cleared end of turn)
    hypnotized: 0,      // non-stackable; persists until losing life
    exhausted: 0,       // NOT stackable; cleared at start of turn; reduces stamina regen by 1
    poisonSkinNextTurn: 0,
    poisonSkinActive: 0
});

const KEYWORD_DEFS = {
    EXHAUSTED: "Non-stackable debuff. At TURN START: you regenerate 1 less stamina, then EXHAUSTED is cleared.",
    FREEZE: "Stackable debuff that is NOT removed at end of turn. At 10+ FREEZE, all your ATTACKS cost +1 stamina.",
    BLEED: "Persistent counter. When you are HIT by an ATTACK: take damage equal to BLEED, then BLEED resets to 0.",
    POISON: "Persistent counter. At TURN END: take damage equal to ceil(POISON/2), then POISON halves (rounded down).",
    HYPNOTIZED: "Non-stackable debuff. Persists through turn start/end. Removed when you lose life."
};

function formatKeywords(text = '') {
    if (!text) return '';
    return text.replace(/\b(EXHAUSTED|FREEZE|BLEED|POISON|HYPNOTIZED)\b/g, (m) => {
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

function enhancerCanTarget(enhancerCard, targetCard) {
    if (!enhancerCard || enhancerCard.type !== 'enhancer') return false;
    if (!targetCard || targetCard.type === 'enhancer') return false;
    const targets = Array.isArray(enhancerCard?.enhance?.targets)
        ? enhancerCard.enhance.targets.map(t => String(t || '').toLowerCase()).filter(Boolean)
        : [];
    if (!targets.length) return true;
    return targets.includes(String(targetCard.type || '').toLowerCase());
}
window.enhancerCanTarget = enhancerCanTarget;
function isMultiMomentActiveCard(card) {
    if (!card) return false;
    const moments = Number(card.moments || 1);
    if (moments <= 1) return false;
    if (card.resolveEachMoment) return true;
    if (card.type === 'block' && typeof card.currentBlock === 'number') return true;
    if (Array.isArray(card.effects) && card.effects.some((fx) => String(fx?.type || '').toLowerCase() === 'spirit_guard')) return true;
    return false;
}
window.isMultiMomentActiveCard = isMultiMomentActiveCard;

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

    spawnFloatingText(targetKey, `+${amount} FREEZE`, 'float-freeze');
    log(`${targetKey === 'player' ? 'Player' : 'AI'} gains ${amount} FREEZE (${target.statuses.freeze}).`);
}


function applyBleedCounters(sourceKey, targetKey, amount) {
    const source = state?.[sourceKey];
    const target = state?.[targetKey];
    if (!target || amount <= 0) return;

    target.statuses.bleed = (target.statuses.bleed || 0) + amount;
    if (source) source.roundData.appliedStatus = true;

    spawnFloatingText(targetKey, `+${amount} BLEED`, 'float-bleed');
    log(`${targetKey === 'player' ? 'Player' : 'AI'} gains ${amount} BLEED (${target.statuses.bleed}).`);
}

function applyPoisonCounters(sourceKey, targetKey, amount) {
    const source = state?.[sourceKey];
    const target = state?.[targetKey];
    if (!target || amount <= 0) return;

    target.statuses.poison = (target.statuses.poison || 0) + amount;
    if (source) source.roundData.appliedStatus = true;

    spawnFloatingText(targetKey, `+${amount} POISON`, 'float-poison');
    log(`${targetKey === 'player' ? 'Player' : 'AI'} gains ${amount} POISON (${target.statuses.poison}).`);
}

function applyHypnotizedStatus(sourceKey, targetKey) {
    const source = state?.[sourceKey];
    const target = state?.[targetKey];
    if (!target) return false;
    if ((target.statuses.hypnotized || 0) > 0) return false; // non-stackable
    target.statuses.hypnotized = 1;
    if (source) source.roundData.appliedStatus = true;
    if (typeof spawnFloatingText === 'function') spawnFloatingText(targetKey, 'HYPNOTIZED', 'float-hypnotized');
    if (typeof log === 'function') log(`${targetKey === 'player' ? 'Player' : 'AI'} becomes HYPNOTIZED.`);
    return true;
}

function clearHypnotizedOnLifeLoss(targetKey, reason = 'lost life') {
    const target = state?.[targetKey];
    if (!target) return false;
    if ((target.statuses.hypnotized || 0) <= 0) return false;
    target.statuses.hypnotized = 0;
    if (typeof spawnFloatingText === 'function') spawnFloatingText(targetKey, `HYPNOTIZED LOST`, 'float-hypnotized');
    if (typeof log === 'function') log(`${targetKey === 'player' ? 'Player' : 'AI'} loses HYPNOTIZED (${reason}).`);
    return true;
}

function applyExhaustedStatus(sourceKey, targetKey) {
    const source = state?.[sourceKey];
    const target = state?.[targetKey];
    if (!target) return;
    if ((target.statuses.exhausted || 0) > 0) return; // non-stackable
    target.statuses.exhausted = 1;
    if (source) source.roundData.appliedStatus = true;
    if (typeof spawnFloatingText === 'function') spawnFloatingText(targetKey, `EXHAUSTED`, 'float-exhausted');
    if (typeof log === 'function') log(`${targetKey === 'player' ? 'Player' : 'AI'} becomes EXHAUSTED.`);
}

// Expose for EffectTypeRegistry (effects_registry.js)
window.applyExhaustedStatus = applyExhaustedStatus;
window.applyHypnotizedStatus = applyHypnotizedStatus;
window.clearHypnotizedOnLifeLoss = clearHypnotizedOnLifeLoss;


function tickPoisonAtTurnEnd(charKey) {
    const c = state?.[charKey];
    if (!c) return;
    const stacks = c.statuses.poison || 0;
    const remaining = Math.floor(stacks / 2);
    const dmg = stacks - remaining; // ceil(stacks/2)
    if (dmg <= 0) return;

    c.statuses.poison = remaining;
    c.hp -= dmg;

    c.roundData.lostLife = true;
    if (typeof clearHypnotizedOnLifeLoss === 'function') clearHypnotizedOnLifeLoss(charKey, 'poison damage');
    spawnFloatingText(charKey, `-${dmg}`, 'float-dmg');
    log(`${charKey === 'player' ? 'Player' : 'AI'} suffers ${dmg} POISON damage (${c.statuses.poison} left).`);
    playSound('hit');
}

let state = {
    player: { class: '', hp: 40, maxHp: 40, stam: 6, maxStam: 6, armor: 0, deck: [], hand: [], timeline: [null, null, null, null, null], statuses: getBaseStatuses(), roundData: { lostLife: false, appliedStatus: false } },
    ai: { class: '', hp: 40, maxHp: 40, stam: 6, maxStam: 6, armor: 0, deck: [], hand: [], timeline: [null, null, null, null, null], statuses: getBaseStatuses(), roundData: { lostLife: false, appliedStatus: false } },
    phase: 'planning', currentMoment: 0,
    // EngineRuntime can run deterministically for future online play.
    // Keep false for identical single-player randomness.
    useDeterministicRng: false,
    rngSeed: (Date.now() & 0xffffffff) >>> 0,
    aiDifficulty: 'hard'
};

// Expose for engine_runtime.js (which intentionally uses window.state).
window.state = state;

let selectedPlayer = 'Rogue';
let selectedAI = 'Brute';
let aiDifficulty = 'hard';
window.setAIDifficulty = function(level) {
    const normalized = String(level || 'hard').toLowerCase();
    if (normalized !== 'normal' && normalized !== 'hard' && normalized !== 'pro') return;
    aiDifficulty = normalized;
    if (window.state) window.state.aiDifficulty = normalized;
};
window.getAIDifficulty = function() { return aiDifficulty; };

// Selected deck per side (each character can have multiple decks)
let selectedPlayerDeckId = (typeof getDefaultDeckIdForCharacter === 'function') ? getDefaultDeckIdForCharacter(selectedPlayer) : null;
let selectedAIDeckId = (typeof getDefaultDeckIdForCharacter === 'function') ? getDefaultDeckIdForCharacter(selectedAI) : null;


// Small public selectors for UI helpers (deck builder etc.)
window.getSelectedChar = (target) => (target === 'ai' ? selectedAI : selectedPlayer);
window.getSelectedDeckId = (target) => (target === 'ai' ? selectedAIDeckId : selectedPlayerDeckId);

// Remember last chosen deck per character (so switching away/back doesn't reset)
const __deckChoiceMemory = { player: {}, ai: {} };

// Fighting-view selection flow
let __fightPhase = 'player';        // 'player' | 'ai'
let __fightPlayerLocked = false;
let __fightAiChosen = false;

const LADDER_DIFFICULTIES = ['normal', 'normal', 'hard', 'hard', 'pro', 'pro'];
let ladderRun = null;

function hasActiveLanSession(){
    return !!(window.__ssLanPvpMode && window.__ssLanPvpMode.enabled);
}

function resetLadderRun(){
    ladderRun = null;
    const hud = document.getElementById('ladder-hud');
    if (hud) hud.style.display = 'none';
    hideLadderTransition();
    hideLadderIntro();
}

function isLadderRunning(){
    return !!(ladderRun && ladderRun.active && ladderRun.status === 'running');
}

// We intentionally do NOT animate/random-preview the opponent.
// If the player enters combat without choosing an opponent, we randomize in startGame().

function getAllCharacters(){
    if(typeof getCharacterList === 'function') return getCharacterList();
    return Object.keys(classData || {});
}

function getCharacterLabel(charName){
    if(typeof window.getCharacterDisplayName === 'function') return window.getCharacterDisplayName(charName);
    return String(charName || '');
}

function pickRandomOpponent(excludeName){
    const chars = getAllCharacters().filter(c => c !== excludeName);
    if(chars.length === 0) return excludeName || (getAllCharacters()[0] || '');
    return chars[Math.floor(Math.random() * chars.length)];
}

function buildLadderRun(playerChar, playerDeckId){
    const pool = getAllCharacters().filter(c => c !== playerChar);
    for(let i = pool.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }

    const picked = pool.slice(0, 6);
    while (picked.length < 6) picked.push(pool[picked.length % Math.max(1, pool.length)] || playerChar);

    const steps = LADDER_DIFFICULTIES.map((difficulty, i) => {
        const opp = picked[i];
        return {
            index: i,
            opponent: opp,
            difficulty,
            deckId: (typeof pickRandomDeckIdForCharacter === 'function') ? pickRandomDeckIdForCharacter(opp) : null,
            result: 'pending'
        };
    });

    return {
        active: true,
        status: 'running',
        current: 0,
        playerChar,
        playerDeckId,
        steps
    };
}

function ladderStepCss(step, idx){
    if (!step) return '';
    if (step.result === 'won') return 'done';
    if (step.result === 'lost') return 'failed';
    if (isLadderRunning() && idx === ladderRun.current) return 'current';
    return '';
}

function ladderStepHtml(step, idx){
    const img = (window.charImages && window.charImages[step.opponent]) ? window.charImages[step.opponent] : '';
    const name = getCharacterLabel(step.opponent);
    const diff = String(step.difficulty || '').toUpperCase();
    const css = ladderStepCss(step, idx);
    return `
        <div class="ladder-step ${css}">
            <div class="ladder-avatar" style="background-image:url('${img}');"></div>
            <div class="ladder-meta">
                <div class="ladder-name">${idx + 1}. ${name}</div>
                <div class="ladder-diff">${diff}</div>
            </div>
        </div>
    `;
}

function renderLadderTrackInto(el){
    if (!el) return;
    if (!ladderRun || !Array.isArray(ladderRun.steps) || ladderRun.steps.length === 0) {
        el.innerHTML = '';
        return;
    }
    el.innerHTML = ladderRun.steps.map((step, idx) => ladderStepHtml(step, idx)).join('');
}

function renderLadderHud(){
    const hud = document.getElementById('ladder-hud');
    const track = document.getElementById('ladder-hud-track');
    if (!hud || !track) return;

    if (!isLadderRunning()) {
        hud.style.display = 'none';
        return;
    }
    hud.style.display = 'block';
    renderLadderTrackInto(track);
}

function hideLadderTransition(){
    const el = document.getElementById('ladder-transition');
    if (el) el.style.display = 'none';
}

function hideLadderIntro(){
    const el = document.getElementById('ladder-intro');
    if (el) el.style.display = 'none';
}

function showLadderIntro(){
    const wrap = document.getElementById('ladder-intro');
    const track = document.getElementById('ladder-intro-track');
    const beginBtn = document.getElementById('ladder-intro-begin');
    const cancelBtn = document.getElementById('ladder-intro-cancel');
    if (!wrap || !track || !beginBtn || !cancelBtn) return;
    renderLadderTrackInto(track);
    beginBtn.disabled = false;
    cancelBtn.disabled = false;
    wrap.style.display = 'flex';
}

function showLadderTransition(title, subtitle, canContinue){
    const wrap = document.getElementById('ladder-transition');
    const titleEl = document.getElementById('ladder-transition-title');
    const subEl = document.getElementById('ladder-transition-subtitle');
    const nextBtn = document.getElementById('ladder-next-btn');
    const exitBtn = document.getElementById('ladder-exit-btn');
    const track = document.getElementById('ladder-transition-track');

    if (!wrap || !titleEl || !subEl || !nextBtn || !track) return;
    titleEl.textContent = String(title || 'Ladder');
    subEl.textContent = String(subtitle || '');
    nextBtn.style.display = canContinue ? 'inline-flex' : 'none';
    nextBtn.disabled = false;
    if (exitBtn) exitBtn.disabled = false;
    renderLadderTrackInto(track);
    wrap.style.display = 'flex';
}

function applyLadderStepSelection(){
    if (!isLadderRunning()) return false;
    const step = ladderRun.steps?.[ladderRun.current];
    if (!step) return false;

    selectedPlayer = ladderRun.playerChar;
    selectedPlayerDeckId = ladderRun.playerDeckId || selectedPlayerDeckId;

    selectedAI = step.opponent;
    selectedAIDeckId = step.deckId || ((typeof getDefaultDeckIdForCharacter === 'function') ? getDefaultDeckIdForCharacter(selectedAI) : null);

    __fightAiChosen = true;

    if (typeof window.setAIDifficulty === 'function') window.setAIDifficulty(step.difficulty);
    const aiSel = document.getElementById('ai-difficulty-select');
    if (aiSel) aiSel.value = step.difficulty;
    return true;
}

function startLadderGame(){
    if (hasActiveLanSession()) {
        alert('Ladder Mode is offline vs AI only. Leave LAN PvP first.');
        return;
    }

    ensureValidDeckSelection('player');
    ladderRun = buildLadderRun(selectedPlayer, selectedPlayerDeckId);
    if (!applyLadderStepSelection()) return;
    hideLadderTransition();
    showLadderIntro();
}

function ladderContinue(){
    if (!isLadderRunning()) return;
    if (!applyLadderStepSelection()) return;
    hideLadderTransition();
    startGame({ fromLadder: true });
}

function ladderBeginFromIntro(){
    if (!isLadderRunning()) return;
    if (!applyLadderStepSelection()) return;
    hideLadderIntro();
    startGame({ fromLadder: true });
}

function ladderCancelIntro(){
    hideLadderIntro();
    resetLadderRun();
}

function handleBattleOutcome(playerWon){
    const won = !!playerWon;

    if (!ladderRun) {
        setTimeout(() => alert(won ? 'You Win!' : 'You Lose!'), 200);
        return;
    }

    const step = ladderRun.steps?.[ladderRun.current];
    if (!step) {
        resetLadderRun();
        return;
    }

    if (won) {
        step.result = 'won';
        if (ladderRun.current >= ladderRun.steps.length - 1) {
            ladderRun.active = false;
            ladderRun.status = 'complete';
            renderLadderHud();
            showLadderTransition('LADDER COMPLETE', 'You conquered all 6 opponents.', false);
            return;
        }

        ladderRun.current += 1;
        renderLadderHud();
        const next = ladderRun.steps[ladderRun.current];
        showLadderTransition('VICTORY', `Next: ${getCharacterLabel(next.opponent)} (${String(next.difficulty).toUpperCase()})`, true);
    } else {
        step.result = 'lost';
        ladderRun.active = false;
        ladderRun.status = 'failed';
        renderLadderHud();
        showLadderTransition('LADDER FAILED', `You fell on fight ${ladderRun.current + 1} of ${ladderRun.steps.length}.`, false);
    }
}

window.startLadderGame = startLadderGame;
window.ladderContinue = ladderContinue;
window.ladderBeginFromIntro = ladderBeginFromIntro;
window.ladderCancelIntro = ladderCancelIntro;
window.handleBattleOutcome = handleBattleOutcome;

// ------------------------
// Deck selection helpers
// ------------------------

function getDeckDefsForChar(charName){
    if(typeof getDecksForCharacter === 'function'){
        return getDecksForCharacter(charName) || [];
    }
    const c = classData?.[charName];
    const ids = c?.deckIds || [];
    return ids.map(id => (window.DecksDB ? window.DecksDB[id] : null)).filter(Boolean);
}

function getDeckIdsForChar(charName){
    return getDeckDefsForChar(charName).map(d => d.id);
}

function getDeckName(deckId){
    const def = (typeof getDeckDef === 'function') ? getDeckDef(deckId) : (window.DecksDB ? window.DecksDB[deckId] : null);
    return def?.name || deckId;
}

function getDeckDescription(deckId){
    const def = (typeof getDeckDef === 'function') ? getDeckDef(deckId) : (window.DecksDB ? window.DecksDB[deckId] : null);
    return def?.description || '';
}

function isDeckLocked(target){
    // In Fighting View, once the player LOCKS IN, their character+deck should not change.
    if(getCharSelectView && getCharSelectView() === 'fight' && target === 'player' && __fightPlayerLocked) return true;
    return false;
}

function ensureValidDeckSelection(target){
    const charName = (target === 'player') ? selectedPlayer : selectedAI;
    const ids = getDeckIdsForChar(charName);
    if(ids.length === 0) return;

    let cur = (target === 'player') ? selectedPlayerDeckId : selectedAIDeckId;
    if(!cur || !ids.includes(cur)){
        const mem = __deckChoiceMemory[target]?.[charName];
        if(mem && ids.includes(mem)){
            cur = mem;
        }else{
            cur = (typeof getDefaultDeckIdForCharacter === 'function') ? getDefaultDeckIdForCharacter(charName) : ids[0];
        }
    }

    if(target === 'player') selectedPlayerDeckId = cur;
    else selectedAIDeckId = cur;
}

function selectDeck(target, deckId){
    if(isDeckLocked(target)) return;
    if(target === 'player') selectedPlayerDeckId = deckId;
    if(target === 'ai') selectedAIDeckId = deckId;

    const charName = (target === 'player') ? selectedPlayer : selectedAI;
    __deckChoiceMemory[target][charName] = deckId;
    renderDeckPickers();
}

window.selectDeck = selectDeck;

function renderDeckPickerInto(containerId, target){
    const el = document.getElementById(containerId);
    if(!el) return;

    const charName = (target === 'player') ? selectedPlayer : selectedAI;

    // In Fighting View, hide the opponent deck picker until the opponent is actually chosen.
    if(getCharSelectView && getCharSelectView() === 'fight' && target === 'ai' && !__fightAiChosen){
        el.innerHTML = '';
        el.style.display = 'none';
        return;
    }

    el.style.display = 'flex';

    const deckIds = getDeckIdsForChar(charName);
    if(deckIds.length <= 1){
        // If there's only one deck, keep the picker hidden (cleaner UX).
        el.innerHTML = '';
        el.style.display = 'none';
        ensureValidDeckSelection(target);
        return;
    }

    ensureValidDeckSelection(target);

    const selected = (target === 'player') ? selectedPlayerDeckId : selectedAIDeckId;
    const locked = isDeckLocked(target);

    el.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'deck-picker-title';
    title.innerText = 'Deck';
    el.appendChild(title);

    for(const id of deckIds){
        const btn = document.createElement('button');
        btn.className = 'deck-btn';
        if(id === selected) btn.classList.add('selected');
        if(locked) btn.classList.add('locked');
        btn.disabled = locked;

        btn.innerText = getDeckName(id).replace(/^(.*?)(?:\u2014|-)\s*/, ''); // keep it short
        btn.onclick = (e) => {
            e.stopPropagation();
            selectDeck(target, id);
        };

        // Tooltip (same style as pitch-tooltip)
        const tip = document.createElement('div');
        tip.className = 'pitch-tooltip';
        const desc = getDeckDescription(id);
        tip.innerHTML = `<b style="color: #f1c40f;">${getDeckName(id)}</b><hr style="border-color:#555;margin:4px 0;">${desc || ''}`;
        btn.appendChild(tip);

        el.appendChild(btn);
    }
}

function renderDeckPickers(){
    // Validate current selections (custom decks may have been added/removed)
    ensureValidDeckSelection('player');
    ensureValidDeckSelection('ai');

    // TCG view containers
    renderDeckPickerInto('player-deck-picker', 'player');
    renderDeckPickerInto('ai-deck-picker', 'ai');

    // Fighting view containers
    renderDeckPickerInto('fight-player-deck-picker', 'player');
    renderDeckPickerInto('fight-ai-deck-picker', 'ai');
}

window.renderDeckPickers = renderDeckPickers;


function computeFightRosterCols(n){
    // Keep roster at 3 rows to avoid an overly wide strip.
    return Math.max(3, Math.ceil((n || 1) / 3));
}

function buildFightRoster(){
    const el = document.getElementById('fight-roster');
    if(!el) return;

    el.innerHTML = '';
    const chars = getAllCharacters();
    const cols = computeFightRosterCols(chars.length);
    el.style.setProperty('--roster-cols', String(cols));

    chars.forEach((name, i) => {
        const btn = document.createElement('button');
        btn.className = 'char-btn';
        btn.style.backgroundImage = `url('${charImages[name]}')`;
        btn.dataset.charKey = name;
        btn.onclick = () => selectFightChar(name, btn);

        const row = Math.floor(i / cols);
        btn.dataset.row = String(row);
        btn.dataset.stagger = (row % 2 === 1) ? '1' : '0';

        const span = document.createElement('span');
        span.innerText = getCharacterLabel(name);
        btn.appendChild(span);

        const t = document.createElement('div');
        t.className = 'pitch-tooltip';
        const premise = classData?.[name]?.premise || classData?.[name]?.passiveDesc || '';
        t.innerHTML = `<b style="color: #f1c40f;">The ${getCharacterLabel(name)}</b><hr style="border-color:#555;margin:4px 0;">${premise}`;
        btn.appendChild(t);

        el.appendChild(btn);
    });
}


// ------------------------
// Dynamic TCG rosters (player + opponent)
// ------------------------

function createTcgCharButton(target, name, rosterId){
    const btn = document.createElement('button');
    btn.className = 'char-btn';
    btn.style.backgroundImage = `url('${charImages[name]}')`;
    btn.dataset.charKey = name;
    btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectChar(target, name, rosterId, btn);
    };

    const span = document.createElement('span');
    span.innerText = getCharacterLabel(name);
    btn.appendChild(span);

    const t = document.createElement('div');
    t.className = 'pitch-tooltip';
    const premise = classData?.[name]?.premise || classData?.[name]?.passiveDesc || '';
    t.innerHTML = `<b style="color: #f1c40f;">The ${getCharacterLabel(name)}</b><hr style="border-color:#555;margin:4px 0;">${premise}`;
    btn.appendChild(t);

    return btn;
}

function buildTCGRosters(){
    const p = document.getElementById('player-roster');
    const a = document.getElementById('ai-roster');
    if(!p || !a) return;

    const chars = getAllCharacters();

    p.innerHTML = '';
    a.innerHTML = '';

    for(const name of chars){
        const btnP = createTcgCharButton('player', name, 'player-roster');
        if(name === selectedPlayer) btnP.classList.add('selected');
        p.appendChild(btnP);

        const btnA = createTcgCharButton('ai', name, 'ai-roster');
        if(name === selectedAI) btnA.classList.add('ai-selected');
        a.appendChild(btnA);
    }

    // Keep deck pickers consistent with current selections.
    ensureValidDeckSelection('player');
    ensureValidDeckSelection('ai');
    renderDeckPickers();
}

window.buildTCGRosters = buildTCGRosters;
function selectChar(target, charName, rosterId = null, btnEl = null) {
    if(music.select.paused) music.select.play().catch(e=>console.log("BGM blocked"));


    // If the player LOCKED IN in Fighting View, don't allow changing the player pick from the TCG roster.
    if(target === 'player' && __fightPlayerLocked) return;

    const rosterEl = document.getElementById(rosterId || `${target}-roster`);
    if(!rosterEl) { console.warn("Roster not found for", target, rosterId); return; }

    const selectedClass = (target === 'player') ? 'selected' : 'ai-selected';
    const rosterButtons = rosterEl.children;

    for(let btn of rosterButtons) btn.classList.remove(selectedClass);

    const clicked = btnEl || (typeof event !== 'undefined' ? event.currentTarget : null);
    if(clicked) clicked.classList.add(selectedClass);

    if(target === 'player') selectedPlayer = charName;
    if(target === 'ai') { selectedAI = charName; __fightAiChosen = true; }


    // Keep deck selection valid for the newly chosen character
    ensureValidDeckSelection(target);
    renderDeckPickers();

    // Keep both views in sync (TCG roster and Fighting roster)
    syncSelectionAcrossViews();

    // Update portraits in Fighting view if it's active
    if(getCharSelectView() === 'fight') updateFightingPortraits();
}



let __charSelectView = 'tcg';

function getCharSelectView(){
    return __charSelectView;
}

function setCharSelectView(mode){
    __charSelectView = (mode === 'fight') ? 'fight' : 'tcg';

    const tcg = document.getElementById('char-select-tcg');
    const fight = document.getElementById('char-select-fight');
    if(tcg) tcg.style.display = (__charSelectView === 'tcg') ? 'block' : 'none';
    if(fight) fight.style.display = (__charSelectView === 'fight') ? 'block' : 'none';

    const bTcg = document.getElementById('view-btn-tcg');
    const bFight = document.getElementById('view-btn-fight');
    if(bTcg) bTcg.classList.toggle('active', __charSelectView === 'tcg');
    if(bFight) bFight.classList.toggle('active', __charSelectView === 'fight');

    syncSelectionAcrossViews();
    if(__charSelectView === 'fight'){
        buildFightRoster();

        // In Fighting View we pick PLAYER first, then pick AI after lock-in.
        __fightPhase = 'player';
        __fightPlayerLocked = false;
        __fightAiChosen = false;
        updateFightPrompt();
        updateFightingPortraits();
        renderDeckPickers();
    }else{
        renderDeckPickers();
    }
}

function syncSelectionAcrossViews(){
    // Mark the correct selection for both rosters (if present)
    markRosterSelection('player-roster', 'selected', selectedPlayer);
    markRosterSelection('ai-roster', 'ai-selected', selectedAI);

    // Fighting View uses a single roster that can show both selections.
    markFightRosterSelections();

    // Deck selection UI (both views)
    renderDeckPickers();
}

function markFightRosterSelections(){
    const el = document.getElementById('fight-roster');
    if(!el) return;
    for(const btn of el.children){
        btn.classList.remove('selected','ai-selected','locked-player');
        const key = btn.dataset.charKey || btn.querySelector('span')?.innerText?.trim();
        if(key === selectedPlayer){
            btn.classList.add('selected');
            if(__fightPlayerLocked) btn.classList.add('locked-player');
        }
        if(__fightAiChosen && key === selectedAI){
            btn.classList.add('ai-selected');
        }
    }
}

function markRosterSelection(rosterId, selectedClass, charName){
    const el = document.getElementById(rosterId);
    if(!el) return;
    for(const btn of el.children){
        btn.classList.remove(selectedClass);
        const key = btn.dataset.charKey || btn.querySelector('span')?.innerText?.trim();
        if(key === charName) btn.classList.add(selectedClass);
    }
}

function updateFightingPortraits(){
    const pData = classData[selectedPlayer];
    const aData = __fightAiChosen ? classData[selectedAI] : null;

    const pPortrait = document.getElementById('fight-player-portrait');
    const aPortrait = document.getElementById('fight-ai-portrait');
    if(pPortrait) pPortrait.style.backgroundImage = `url('${charImages[selectedPlayer]}')`;
    if(aPortrait){
        if(__fightAiChosen){
            aPortrait.style.backgroundImage = `url('${charImages[selectedAI]}')`;
            aPortrait.style.opacity = '1';
        }else{
            aPortrait.style.backgroundImage = 'none';
            aPortrait.style.opacity = '0.35';
        }
    }

    const pName = document.getElementById('fight-player-name');
    const aName = document.getElementById('fight-ai-name');
    if(pName) pName.innerText = getCharacterLabel(selectedPlayer);
    if(aName) aName.innerText = __fightAiChosen ? getCharacterLabel(selectedAI) : '???';

    // Fighting View uses the same "pitch" tooltip style as TCG View.
    // We show the character premise on hover over the big portrait.
    const pTip = document.getElementById('fight-player-tooltip');
    const aTip = document.getElementById('fight-ai-tooltip');
    if(pTip){
        const premise = pData?.premise || pData?.passiveDesc || '';
        pTip.innerHTML = `<b style="color: #f1c40f;">The ${getCharacterLabel(selectedPlayer)}</b><hr style="border-color:#555;margin:4px 0;">${premise}`;
    }
    if(aTip){
        if(__fightAiChosen && aData){
            const premise = aData?.premise || aData?.passiveDesc || '';
            aTip.innerHTML = `<b style="color: #f1c40f;">The ${getCharacterLabel(selectedAI)}</b><hr style="border-color:#555;margin:4px 0;">${premise}`;
        }else{
            aTip.innerHTML = '';
        }
    }
}

function updateFightPrompt(){
    const prompt = document.getElementById('fight-prompt');
    const lockBtn = document.getElementById('fight-lock-btn');

    if(__fightPhase === 'player'){
        if(prompt) prompt.innerText = 'Choose your fighter';
        if(lockBtn){
            lockBtn.style.display = 'inline-block';
            lockBtn.classList.remove('locked');
            lockBtn.disabled = false;
            lockBtn.innerText = 'LOCK IN';
        }
    }else{
        if(prompt) prompt.innerText = 'Choose opponent';
        if(lockBtn){
            lockBtn.style.display = 'inline-block';
            lockBtn.classList.add('locked');
            lockBtn.disabled = true;
            lockBtn.innerText = 'LOCKED';
        }
    }
}

function fightLockIn(){
    if(__fightPhase !== 'player') return;
    __fightPlayerLocked = true;
    __fightPhase = 'ai';
    __fightAiChosen = false;
    updateFightPrompt();
    syncSelectionAcrossViews();
    updateFightingPortraits();
}

function selectFightChar(charName, btnEl){
    if(music.select.paused) music.select.play().catch(e=>console.log('BGM blocked'));

    // During player phase: set player selection.
    if(__fightPhase === 'player'){
        selectedPlayer = charName;
    }else{
        selectedAI = charName;
        __fightAiChosen = true;
    }


    // Keep deck selection valid for the chosen character
    ensureValidDeckSelection(__fightPhase === 'player' ? 'player' : 'ai');
    renderDeckPickers();

    // Keep TCG rosters synced, then re-mark the single fighting roster.
    syncSelectionAcrossViews();
    updateFightingPortraits();
}

function setFightOpponentPreview(charName, deckId = null){
    const next = String(charName || '').trim();
    if(!next) return;
    selectedAI = next;
    if(deckId){
        selectedAIDeckId = String(deckId);
    }
    __fightAiChosen = true;
    ensureValidDeckSelection('ai');
    syncSelectionAcrossViews();
    updateFightingPortraits();
}
window.setFightOpponentPreview = setFightOpponentPreview;

// Expose for inline onclick handlers
window.selectFightChar = selectFightChar;
window.fightLockIn = fightLockIn;

// Make sure the toggle is available for inline onclick handlers
window.setCharSelectView = setCharSelectView;

// Default character select view: Fighting View
window.addEventListener('load', () => {
    /* Hard-reset initial screen visibility to prevent battle UI showing under menu */
    const cs = document.getElementById('char-select-screen');
    const gs = document.getElementById('game-screen');
    if (gs) gs.style.display = 'none';
    if (cs) cs.style.display = 'flex';

    try { buildTCGRosters(); } catch(e) { /* ignore */ }
    try { setCharSelectView('fight'); } catch(e) { /* ignore */ }

    /* Deck pickers depend on roster + selections */
    try { ensureValidDeckSelection('player'); ensureValidDeckSelection('ai'); } catch(e) {}
    try { renderDeckPickers(); } catch(e) {}

    const aiDifficultySelect = document.getElementById('ai-difficulty-select');
    if (aiDifficultySelect) {
        aiDifficultySelect.value = aiDifficulty;
        aiDifficultySelect.addEventListener('change', function() {
            window.setAIDifficulty(aiDifficultySelect.value);
        });
    }
});



// ===== Battle Log: collapsible header =====
function ensureBattleLogUI(){
    const el = document.getElementById('battle-log');
    if(!el) return;
    if(el.querySelector('.log-header')) return;

    el.innerHTML = `
      <div class="log-header" style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;">
        <strong>Battle Log</strong>
        <button id="battle-log-toggle" title="Minimize" style="background:rgba(255,255,255,0.08); color:#fff; border:1px solid rgba(255,255,255,0.18); border-radius:8px; padding:4px 10px; cursor:pointer;">-</button>
      </div>
      <div class="log-body"></div>
    `;
    const btn = document.getElementById('battle-log-toggle');
    btn.onclick = () => {
        const collapsed = el.classList.toggle('collapsed');
        btn.textContent = collapsed ? '+' : '-';
        btn.title = collapsed ? 'Expand' : 'Minimize';
    };
}

function clearBattleLog(){
    ensureBattleLogUI();
    const body = document.querySelector('#battle-log .log-body');
    if(body) body.innerHTML = '';
}

function setBattleLogDefaultCollapsed(){
    ensureBattleLogUI();
    const el = document.getElementById('battle-log');
    if(!el) return;
    const btn = document.getElementById('battle-log-toggle');
    const isCoarse = !!(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
    if(isCoarse){
        el.classList.add('collapsed');
    } else {
        el.classList.remove('collapsed');
    }
    if(btn){
        const collapsed = el.classList.contains('collapsed');
        btn.textContent = collapsed ? '+' : '-';
        btn.title = collapsed ? 'Expand' : 'Minimize';
    }
}
window.setBattleLogDefaultCollapsed = setBattleLogDefaultCollapsed;

function buildHeroTooltipHtml(charName, cData) {
    const profs = [];
    if (cData && cData.class) profs.push(String(cData.class).toUpperCase());
    for (const t of ((cData && cData.talents) || [])) profs.push(String(t).toUpperCase());
    const chips = profs.map(p => '<span class="tt-prof-chip">' + p + '</span>').join('');
    const passive = (cData && cData.passiveDesc) ? cData.passiveDesc : 'No passive ability.';
    return '<div class="tt-title">' + getCharacterLabel(charName) + '</div>' +
        '<div class="tt-passive">' + passive + '</div>' +
        '<div class="tt-profs">' + chips + '</div>';
}

function applyBattleMetaFromState() {
    const pName = state?.player?.class || selectedPlayer;
    const aiName = state?.ai?.class || selectedAI;

    const pData = classData?.[pName] || {};
    const aiData = classData?.[aiName] || {};

    const pClassEl = document.getElementById('p-class-name');
    const aiClassEl = document.getElementById('ai-class-name');
    if (pClassEl) pClassEl.innerText = getCharacterLabel(pName || '');
    if (aiClassEl) aiClassEl.innerText = getCharacterLabel(aiName || '');

    const pPortrait = document.getElementById('p-portrait');
    const aiPortrait = document.getElementById('ai-portrait');
    if (pPortrait && charImages?.[pName]) pPortrait.style.backgroundImage = `url('${charImages[pName]}')`;
    if (aiPortrait && charImages?.[aiName]) aiPortrait.style.backgroundImage = `url('${charImages[aiName]}')`;

    const pTip = document.getElementById('p-portrait-tooltip');
    const aiTip = document.getElementById('ai-portrait-tooltip');
    if (pTip) pTip.innerHTML = buildHeroTooltipHtml(pName, pData);
    if (aiTip) aiTip.innerHTML = buildHeroTooltipHtml(aiName, aiData);

    const pArmorEl = document.getElementById('p-armor');
    const aiArmorEl = document.getElementById('ai-armor');
    if (pArmorEl) pArmorEl.innerText = (typeof getEffectiveArmor === 'function') ? getEffectiveArmor('player') : (state?.player?.armor ?? pData.armor ?? 0);
    if (aiArmorEl) aiArmorEl.innerText = (typeof getEffectiveArmor === 'function') ? getEffectiveArmor('ai') : (state?.ai?.armor ?? aiData.armor ?? 0);
}

window.applyBattleMetaFromState = applyBattleMetaFromState;
function startGame(opts = {}) {
    // Fighting View convenience:
    // - If player didn't press LOCK IN, we treat their current pick as locked.
    // - If opponent wasn't chosen yet, we randomize it from remaining characters.
    if(getCharSelectView() === 'fight'){
        if(!__fightPlayerLocked) __fightPlayerLocked = true;
        const lanHostPvp = !!(window.__ssLanPvpMode && window.__ssLanPvpMode.enabled && window.__ssLanPvpMode.role === 'host');
        if(!__fightAiChosen){
            if (lanHostPvp && selectedAI) {
                __fightAiChosen = true;
            } else {
                selectedAI = pickRandomOpponent(selectedPlayer);
                __fightAiChosen = true;

                // If we randomize the opponent, also pick a deck for them.
                if(typeof pickRandomDeckIdForCharacter === 'function'){
                    selectedAIDeckId = pickRandomDeckIdForCharacter(selectedAI);
                }else{
                    selectedAIDeckId = null;
                }
            }
        }
    }

    music.select.pause(); music.select.currentTime = 0; music.battle.play().catch(e=>console.log("Battle BGM blocked"));
    document.getElementById('char-select-screen').style.display = 'none'; document.getElementById('game-screen').style.display = 'flex';
    hideLadderTransition();
    hideLadderIntro();
    state.aiDifficulty = aiDifficulty;
    
    // Build the decks and stats from registries (cards / decks / characters)
    ensureValidDeckSelection('player');
    ensureValidDeckSelection('ai');

    const pData = classData[selectedPlayer];
    const pDeckId = selectedPlayerDeckId || (typeof getDefaultDeckIdForCharacter === 'function' ? getDefaultDeckIdForCharacter(selectedPlayer) : null);
    state.player = { 
        class: selectedPlayer, 
        hp: pData.maxHp || 40, 
        maxHp: pData.maxHp || 40, 
        stam: pData.maxStam, 
        maxStam: pData.maxStam, 
        armor: pData.armor, 
        timeline: [null, null, null, null, null], 
        hand: [], 
        deck: (typeof buildDeckFromDeckId === 'function' && pDeckId) ? buildDeckFromDeckId(pDeckId) : (typeof buildDeck === 'function' ? buildDeck(pData.deck) : []),
        statuses: getBaseStatuses(), 
        roundData: { lostLife: false, appliedStatus: false } 
    };

    const aiData = classData[selectedAI];
    const aiDeckId = selectedAIDeckId || (typeof getDefaultDeckIdForCharacter === 'function' ? getDefaultDeckIdForCharacter(selectedAI) : null);
    state.ai = { 
        class: selectedAI, 
        hp: aiData.maxHp || 40, 
        maxHp: aiData.maxHp || 40, 
        stam: aiData.maxStam, 
        maxStam: aiData.maxStam, 
        armor: aiData.armor, 
        timeline: [null, null, null, null, null], 
        hand: [], 
        deck: (typeof buildDeckFromDeckId === 'function' && aiDeckId) ? buildDeckFromDeckId(aiDeckId) : (typeof buildDeck === 'function' ? buildDeck(aiData.deck) : []),
        statuses: getBaseStatuses(), 
        roundData: { lostLife: false, appliedStatus: false } 
    };

    applyBattleMetaFromState();
    renderLadderHud();


    clearBattleLog();
    setBattleLogDefaultCollapsed();
    drawCards(3, 'player'); drawCards(3, 'ai'); 
    nextTurn(true);
}

function backToMenu() {
    resetLadderRun();
    music.battle.pause(); music.battle.currentTime = 0; music.select.play().catch(e=>console.log("Select BGM blocked"));
    document.getElementById('game-screen').style.display = 'none'; document.getElementById('char-select-screen').style.display = 'flex';
}

function log(msg) {
    ensureBattleLogUI();
    const el = document.getElementById('battle-log');
    const body = el.querySelector('.log-body');
    const line = document.createElement('div');
    line.textContent = msg;
    body.appendChild(line);
    if(!el.classList.contains('collapsed')){
        el.scrollTop = el.scrollHeight;
    }
}

function getAbilityCard(className, index) {
    try {
        const id = (typeof getAbilityIdForCharacter === 'function') ? getAbilityIdForCharacter(className, index) : null;
        if(!id) return null;
        if(!window.CardsDB || !window.CardsDB[id]) return null;
        return { ...window.CardsDB[id] };
    } catch(e){
        console.warn('getAbilityCard failed', e);
        return null;
    }
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
    const defenseUI = document.getElementById('defense-controls');
    
    if (state.phase === 'exert' || state.phase === 'net_wait_exert') {
        if (exertUI) exertUI.style.display = 'flex';
        if (actionUI) actionUI.style.display = 'none';
        if (defenseUI) defenseUI.style.display = 'none';
    } else if (state.phase === 'planning' || state.phase === 'pivot_wait') { // <-- FIXED HERE
        if (exertUI) exertUI.style.display = 'none';
        if (actionUI) actionUI.style.display = 'flex';
        if (defenseUI) defenseUI.style.display = 'flex';
    } else if (state.phase === 'net_wait_lock' || state.phase === 'net_wait_pivot_lock') {
        if (exertUI) exertUI.style.display = 'none';
        if (actionUI) actionUI.style.display = 'flex';
        if (defenseUI) defenseUI.style.display = 'none';
    } else {
        // Hide both during clash/resolution
        if (exertUI) exertUI.style.display = 'none';
        if (actionUI) actionUI.style.display = 'none';
        if (defenseUI) defenseUI.style.display = 'none';
    }
    
    document.getElementById('p-hp-bar').style.height = `${(state.player.hp / state.player.maxHp) * 100}%`;
    document.getElementById('p-hp-label').innerText = `${state.player.hp}/${state.player.maxHp}`;
    document.getElementById('p-stam-bar').style.height = `${(state.player.stam / state.player.maxStam) * 100}%`;
    document.getElementById('p-stam-label').innerText = `${state.player.stam}/${state.player.maxStam}`;

    document.getElementById('ai-hp-bar').style.height = `${(state.ai.hp / state.ai.maxHp) * 100}%`;
    document.getElementById('ai-hp-label').innerText = `${state.ai.hp}/${state.ai.maxHp}`;
    // LAN PvP fog-of-war: do not reveal opponent stamina changes during hidden planning phases.
    let shownAiStam = state.ai.stam;
    const lanMode = !!(window.__ssLanPvpMode && window.__ssLanPvpMode.enabled);
    const hiddenNetPhase =
        state.phase === 'exert' ||
        state.phase === 'planning' ||
        state.phase === 'pivot_wait' ||
        state.phase === 'flash' ||
        state.phase === 'net_wait_lock' ||
        state.phase === 'net_wait_exert' ||
        state.phase === 'net_wait_flash' ||
        state.phase === 'net_wait_pivot_lock';
    if (lanMode) {
        if (!window.__ssLanOpponentStamFog) window.__ssLanOpponentStamFog = { active: false, stam: null };
        const fog = window.__ssLanOpponentStamFog;
        if (hiddenNetPhase) {
            if (!fog.active) {
                fog.active = true;
                fog.stam = Number(state.ai.stam || 0);
            }
            shownAiStam = Number(fog.stam || 0);
        } else {
            fog.active = false;
            fog.stam = null;
        }
    }
    document.getElementById('ai-stam-bar').style.height = `${(shownAiStam / state.ai.maxStam) * 100}%`;
    document.getElementById('ai-stam-label').innerText = `${shownAiStam}/${state.ai.maxStam}`;

    const waitEl = document.getElementById('net-wait-indicator');
    if (waitEl) {
        let waitMsg = '';
        if (state.phase === 'net_wait_exert') waitMsg = 'Waiting for opponent to confirm exert...';
        else if (state.phase === 'net_wait_lock') waitMsg = 'Waiting for opponent to lock planning...';
        else if (state.phase === 'net_wait_flash') waitMsg = 'Waiting for opponent flash decision...';
        else if (state.phase === 'net_wait_pivot_lock') waitMsg = 'Waiting for opponent to lock pivot...';
        else if (window.__ssLanWaitMessage) waitMsg = String(window.__ssLanWaitMessage);

        if (waitMsg) {
            waitEl.style.display = 'block';
            waitEl.innerText = waitMsg;
        } else {
            waitEl.style.display = 'none';
            waitEl.innerText = '';
        }
    }

    const exertBtn = document.getElementById('btn-confirm-exert');
    if (exertBtn) {
        exertBtn.disabled = (state.phase !== 'exert');
        if (state.phase === 'net_wait_exert') exertBtn.innerText = 'Waiting for Opponent...';
        else if (state.phase === 'exert') exertBtn.innerText = 'Confirm Exert';
    }

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
                        <b>${ability.name}</b>
                    </button>
                    <div class="ability-tooltip ${char}-tooltip">
                        <b style="color: #f1c40f;">${ability.name}</b><br><hr style="border-color: #555; margin: 4px 0;">
                        Cost: ${costDisplay} ST | Time: ${ability.moments} MOM<br>
                        ${ability.dmg > 0 ? `<span style="color:#ffcccc;">DMG: ${ability.dmg}</span><br>` : ''}
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
    
if((statuses.exhausted || 0) > 0) {
    html += `<div class="status-badge status-debuff">${formatKeywords('EXHAUSTED')}</div>`;
    count++;
}
if((statuses.freeze || 0) > 0) {
    const fr = statuses.freeze;
    const taxed = fr >= 10;
    html += `<div class="status-badge status-debuff">${formatKeywords('FREEZE')} (${fr})${taxed ? ' - Attacks +1 ST' : ''}</div>`;
    count++;
}
if((statuses.bleed || 0) > 0) {
    const bl = statuses.bleed;
    html += `<div class="status-badge status-debuff">${formatKeywords('BLEED')} (${bl})</div>`;
    count++;
}
if((statuses.poison || 0) > 0) {
    const ps = statuses.poison;
    html += `<div class="status-badge status-debuff">${formatKeywords('POISON')} (${ps})</div>`;
    count++;
}
if((statuses.hypnotized || 0) > 0) {
    html += `<div class="status-badge status-hypnotized">${formatKeywords('HYPNOTIZED')}</div>`;
    count++;
}
if((statuses.poisonSkinNextTurn || 0) > 0) {
    html += `<div class="status-badge status-buff">Poison Skin (Next Turn)</div>`;
    count++;
}
if((statuses.poisonSkinActive || 0) > 0) {
    html += `<div class="status-badge status-buff">Poison Skin (Active)</div>`;
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



/* === SET_VH_PATCH === */
/* Generated 2026-03-03 15:58:58Z
   Keep CSS in sync with real viewport height on iPad/iOS Safari.
*/
(function setAppVhVar(){
  function apply(){
    try {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    } catch(e){}
  }
  apply();
  window.addEventListener('resize', apply, { passive: true });
  window.addEventListener('orientationchange', apply, { passive: true });
})();

/* === APP_SCALE_PATCH ===
   Scales the main game UI to fit non-16:9 screens (iPad, ultrawide, etc.) without cropping.
   Does NOT scale deck builder overlays/modals (they remain full-size for readability).
*/
(function appScaleToFit(){
  const DESIGN_W = 1024; // baseline layout width after HUD rework
  const DESIGN_H = 700;  // baseline layout height after HUD rework

  function ensureScaleRoot(){
    // Wrap only the main screens (char select + game) so overlays can stay unscaled.
    const body = document.body;
    if(!body) return null;
    let root = document.getElementById('app-scale-root');
    if(root) return root;

    const screens = [];
    const cs = document.getElementById('char-select-screen');
    const gs = document.getElementById('game-screen');
    if(cs) screens.push(cs);
    if(gs) screens.push(gs);
    if(screens.length === 0) return null;

    root = document.createElement('div');
    root.id = 'app-scale-root';

    // Insert root before first screen, then move screens into it.
    body.insertBefore(root, screens[0]);
    screens.forEach(el => root.appendChild(el));
    return root;
  }

  function viewport(){
    // visualViewport helps on iOS (accounts for browser UI bars)
    const vv = window.visualViewport;
    const w = vv?.width || window.innerWidth;
    const h = vv?.height || window.innerHeight;
    return { w, h };
  }

  function apply(){
    const root = ensureScaleRoot();
    if(!root) return;

    const { w, h } = viewport();
    const pad = 8;
    const touchLike = window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    const shouldScale = !!touchLike && (w < DESIGN_W || h < DESIGN_H);
    const scale = shouldScale ? Math.min((w - pad) / DESIGN_W, (h - pad) / DESIGN_H, 1) : 1;

    document.documentElement.style.setProperty('--ui-scale', String(scale));
    document.documentElement.style.setProperty('--ui-inv-scale', String(scale > 0 ? (1/scale) : 1));
  }

  // Apply ASAP and on changes
  apply();
  window.addEventListener('resize', apply, { passive: true });
  window.addEventListener('orientationchange', apply, { passive: true });
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', apply, { passive: true });
    window.visualViewport.addEventListener('scroll', apply, { passive: true });
  }
  document.addEventListener('DOMContentLoaded', apply, { passive: true });
})();







