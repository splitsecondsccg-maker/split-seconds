// engine.js

// 1. ADDED heavy_impact TO THE SOUNDS DICTIONARY
const sounds = { 
    draw: new Audio('draw.mp3'), hit: new Audio('hit.mp3'), heavy_impact: new Audio('heavy_impact.mp3'),
    block: new Audio('block.mp3'), heal: new Audio('heal.mp3'),
    place1: new Audio('place1.mp3'), place2: new Audio('place2.mp3'), 
    place3: new Audio('place3.mp3'), lock: new Audio('lock.mp3') 
};
Object.values(sounds).forEach(sound => sound.volume = 0.6);
const music = { select: new Audio('select.mp3'), battle: new Audio('battle.mp3') };
music.select.loop = true; music.select.volume = 0.5; music.battle.loop = true; music.battle.volume = 0.4;
function playSound(name) { sounds[name].currentTime = 0; sounds[name].play().catch(e=>console.log("Audio muted")); }

function playPlaceSound(moments) {
    if(moments === 1) playSound('place1');
    else if(moments === 2) playSound('place2');
    else playSound('place3');
}

function triggerShake() {
    const screen = document.body; 
    screen.classList.remove('shake'); 
    void screen.offsetWidth; 
    screen.classList.add('shake');
    setTimeout(() => screen.classList.remove('shake'), 300);
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
    dmgMod: 0, nextAtkMod: 0, nextGrabMod: 0, dmgReduction: 0, 
    stamOnBlock: false, drawOnBlock: false, forceBlock: false, drawLess: 0,
    armorDebuff: 0, mustBlock: 0, stamPenalty: 0 
});

const state = {
    player: { class: '', hp: 40, maxHp: 40, stam: 6, maxStam: 6, armor: 0, deck: [], hand: [], timeline: [null, null, null, null, null], statuses: getBaseStatuses(), roundData: { lostLife: false, appliedStatus: false } },
    ai: { class: '', hp: 40, maxHp: 40, stam: 6, maxStam: 6, armor: 0, deck: [], hand: [], timeline: [null, null, null, null, null], statuses: getBaseStatuses(), roundData: { lostLife: false, appliedStatus: false } },
    phase: 'planning', currentMoment: 0
};

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
    document.getElementById('char-select-screen').style.display = 'none'; document.getElementById('game-screen').style.display = 'grid';
    
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
    return null;
}

function useAbility(index) {
    if(state.phase !== 'planning' && state.phase !== 'pivot_wait') return;
    const abilityCard = getAbilityCard(state.player.class, index);
    if(!abilityCard) return;

    const alreadyUsed = state.player.timeline.some(c => c && c.name === abilityCard.name);
    if (alreadyUsed) return alert("This ability can only be used once per turn!");
    if(state.player.stam < abilityCard.cost) return alert("Not enough stamina!");
    
    let slot = -1;
    if (state.phase === 'pivot_wait') {
        for (let i = 0; i < state.pivotSlots.length; i++) {
            let possibleSlot = state.pivotSlots[i];
            let fits = true;
            for (let j = 0; j < abilityCard.moments; j++) { 
                if (!state.pivotSlots.includes(possibleSlot + j) || state.player.timeline[possibleSlot + j] !== null) {
                    fits = false; break;
                }
            }
            if (fits) { slot = possibleSlot; break; }
        }
        if (slot === -1) return alert("Not enough space in the glowing pivot slots!");
    } else {
        for(let i = 0; i <= 5 - abilityCard.moments; i++) {
            let spaceFree = true;
            for(let j = 0; j < abilityCard.moments; j++) { if(state.player.timeline[i + j] !== null) spaceFree = false; }
            if(spaceFree) { slot = i; break; }
        }
        if(slot === -1) return alert("Not enough timeline space!");
    }
    
    state.player.stam -= abilityCard.cost;
    for(let i=0; i<abilityCard.moments; i++) { 
        state.player.timeline[slot + i] = (i === abilityCard.moments - 1) ? { ...abilityCard, uniqueId: 'basic_'+Math.random() } : 'occupied'; 
    }
    
    playPlaceSound(abilityCard.moments); 
    renderPlayerTimeline(); 
    updateUI();
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
            
            container.innerHTML += `
                <div class="ability-wrapper">
                    <button class="ability-btn" ${char === 'player' ? `onclick="useAbility(${i})"` : ''}>
                        🌟 <b>${ability.name}</b>
                    </button>
                    <div class="ability-tooltip ${char}-tooltip">
                        <b style="color: #f1c40f;">${ability.name}</b><br><hr style="border-color: #555; margin: 4px 0;">
                        Cost: ${ability.cost}⚡ | Time: ${ability.moments}⏳<br>
                        ${ability.dmg > 0 ? `<span style="color:#ffcccc;">DMG: ${ability.dmg}⚔️</span><br>` : ''}
                        <i>${ability.desc}</i>
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

function renderHand() {
    const handEl = document.getElementById('player-hand'); handEl.innerHTML = '';
    state.player.hand.forEach((card, index) => {
        let div = document.createElement('div'); 
        div.className = 'card'; 
        
        // Add red glow if selected
        if (card.selectedForExert) {
            div.style.boxShadow = '0 0 12px 4px #ff4757';
            div.style.borderColor = '#ff4757';
            div.style.transform = 'translateY(-5px)';
        }

        if (state.phase === 'planning' || state.phase === 'pivot_wait') {
            div.draggable = true;
            div.ondragstart = (e) => e.dataTransfer.setData('text/plain', JSON.stringify({source: 'hand', card, index}));
        } else if (state.phase === 'exert') {
            div.draggable = false;
            div.style.cursor = 'pointer';
            div.onclick = () => toggleExertCard(index);
        }
        
        div.innerHTML = `
            <div class="card-header"><span>${getIcon(card.type)}</span> <span>${card.name}</span></div>
            <div class="card-stats"><span>⏱ ${card.moments}</span><span>⚡ ${card.cost}</span></div>
            <div class="card-desc">${card.desc ? card.desc : ''}</div>
            ${card.dmg > 0 ? `<div class="card-dmg">${card.dmg} DMG</div>` : ''}
        `;
        handEl.appendChild(div);
    });
}

const pSlots = document.querySelectorAll('#player-timeline .slot');
pSlots.forEach(slot => {
    slot.addEventListener('dragover', e => e.preventDefault());
    slot.addEventListener('drop', e => {
        e.preventDefault(); 
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        if(data.source !== 'hand') return;
        
        const card = data.card; 
        const startMoment = parseInt(slot.dataset.moment) - 1;

        // --- PIVOT LOGIC ---
        if (state.phase === 'pivot_wait') {
            let valid = true;
            for(let i=0; i<card.moments; i++) {
                if (!state.pivotSlots.includes(startMoment + i)) valid = false;
            }
            if (!valid) return alert("During a Pivot, you can only place cards in the highlighted slots!");
        } else if (state.phase !== 'planning') {
            return; 
        }
        // -------------------

        if(startMoment + card.moments > 5) return alert("Not enough space!");
        for(let i=0; i<card.moments; i++) { if(state.player.timeline[startMoment + i] !== null) return alert("Slot occupied!"); }
        if(state.player.stam < card.cost) return alert("Not enough stamina!");

        state.player.stam -= card.cost;
        for(let i=0; i<card.moments; i++) { state.player.timeline[startMoment + i] = i === card.moments - 1 ? card : 'occupied'; }
        
        playPlaceSound(card.moments); 
        state.player.hand.splice(data.index, 1); 
        
        renderPlayerTimeline(); updateUI();
    });
});

const handZone = document.getElementById('player-hand');
handZone.addEventListener('dragover', e => e.preventDefault());
handZone.addEventListener('drop', e => {
    e.preventDefault(); 
    if(state.phase !== 'planning' && state.phase !== 'pivot_wait') return; // UPDATED
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    if(data.source === 'timeline') returnToHand(data.index);
});

function returnToHand(index) {
    if(state.phase !== 'planning' && state.phase !== 'pivot_wait') return;
    
    // PREVENT CHEATING: Only allow picking up cards from the glowing slots during a Pivot
    if (state.phase === 'pivot_wait' && (!state.pivotSlots || !state.pivotSlots.includes(index))) {
        return alert("You can only modify the highlighted slots during a Pivot!");
    }
    
    const card = state.player.timeline[index];
    if(!card || card === 'occupied') return;
    
    state.player.stam += card.cost; 
    const startIdx = index - (card.moments - 1);
    for(let i=0; i<card.moments; i++) state.player.timeline[startIdx + i] = null;
    
    if(card.id || card.uniqueId) state.player.hand.push(card);
    
    renderPlayerTimeline(); updateUI();
}

function addBasicAction(name, cost, moments, dmg, type) {
    if (state.phase !== 'planning' && state.phase !== 'pivot_wait') return;
    if(state.player.stam < cost) return alert("Not enough stamina!");
    
    let slot = -1;
    if (state.phase === 'pivot_wait') {
        for (let i = 0; i < state.pivotSlots.length; i++) {
            let possibleSlot = state.pivotSlots[i];
            let fits = true;
            for (let j = 0; j < moments; j++) { 
                if (!state.pivotSlots.includes(possibleSlot + j) || state.player.timeline[possibleSlot + j] !== null) {
                    fits = false; break;
                }
            }
            if (fits) { slot = possibleSlot; break; }
        }
        if (slot === -1) return alert("Not enough space in the glowing pivot slots!");
    } else {
        for(let i=0; i<=5-moments; i++) {
            let spaceFree = true;
            for(let j=0; j<moments; j++) { if(state.player.timeline[i+j] !== null) spaceFree = false; }
            if(spaceFree) { slot = i; break; }
        }
        if(slot === -1) return alert("Not enough timeline space!");
    }

    state.player.stam -= cost;
    let action = { name, cost, moments, dmg, type, isBasic: true, uniqueId: 'basic_'+Math.random() };
    for(let i=0; i<moments; i++) { state.player.timeline[slot+i] = (i === moments - 1) ? action : 'occupied'; }
    
    playPlaceSound(moments);
    renderPlayerTimeline();
    updateUI();
}

function renderPlayerTimeline() {
    const tl = document.getElementById('player-timeline'); document.querySelectorAll('.player-placed').forEach(e => e.remove());
    let start = -1;
    for(let i=0; i<5; i++) {
        let t = state.player.timeline[i];
        if(t !== null && t !== 'occupied' && start === -1) {
            let m = t.moments; let width = (m * 20) + ((m-1)*2); let left = ((i - m + 1) * 20);
            let div = document.createElement('div'); div.className = 'timeline-card player-placed'; div.id = `p-card-mom-${i+1}`;
            div.style.left = `calc(${left}% + 10px)`; div.style.width = `calc(${width}% - 20px)`; 
            
            div.draggable = true; div.style.cursor = 'pointer'; div.title = "Click or drag to hand to remove";
            div.ondragstart = (e) => e.dataTransfer.setData('text/plain', JSON.stringify({source: 'timeline', index: i}));
            div.onclick = () => returnToHand(i);

            let extraText = '';
            if(t.dmg > 0) extraText = `<span style="color:#ffcccc; font-weight:bold;">${t.dmg} DMG</span>`;
            else if(t.type === 'block') extraText = `<span style="color:#ccffff; font-weight:bold;">🛡️ Block</span>`;
            else if(t.type === 'parry') extraText = `<span style="color:#ccffff; font-weight:bold;">🤺 Parry</span>`;
            else extraText = `<span style="color:#ccffcc; font-weight:bold;">✨ ${t.type}</span>`;

            let icon = getIcon(t.type);
            div.innerHTML = `<strong>${t.name}</strong>${t.desc ? `<div class="card-desc-timeline">${t.desc}</div>` : ''}<div>${icon} ${extraText}</div>`;
            tl.appendChild(div);
        }
    }
}

function renderAITimeline() {
    const isHidden = state.phase === 'planning';
    const tl = document.getElementById('ai-timeline');
    document.querySelectorAll('.ai-placed').forEach(e => e.remove());
    
    if(isHidden) return;

    for(let i=0; i<5; i++) {
        let t = state.ai.timeline[i];
        if(t !== null && t !== 'occupied') {
            let m = t.moments; let width = (m * 20) + ((m-1)*2); let left = ((i - m + 1) * 20);
            let div = document.createElement('div'); div.className = 'timeline-card ai-placed ai-timeline-card'; div.id = `ai-card-mom-${i+1}`;
            div.style.left = `calc(${left}% + 10px)`; div.style.width = `calc(${width}% - 20px)`; 

            let extraText = '';
            if(t.dmg > 0) extraText = `<span style="color:#ffcccc; font-weight:bold;">${t.dmg} DMG</span>`;
            else if(t.type === 'block') extraText = `<span style="color:#ccffff; font-weight:bold;">🛡️ Block</span>`;
            else if(t.type === 'parry') extraText = `<span style="color:#ccffff; font-weight:bold;">🤺 Parry</span>`;
            else extraText = `<span style="color:#ccffcc; font-weight:bold;">✨ ${t.type}</span>`;

            let icon = getIcon(t.type);
            div.innerHTML = `<strong>${t.name}</strong>${t.desc ? `<div class="card-desc-timeline">${t.desc}</div>` : ''}<div>${icon} ${extraText}</div>`;
            tl.appendChild(div);
        }
    }
}

function planAI() {
    if (typeof isTutorialMode !== 'undefined' && isTutorialMode) {
        return; // The tutorial will handle AI placement, don't do random stuff!
    }
    state.ai.timeline = [null, null, null, null, null];
    let slotsLeft = 5; 
    let aiClass = state.ai.class;
    let aiReqBlocks = state.ai.statuses.mustBlock || 0;

    // 1. AI Exert Logic: Discard cards for stamina!
    while (state.ai.stam < 2 && state.ai.hand.length > 1 && state.ai.stam < state.ai.maxStam) {
        state.ai.hand.sort((a, b) => b.cost - a.cost); 
        state.ai.hand.shift(); 
        
        state.ai.stam += 1;
        log("AI EXERTS! Discarded a card for 1 Stamina.");
        spawnFloatingText('ai', '+1 ⚡', 'float-heal');
    }
    // 2. Set virtual stamina AFTER exerting so the AI knows it has the energy!
    let virtualStam = state.ai.stam; 

    // 3. Load BOTH abilities
    let ability1 = getAbilityCard(aiClass, 1);
    let ability2 = getAbilityCard(aiClass, 2);

    for (let i = 0; i < aiReqBlocks; i++) {
        let slot = state.ai.timeline.indexOf(null);
        if (slot !== -1) {
            state.ai.timeline[slot] = { name: 'Block', type: 'block', cost: 0, moments: 1, dmg: 0, isBasic: true };
            slotsLeft--;
        }
    }
    
    for(let i=0; i<5; i++) {
        if(state.ai.timeline[i] !== null) {
            slotsLeft = 5 - (i + 1);
            continue;
        }
        
        let validMoves = [];
        
        validMoves.push({ name: 'Block', type: 'block', cost: 0, moments: 1, dmg: 0, isBasic: true });
        if (virtualStam >= 1) {
            validMoves.push({ name: 'Parry', type: 'parry', cost: 1, moments: 1, dmg: 0, isBasic: true });
        }
        
        // Let the AI consider Ability 1
        if (ability1 && virtualStam >= ability1.cost && slotsLeft >= ability1.moments && !state.ai.timeline.some(c => c && c.name === ability1.name)) {
            validMoves.push(ability1);
        }
        
        // Let the AI consider Ability 2
        if (ability2 && virtualStam >= ability2.cost && slotsLeft >= ability2.moments && !state.ai.timeline.some(c => c && c.name === ability2.name)) {
            validMoves.push(ability2);
        }

        state.ai.hand.forEach(card => {
            if (card.cost <= virtualStam && slotsLeft >= card.moments) validMoves.push(card);
        });

        let chosenMove = null;

        if (state.ai.hp < state.ai.maxHp * 0.4) {
            let defensiveMoves = validMoves.filter(m => m.type === 'block' || m.type === 'parry' || (m.effect && (m.effect.includes('heal') || m.effect.includes('reduce_dmg'))));
            if (defensiveMoves.length > 0 && Math.random() < 0.75) chosenMove = defensiveMoves[Math.floor(Math.random() * defensiveMoves.length)];
        }

        if (!chosenMove && virtualStam >= 2 && (aiClass === 'Brute' || aiClass === 'Paladin' || aiClass === 'Necromancer')) {
            let heavyMoves = validMoves.filter(m => m.cost >= 2);
            if (heavyMoves.length > 0 && Math.random() < 0.6) chosenMove = heavyMoves[Math.floor(Math.random() * heavyMoves.length)];
        }

        if (!chosenMove && (aiClass === 'Rogue' || aiClass === 'Vampiress')) {
            let fastMoves = validMoves.filter(m => m.moments === 1 && (m.type === 'attack' || m.type === 'grab'));
            if (fastMoves.length > 0 && Math.random() < 0.6) chosenMove = fastMoves[Math.floor(Math.random() * fastMoves.length)];
        }
        
        if (!chosenMove) chosenMove = validMoves[Math.floor(Math.random() * validMoves.length)];

        virtualStam -= chosenMove.cost; 
        
        for(let j=0; j < chosenMove.moments - 1; j++) state.ai.timeline[i+j] = 'occupied';
        state.ai.timeline[i + (chosenMove.moments - 1)] = chosenMove; 
        
        if (!chosenMove.isBasic) {
            let handIndex = state.ai.hand.findIndex(c => c.uniqueId === chosenMove.uniqueId);
            if(handIndex !== -1) state.ai.hand.splice(handIndex, 1);
        }

        i += (chosenMove.moments - 1);
        slotsLeft = 5 - (i + 1);
    }
    
    renderAITimeline(); 
    updateUI();
}

function getActiveCard(charKey, momentIndex) {
    let action = state[charKey].timeline[momentIndex];
    if (action && action !== 'occupied') return action;
    if (action === 'occupied') {
        for (let i = momentIndex + 1; i < 5; i++) {
            let fwd = state[charKey].timeline[i];
            if (fwd && fwd !== 'occupied') {
                let startIndex = i - (fwd.moments - 1);
                if (momentIndex >= startIndex && momentIndex <= i) return fwd;
            }
        }
    }
    return null;
}

function getCardData(side, momentIndex) {
    let timeline = state[side].timeline;
    let item = timeline[momentIndex];

    if (!item) return { card: null, startIndex: -1 };

    // If it found the actual Card Object (which we now store at the END of the sequence)
    if (typeof item === 'object' && item !== 'occupied') {
        return {
            card: item,
            startIndex: momentIndex - (item.moments - 1)
        };
    }

    // If it found an 'occupied' slot, look FORWARD to find the Card Object
    if (item === 'occupied') {
        for (let i = momentIndex + 1; i < 5; i++) {
            if (typeof timeline[i] === 'object' && timeline[i] !== 'occupied') {
                return {
                    card: timeline[i],
                    startIndex: i - (timeline[i].moments - 1)
                };
            }
        }
    }

    return { card: null, startIndex: -1 };
}

function generateCardHTML(card) {
    return `
        <div class="card" style="width: 100%; height: 100%; margin: 0; box-sizing: border-box; cursor: default;">
            <div class="card-header"><span>${getIcon(card.type)}</span> <span>${card.name}</span></div>
            <div class="card-stats"><span>⏱ ${card.moments}</span><span>⚡ ${card.cost}</span></div>
            <div class="card-desc">${card.desc ? card.desc : ''}</div>
            ${card.dmg > 0 ? `<div class="card-dmg">${card.dmg} DMG</div>` : ''}
        </div>
    `;
}

function startResolution() {
    // --- Tutorial gating (data-driven via tutorial.js `expect`) ---
    if (typeof isTutorialMode !== 'undefined' && isTutorialMode) {
        const step = (typeof tutorialSteps !== 'undefined' && tutorialSteps[currentStep]) ? tutorialSteps[currentStep] : null;
        const expect = step ? step.expect : null;
        if (expect !== 'lock') return;

        // Optional: enforce Slot 1 for lessons that require it.
        if (typeof step.requiredSlot === 'number' && step.requiredSlot === 0 && !state.player.timeline[0]) {
            alert("Coach: Make sure you place your action in Slot 1!");
            for (let i = 0; i < 5; i++) {
                if (state.player.timeline[i]) {
                    state.player.stam += (state.player.timeline[i].cost || 0);
                    if (!state.player.timeline[i].isBasic) state.player.hand.push(state.player.timeline[i]);
                    state.player.timeline[i] = null;
                }
            }
            updateUI();
            runStep();
            return;
        }

        // Advance the tutorial immediately on successful LOCK.
        advanceTutorial();
    }
    // --- If they click Lock to finish a pivot ---
    if (state.phase === 'pivot_wait') {
        handleAIReaction();
        return;
    }
    // ----------------------------------------------------

    if (state.phase !== 'planning') return;
    // --- SCARE ENFORCEMENT ---
    const playerBlocks = state.player.timeline.filter(c => c && c.type === 'block').length;
    if (state.player.statuses.mustBlock > 0 && playerBlocks < state.player.statuses.mustBlock) {
        return alert(`⚠️ SCARED: You must place at least ${state.player.statuses.mustBlock} Block(s) this turn!`);
    }
    state.player.statuses.mustBlock = 0; 
    state.ai.statuses.mustBlock = 0;
    state.phase = 'flash';
    document.querySelectorAll('button').forEach(b => b.disabled = true);
    
    // Pick the flash moment (tutorial can force a specific one)
    if (typeof isTutorialMode !== 'undefined' && isTutorialMode && typeof tutorialSteps !== 'undefined' && tutorialSteps[currentStep] && typeof tutorialSteps[currentStep].forceFlashMoment === 'number') {
        state.flashMoment = Math.max(0, Math.min(4, tutorialSteps[currentStep].forceFlashMoment));
    } else {
        state.flashMoment = Math.floor(Math.random() * 5);
    }
    // --- ADD THE HIGHLIGHT GLOW ---
    const pSlot = document.querySelector(`#player-timeline .slot:nth-child(${state.flashMoment + 1})`);
    const aiSlot = document.querySelector(`#ai-timeline .slot:nth-child(${state.flashMoment + 1})`);
    if (pSlot) pSlot.classList.add('flash-highlight');
    if (aiSlot) aiSlot.classList.add('flash-highlight');
    // ------------------------------
    log(`[PRECOGNITION FLASH] Moment ${state.flashMoment + 1} revealed!`);
    playSound('heavy_impact');
    
    let pData = getCardData('player', state.flashMoment);
    let aiData = getCardData('ai', state.flashMoment);
    
    // --- ANTI-CHEAT SNAPSHOT ---
    // Save exactly what was revealed so the AI can't look at the player's new cards later!
    state.originalPCard = pData.card;
    state.originalAICard = aiData.card;
    // ---------------------------
    
    document.getElementById('flash-p-card').innerHTML = pData.card ? generateCardHTML(pData.card) : '<div class="empty-flash">EMPTY SLOT</div>';
    document.getElementById('flash-ai-card').innerHTML = aiData.card ? generateCardHTML(aiData.card) : '<div class="empty-flash">EMPTY SLOT</div>';
    document.getElementById('flash-moment-title').innerText = `FLASH: MOMENT ${state.flashMoment + 1}`;
    
    document.getElementById('flash-modal').style.display = 'flex';
    document.querySelectorAll('#flash-modal button').forEach(b => b.disabled = false);

}

function lockIn() {
    // --- Tutorial gating (data-driven via tutorial.js `expect`) ---
    if (typeof isTutorialMode !== 'undefined' && isTutorialMode) {
        const step = (typeof tutorialSteps !== 'undefined' && tutorialSteps[currentStep]) ? tutorialSteps[currentStep] : null;
        const expect = step ? step.expect : null;
        if (expect !== 'lockIn') return;
        advanceTutorial();
    }

    // Remove the glow
    document.querySelectorAll('.slot').forEach(s => s.classList.remove('flash-highlight'));
    
    document.getElementById('flash-modal').style.display = 'none';
    log("Player Locks In!");
    handleAIReaction();

}

function pivot() {
    // --- Tutorial gating (data-driven via tutorial.js `expect`) ---
    if (typeof isTutorialMode !== 'undefined' && isTutorialMode) {
        const step = (typeof tutorialSteps !== 'undefined' && tutorialSteps[currentStep]) ? tutorialSteps[currentStep] : null;
        const expect = step ? step.expect : null;
        if (expect !== 'pivot') return;
        advanceTutorial();
    }
    if (state.player.stam < 1) return alert("Not enough stamina to Pivot!");
    // Remove the glow (it will be replaced by the yellow Pivot glow)
    document.querySelectorAll('.slot').forEach(s => s.classList.remove('flash-highlight'));
    let pData = getCardData('player', state.flashMoment);
    state.player.stam -= 1; // Tax
    
    let startIndex = state.flashMoment;
    let momentsFreed = 1;

    if (pData.card) {
        // --- BULLETPROOF START INDEX CALCULATION ---
        let cardIndex = state.player.timeline.indexOf(pData.card);
        startIndex = cardIndex - (pData.card.moments - 1);
        momentsFreed = pData.card.moments;
        // -------------------------------------------

        state.player.stam = Math.min(state.player.maxStam, state.player.stam + (pData.card.cost || 0)); 
        if (!pData.card.isBasic) state.player.hand.push(pData.card);
        for(let i=0; i<momentsFreed; i++) state.player.timeline[startIndex + i] = null; 
    } else {
        state.player.timeline[state.flashMoment] = null;
    }
    
    state.phase = 'pivot_wait';
    
    state.pivotSlots = [];
    for(let i=0; i<momentsFreed; i++) state.pivotSlots.push(startIndex + i);
    
    document.getElementById('flash-modal').style.display = 'none';
    document.querySelectorAll('button').forEach(b => b.disabled = false);
    
    renderPlayerTimeline(); updateUI();
    
    state.pivotSlots.forEach(slotIdx => {
        let slotEl = document.querySelector(`#player-timeline .slot:nth-child(${slotIdx+1})`);
        if(slotEl) slotEl.style.boxShadow = '0 0 15px 5px #f1c40f';
    });
    
    log("Player Pivots! Fill the glowing slots, then click your main LOCK IN button.");

}

function handleAIReaction() {
    state.phase = 'resolution';
    document.querySelectorAll('button').forEach(b => b.disabled = true);
    
    if (state.pivotSlots) {
        state.pivotSlots.forEach(slotIdx => {
            let glow = document.querySelector(`#player-timeline .slot:nth-child(${slotIdx+1})`);
            if(glow) glow.style.boxShadow = 'none';
        });
        state.pivotSlots = null;
    }
    
    // THE AI NO LONGER CHEATS! 
    // It only uses the cards that were originally revealed in the flash.
    let aiCard = state.originalAICard; 
    let pCard = state.originalPCard;
    
    // We still need the AI's current data just to know where to clear its own timeline
    let aiData = getCardData('ai', state.flashMoment); 
    let shouldPivot = false;

    // --- AI PIVOT EVALUATION LOGIC (Based ONLY on the original flash) ---
    if (aiCard && pCard) {
        if (aiCard.type === 'attack' && pCard.type === 'parry') shouldPivot = true; 
        if (aiCard.type === 'grab' && pCard.type === 'attack') shouldPivot = true; 
        if (aiCard.type === 'attack' && aiCard.dmg >= 3 && pCard.type === 'block' && Math.random() < 0.6) shouldPivot = true;
        if (state.ai.hp < state.ai.maxHp * 0.4 && pCard.type === 'attack' && pCard.dmg >= 3 && aiCard.type !== 'block' && aiCard.type !== 'parry' && Math.random() < 0.8) shouldPivot = true;
    }

    // --- EXECUTE THE AI PIVOT ---
    if (shouldPivot && state.ai.stam >= 1) {
        state.ai.stam -= 1; // Pay the Pivot Tax
        
        let pivotStartIndex = state.flashMoment;
        let momentsFreed = 1;
        
        if (aiCard) {
            pivotStartIndex = aiData.startIndex;
            momentsFreed = aiCard.moments;
            state.ai.stam = Math.min(state.ai.maxStam, state.ai.stam + (aiCard.cost || 0)); 
            if (!aiCard.isBasic) state.ai.hand.push(aiCard); 
            for(let i=0; i<momentsFreed; i++) state.ai.timeline[pivotStartIndex + i] = null; 
        } else {
             state.ai.timeline[state.flashMoment] = null;
        }

        // --- AI MINI-PLANNING ---
        let currentSlot = pivotStartIndex;
        let slotsLeftToFill = momentsFreed;
        let virtualStam = state.ai.stam;

        while (slotsLeftToFill > 0) {
            let validMoves = [];
            validMoves.push({ name: 'Block', type: 'block', cost: 0, moments: 1, dmg: 0, isBasic: true });
            if (virtualStam >= 1) validMoves.push({ name: 'Parry', type: 'parry', cost: 1, moments: 1, dmg: 0, isBasic: true });
            
            state.ai.hand.forEach(c => {
                if (c.cost <= virtualStam && c.moments <= slotsLeftToFill) validMoves.push(c);
            });

            let chosenMove = null;

            // The AI attempts a counter-strategy based ONLY on the card it saw you reveal!
            if (pCard && pCard.type === 'parry') {
                 let grabs = validMoves.filter(m => m.type === 'grab');
                 if (grabs.length > 0) chosenMove = grabs[Math.floor(Math.random() * grabs.length)];
            }
            else if (state.ai.hp < state.ai.maxHp * 0.4 && pCard && pCard.type === 'attack' && pCard.dmg >= 3) {
                let defensiveMoves = validMoves.filter(m => m.type === 'parry' || m.type === 'block');
                if (defensiveMoves.length > 0) chosenMove = defensiveMoves[Math.floor(Math.random() * defensiveMoves.length)];
            }

            if (!chosenMove) chosenMove = validMoves[Math.floor(Math.random() * validMoves.length)];

            virtualStam -= chosenMove.cost;
            state.ai.stam -= chosenMove.cost;
            
            for(let j=0; j < chosenMove.moments; j++) {
                state.ai.timeline[currentSlot + j] = (j === chosenMove.moments - 1) ? chosenMove : 'occupied';
            }
            
            if (!chosenMove.isBasic) {
                let handIdx = state.ai.hand.findIndex(c => c.uniqueId === chosenMove.uniqueId);
                if(handIdx !== -1) state.ai.hand.splice(handIdx, 1);
            }

            currentSlot += chosenMove.moments;
            slotsLeftToFill -= chosenMove.moments;
        }

        log(`AI saw your reveal and PIVOTED its strategy!`);
        spawnFloatingText('ai', 'PIVOT!', 'float-dmg'); 
    } else {
        log(`AI Locks In its plan.`);
    }

    renderAITimeline(); updateUI();
    
    setTimeout(() => {
        state.currentMoment = 0; 
        resolveMoment(); 
    }, 1000); 
}
function resolveMoment() {
    if (state.currentMoment > 4) { 
        if (state.player.class === 'Necromancer' && state.player.roundData.appliedStatus) { state.player.stam = Math.min(state.player.maxStam, state.player.stam + 1); log("Player Necromancer gained 1 Stam (Passive)."); }
        if (state.ai.class === 'Necromancer' && state.ai.roundData.appliedStatus) { state.ai.stam = Math.min(state.ai.maxStam, state.ai.stam + 1); log("AI Necromancer gained 1 Stam (Passive)."); }
        if (state.player.class === 'Brute' && state.player.roundData.lostLife) { state.player.stam = Math.min(state.player.maxStam, state.player.stam + 1); log("Player Brute gained 1 Stam (Passive)."); }
        if (state.ai.class === 'Brute' && state.ai.roundData.lostLife) { state.ai.stam = Math.min(state.ai.maxStam, state.ai.stam + 1); log("AI Brute gained 1 Stam (Passive)."); }
        setTimeout(() => nextTurn(), 1500); return; 
    }
    
    // 1. Clear all previous glows from both slots AND cards
    document.querySelectorAll('.slot, .card').forEach(el => {
        el.style.boxShadow = 'none';
        el.style.filter = 'none'; // Clear any brightness filters
    });

    // 2. Identify the current slots
    // Highlight the resolving slots/cards (Balatro-style guidance)
    const pSlots = Array.from(document.querySelectorAll('#player-timeline .slot'));
    const aiSlots = Array.from(document.querySelectorAll('#ai-timeline .slot'));
    const clearResolveGlow = (slots) => {
        slots.forEach(slot => {
            slot.classList.remove('resolving-slot');
            slot.style.boxShadow = '';
            const card = slot.querySelector('.card');
            if (card) {
                card.style.filter = '';
                card.style.zIndex = '';
            }
        });
    };
    clearResolveGlow(pSlots);
    clearResolveGlow(aiSlots);

    const pSlot = pSlots[state.currentMoment];
    const aiSlot = aiSlots[state.currentMoment];
    if (pSlot) pSlot.classList.add('resolving-slot');
    if (aiSlot) aiSlot.classList.add('resolving-slot');
    let pAction = state.player.timeline[state.currentMoment];
    let aiAction = state.ai.timeline[state.currentMoment];

    let pActive = getActiveCard('player', state.currentMoment);
    let aiActive = getActiveCard('ai', state.currentMoment);

    if(pAction && pAction !== 'occupied') { document.getElementById(`p-card-mom-${state.currentMoment+1}`)?.classList.add('resolving'); }
    if(aiAction && aiAction !== 'occupied') { document.getElementById(`ai-card-mom-${state.currentMoment+1}`)?.classList.add('resolving'); }

    let pDmg = 0; let aiDmg = 0;
    let pBlock = false; let aiBlock = false; let pParry = false; let aiParry = false; let pGrab = false; let aiGrab = false;

    if(state.player.statuses.forceBlock && pAction && pAction !== 'occupied') { log("Player is Intimidated! Action fails."); pAction = null; }
    if(state.ai.statuses.forceBlock && aiAction && aiAction !== 'occupied') { log("AI is Intimidated! Action fails."); aiAction = null; }

    if(pAction && pAction !== 'occupied') {
        if(pAction.type === 'attack') { 
            let roguePenalty = state.player.statuses.rogueDebuff || 0;
            pDmg = pAction.dmg + state.player.statuses.nextAtkMod - roguePenalty; 
            state.player.statuses.nextAtkMod = 0; state.player.statuses.rogueDebuff = 0; 
        }
        if(pAction.type === 'parry') pParry = true;
        if(pAction.type === 'grab') { pGrab = true; pDmg = (pAction.dmg || 0) + state.player.statuses.nextGrabMod; state.player.statuses.nextGrabMod = 0; }
    }
    
    if (pActive && pActive.type === 'block') pBlock = true;

    if(aiAction && aiAction !== 'occupied') {
        state.ai.stam = Math.max(0, state.ai.stam - (aiAction.cost || 0)); 
        if(aiAction.type === 'attack') { 
            let roguePenalty = state.ai.statuses.rogueDebuff || 0;
            aiDmg = aiAction.dmg + state.ai.statuses.nextAtkMod - roguePenalty; 
            state.ai.statuses.nextAtkMod = 0; state.ai.statuses.rogueDebuff = 0; 
        }
        if(aiAction.type === 'parry') aiParry = true;
        if(aiAction.type === 'grab') { aiGrab = true; aiDmg = (aiAction.dmg || 0) + state.ai.statuses.nextGrabMod; state.ai.statuses.nextGrabMod = 0; }
    }

    if (aiActive && aiActive.type === 'block') aiBlock = true;

    let pGrabHit = false; let aiGrabHit = false;

    if(pGrab) {
        if(aiBlock || aiParry) { pGrabHit = true; log(`Player ${pAction.name} GRABS!`); }
        else if(aiAction && aiAction.type === 'attack') { pDmg = 0; log("Player Grab interrupted!"); }
        else { pDmg = 0; log("Player Grab misses."); }
    }
    if(aiGrab) {
        if(pBlock || pParry) { aiGrabHit = true; log(`AI ${aiAction.name} GRABS!`); }
        else if(pAction && pAction.type === 'attack') { aiDmg = 0; log("AI Grab interrupted!"); }
        else { aiDmg = 0; log("AI Grab misses."); }
    }

    if(pParry && aiDmg > 0 && !aiGrab) { aiDmg = 0; log(`Player PARRIES!`); spawnFloatingText('player', 'PARRY', 'float-block'); playSound('block'); state.ai.statuses.drawLess = 1; }
    if(aiParry && pDmg > 0 && !pGrab) { pDmg = 0; log(`AI PARRIES!`); spawnFloatingText('ai', 'PARRY', 'float-block'); playSound('block'); state.player.statuses.drawLess = 1; }

    // --- FIXED ARMOR LOGIC: Now safely catches ALL active blocks properly ---
    if(pBlock && aiDmg > 0 && !aiGrab) { 
        if (pActive.name === 'Bone Cage') {
            if(pActive.currentBlock === undefined) pActive.currentBlock = 6;
            let blocked = Math.min(aiDmg, pActive.currentBlock);
            aiDmg -= blocked; pActive.currentBlock -= blocked;
            log(`Player's Bone Cage absorbs ${blocked} DMG!`); spawnFloatingText('player', 'CAGE', 'float-block'); playSound('block');
        } else { 
            let effectiveArmor = Math.max(0, state.player.armor - (state.player.statuses.armorDebuff || 0));
            aiDmg = Math.max(0, aiDmg - effectiveArmor); 
            log(`Player blocks!`); spawnFloatingText('player', 'BLOCK', 'float-block'); playSound('block'); 
            if(state.player.class === 'Paladin' && pAction && pAction.type === 'block') { state.player.statuses.nextAtkMod += 1; log("Player Paladin Passive: +1 DMG next attack!"); }
            if(state.player.statuses.stamOnBlock && pAction && pAction.type === 'block') state.player.stam = Math.min(state.player.maxStam, state.player.stam + 1);
            if(state.player.statuses.drawOnBlock && pAction && pAction.type === 'block') { drawCards(1); state.player.statuses.drawOnBlock = false; }
        }
    }
    
    if(aiBlock && pDmg > 0 && !pGrab) { 
        if (aiActive.name === 'Bone Cage') {
            if(aiActive.currentBlock === undefined) aiActive.currentBlock = 6;
            let blocked = Math.min(pDmg, aiActive.currentBlock);
            pDmg -= blocked; aiActive.currentBlock -= blocked;
            log(`AI's Bone Cage absorbs ${blocked} DMG!`); spawnFloatingText('ai', 'CAGE', 'float-block'); playSound('block');
        } else {
            let effectiveArmor = Math.max(0, state.ai.armor - (state.ai.statuses.armorDebuff || 0));
            pDmg = Math.max(0, pDmg - effectiveArmor); 
            log(`AI blocks!`); spawnFloatingText('ai', 'BLOCK', 'float-block'); playSound('block'); 
            if(state.ai.class === 'Paladin' && aiAction && aiAction.type === 'block') { state.ai.statuses.nextAtkMod += 1; log("AI Paladin Passive: +1 DMG next attack!"); }
            if(state.ai.statuses.stamOnBlock && aiAction && aiAction.type === 'block') state.ai.stam = Math.min(state.ai.maxStam, state.ai.stam + 1);
        }
    }

    // 1. Apply Damage Reduction (e.g., Brace)
    if(pDmg > 0) pDmg = Math.max(0, pDmg - (state.ai.statuses.dmgReduction || 0));
    if(aiDmg > 0) aiDmg = Math.max(0, aiDmg - (state.player.statuses.dmgReduction || 0));
    
    // 3. Apply Final Damage ONCE (Attack vs Attack resolves simultaneously here)
    if(pDmg > 0) { 
        state.ai.hp -= pDmg; state.ai.roundData.lostLife = true;
        log(`Player hits for ${pDmg}!`); spawnFloatingText('ai', `-${pDmg}`, 'float-dmg'); 
        if(pAction && pAction.moments >= 3) { playSound('heavy_impact'); triggerShake(); } else playSound('hit');
        
        // Passives - FIXED ROGUE LOGIC
        if(state.player.class === 'Vampiress') { state.player.statuses.nextAtkMod += 1; log("Player Vampiress Passive: +1 DMG next attack!"); }
        if(state.player.class === 'Rogue') { state.ai.statuses.rogueDebuff = (state.ai.statuses.rogueDebuff || 0) + 1; log("Player Rogue Passive: AI next attack -1 DMG!"); }
    }
    
    if(aiDmg > 0) { 
        state.player.hp -= aiDmg; state.player.roundData.lostLife = true;
        log(`AI hits for ${aiDmg}!`); spawnFloatingText('player', `-${aiDmg}`, 'float-dmg'); 
        if(aiAction && aiAction.moments >= 3) { playSound('heavy_impact'); triggerShake(); } else playSound('hit');

        // Passives - FIXED ROGUE LOGIC
        if(state.ai.class === 'Vampiress') { state.ai.statuses.nextAtkMod += 1; log("AI Vampiress Passive: +1 DMG next attack!"); }
        if(state.ai.class === 'Rogue') { state.player.statuses.rogueDebuff = (state.player.statuses.rogueDebuff || 0) + 1; log("AI Rogue Passive: Player next attack -1 DMG!"); }
    }

    // 4. Trigger Effects
    if(pAction && pAction.effect) applyEffect('player', 'ai', pAction.effect, { hitLanded: pDmg > 0, grabHit: pGrabHit, targetBlocked: aiBlock, targetParried: aiParry, dmgOut: pDmg });
    if(aiAction && aiAction.effect) applyEffect('ai', 'player', aiAction.effect, { hitLanded: aiDmg > 0, grabHit: aiGrabHit, targetBlocked: pBlock, targetParried: pParry, dmgOut: aiDmg });

    updateUI();
    if(state.player.hp <= 0 || state.ai.hp <= 0) {
        setTimeout(() => alert(state.player.hp <= 0 ? "You Lose!" : "You Win!"), 500);
        return;
    }

    state.currentMoment++;
    setTimeout(resolveMoment, 1200);
}

function applyEffect(sourceKey, targetKey, effectString, context = {}) {
    const source = state[sourceKey];
    const target = state[targetKey];
    
    switch(effectString) {
        case 'heal_1_on_hit': 
            if (context.hitLanded || context.grabHit) {
                source.hp = Math.min(source.maxHp, source.hp + 1); log(`${sourceKey} heals 1!`); spawnFloatingText(sourceKey, '+1', 'float-heal'); playSound('heal'); 
            }
            break;
        case 'heal_2_on_hit': 
            if (context.hitLanded || context.grabHit) {
                source.hp = Math.min(source.maxHp, source.hp + 2); log(`${sourceKey} heals 2!`); spawnFloatingText(sourceKey, '+2', 'float-heal'); playSound('heal'); 
            }
            break;
        case 'poison_dagger':
            if (context.hitLanded) {
                target.hp -= 1;
                target.roundData.lostLife = true;
                log(`${sourceKey}'s Poison Dagger deals 1 extra DMG!`);
                spawnFloatingText(targetKey, '-1', 'float-dmg');
            }
            break;
        case 'heal_3': 
            source.hp = Math.min(source.maxHp, source.hp + 3); log(`${sourceKey} heals 3!`); 
            spawnFloatingText(sourceKey, '+3', 'float-heal'); playSound('heal'); break;
        case 'heal_5': 
            source.hp = Math.min(source.maxHp, source.hp + 5); log(`${sourceKey} heals 5!`); 
            spawnFloatingText(sourceKey, '+5', 'float-heal'); playSound('heal'); break;
        case 'gain_stam_1': 
            source.stam = Math.min(source.maxStam, source.stam + 1); log(`${sourceKey} recovers 1 Stamina!`); break;
        case 'gain_stam_2': 
            source.stam = Math.min(source.maxStam, source.stam + 2); log(`${sourceKey} recovers 2 Stamina!`); break;
        case 'buff_next_atk_3': 
            source.statuses.nextAtkMod += 3; log(`${sourceKey} empowers next attack (+3 DMG)`); break;
        case 'buff_next_atk_5': 
            source.statuses.nextAtkMod += 5; log(`${sourceKey} unleashes a Warcry! (+5 DMG to next attack)`); break;
        case 'reduce_dmg_3': 
            source.statuses.dmgReduction += 3; log(`${sourceKey} braces (-3 DMG taken this turn)`); break;
        case 'draw_1':
            if(sourceKey === 'player') { drawCards(1); log(`Player draws 1 card!`); } 
            else { log(`AI repositions and prepares...`); } break;
        case 'pierce':
            if(context.targetBlocked) { 
                let effectiveArmor = Math.max(0, target.armor - target.statuses.armorDebuff);
                context.dmgOut += effectiveArmor; 
                log(`${sourceKey} PIERCES right through the armor!`); 
            } break;
        case 'exhaust_1':
            if(context.grabHit) { target.stam = Math.max(0, target.stam - 1); log(`${sourceKey} EXHAUSTS 1 of ${targetKey}'s stamina!`); source.roundData.appliedStatus = true; } break;
        case 'sunder':
            target.statuses.armorDebuff += 2; log(`${targetKey}'s armor is SUNDERED!`); source.roundData.appliedStatus = true; break;
        case 'steal_stam':
            if(target.stam > 0) { target.stam--; source.stam = Math.min(source.maxStam, source.stam + 1); log(`${sourceKey} STOLE 1 Stamina!`); } 
            else { log(`${sourceKey} tried to steal stamina, but ${targetKey} is exhausted!`); } break;
        case 'meditate':
            source.stam = Math.min(source.maxStam, source.stam + 2);
            if(sourceKey === 'player') drawCards(1, 'player'); 
            log(`${sourceKey} MEDITATES: Gains 2 Stamina & draws a card!`);
            break;
        case 'scare':
            target.statuses.mustBlock += 1;
            if(sourceKey === 'player') drawCards(1, 'player'); log(`${targetKey} is SCARED! Must block next turn.`); 
            source.roundData.appliedStatus = true; break;
        case 'siphon_soul':
            if(context.hitLanded) { 
                source.statuses.nextAtkMod += 3;
                log(`${sourceKey} Siphons Soul! Next attack gains +3 DMG.`);
            }
            break;
        case 'chiller':
            if(context.hitLanded) { target.statuses.stamPenalty += 1; log(`${targetKey} is CHILLED! Stamina recovery heavily reduced.`); source.roundData.appliedStatus = true; } break;
    }
}

function nextTurn(isFirstTurn = false) {
    state.phase = 'exert'; // 1. Start in the Exert Phase
    document.body.classList.add('exert-mode');
    document.querySelectorAll('button').forEach(b => b.disabled = false);
    document.querySelectorAll('.slot').forEach(s => s.style.backgroundColor = 'transparent');
    
    if(isFirstTurn) {
        state.player.statuses = getBaseStatuses();
        state.ai.statuses = getBaseStatuses();
    } else {
        // Regen stamina
        let pStamRec = Math.max(0, 3 - state.player.statuses.stamPenalty);
        let aiStamRec = Math.max(0, 3 - state.ai.statuses.stamPenalty);

        state.player.stam = Math.min(state.player.maxStam, state.player.stam + pStamRec);
        state.ai.stam = Math.min(state.ai.maxStam, state.ai.stam + aiStamRec);

        // Reset statuses
        state.player.statuses.dmgReduction = 0; state.player.statuses.forceBlock = false; state.player.statuses.drawOnBlock = false; state.player.statuses.stamOnBlock = false; state.player.statuses.armorDebuff = 0; state.player.statuses.stamPenalty = 0; state.player.statuses.rogueDebuff = 0;
        state.ai.statuses.dmgReduction = 0; state.ai.statuses.forceBlock = false; state.ai.statuses.drawOnBlock = false; state.ai.statuses.stamOnBlock = false; state.ai.statuses.armorDebuff = 0; state.ai.statuses.stamPenalty = 0; state.ai.statuses.rogueDebuff = 0;
    }
    
    state.player.roundData = { lostLife: false, appliedStatus: false };
    state.ai.roundData = { lostLife: false, appliedStatus: false };
    state.player.timeline = [null, null, null, null, null]; 
    state.ai.timeline = [null, null, null, null, null];
    document.querySelectorAll('.player-placed').forEach(e => e.remove());
    
    // Toggle UI for Exert Phase
    document.getElementById('action-controls').style.display = 'none';
    const exertUI = document.getElementById('exert-controls');
    if (exertUI) exertUI.style.display = 'flex';
    document.getElementById('btn-confirm-exert').innerText = "Confirm Exert (0⚡)";

    const tutorialActive = (typeof isTutorialMode !== 'undefined' && isTutorialMode);
    if (!tutorialActive && !isFirstTurn && state.player.hand.length === 0) {
        // Auto-skip exert if hand is empty (disabled during tutorial to avoid soft-locks)
        confirmExert();
    } else {
        log("--- EXERT PHASE ---");
        log("Click cards to burn for Stamina, or click Confirm to skip.");
        updateUI();
    }
}


function toggleExertCard(index) {
    if (state.phase !== 'exert') return;
    
    let card = state.player.hand[index];
    card.selectedForExert = !card.selectedForExert;
    
    let selectedCount = state.player.hand.filter(c => c.selectedForExert).length;
    document.getElementById('btn-confirm-exert').innerText = `Confirm Exert (+${selectedCount}⚡)`;
    
    playSound('draw');
    updateUI();
}

function confirmExert() {
    if (state.phase !== 'exert') return;

    // Tutorial: confirm exert is the expected action for some steps.
    if (typeof isTutorialMode !== 'undefined' && isTutorialMode) {
        const step = (typeof tutorialSteps !== 'undefined' && tutorialSteps[currentStep]) ? tutorialSteps[currentStep] : null;
        if (!step || step.expect !== 'confirmExert') return;
        advanceTutorial();
    }
    document.body.classList.remove('exert-mode');

    // 1. Process Player Discards
    let keptCards = [];
    let burnedCount = 0;
    state.player.hand.forEach(card => {
        if (card.selectedForExert) {
            burnedCount++;
            delete card.selectedForExert;
        } else {
            delete card.selectedForExert;
            keptCards.push(card);
        }
    });
    
    state.player.hand = keptCards;
    let actualStamGained = Math.min(state.player.maxStam - state.player.stam, burnedCount);
    state.player.stam += actualStamGained;
    
    if (burnedCount > 0) {
        log(`Player burned ${burnedCount} card(s) for ${actualStamGained} Stamina.`);
        spawnFloatingText('player', `+${actualStamGained} ⚡`, 'float-heal');
    }

    // 2. Process AI Discards (Moved from planAI)
    let aiBurned = 0;
    while (state.ai.stam < 2 && state.ai.hand.length > 1 && state.ai.stam < state.ai.maxStam) {
        state.ai.hand.sort((a, b) => b.cost - a.cost); 
        state.ai.hand.shift(); 
        state.ai.stam += 1;
        aiBurned++;
    }
    if (aiBurned > 0) {
        log(`AI burned ${aiBurned} card(s) for Stamina.`);
        spawnFloatingText('ai', `+${aiBurned} ⚡`, 'float-heal');
    }

    // 3. DRAW CARDS!
    let pDraw = Math.max(0, 2 - state.player.statuses.drawLess);
    if (pDraw > 0) drawCards(pDraw, 'player'); 
    else if (state.player.statuses.drawLess > 0) log("Player draws 0 cards due to being parried!");

    let aiDraw = Math.max(0, 2 - state.ai.statuses.drawLess);
    if (aiDraw > 0) drawCards(aiDraw, 'ai');
    
    state.player.statuses.drawLess = 0; 
    state.ai.statuses.drawLess = 0;

    // 4. Move to Planning Phase
    state.phase = 'planning';
    const exertUI = document.getElementById('exert-controls');
    if (exertUI) exertUI.style.display = 'none';
    document.getElementById('action-controls').style.display = 'flex';
    
    planAI(); // AI plans AFTER getting its new hand
    document.querySelectorAll('button').forEach(b => b.disabled = false);
    updateUI();
}
// Modal Dragging Logic
let flashModal = document.getElementById("flash-modal");
let fHeader = document.getElementById("flash-header");
let isDragging = false, offX, offY;

fHeader.addEventListener("mousedown", e => {
    isDragging = true;
    offX = e.clientX - flashModal.offsetLeft;
    offY = e.clientY - flashModal.offsetTop;
});
document.addEventListener("mousemove", e => {
    if (!isDragging) return;
    flashModal.style.left = (e.clientX - offX) + "px";
    flashModal.style.top = (e.clientY - offY) + "px";
    flashModal.style.marginLeft = "0"; // Override center alignment once dragged
});
document.addEventListener("mouseup", () => isDragging = false);

function toggleFlashSize() {
    let body = document.getElementById("flash-body");
    body.style.display = body.style.display === "none" ? "block" : "none";
}