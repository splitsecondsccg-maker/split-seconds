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
        if (ability1 && virtualStam >= getMoveCost('ai', ability1) && slotsLeft >= ability1.moments && !state.ai.timeline.some(c => c && c.name === ability1.name)) {
            validMoves.push(ability1);
        }
        
        // Let the AI consider Ability 2
        if (ability2 && virtualStam >= getMoveCost('ai', ability2) && slotsLeft >= ability2.moments && !state.ai.timeline.some(c => c && c.name === ability2.name)) {
            validMoves.push(ability2);
        }

        state.ai.hand.forEach(card => {
            if (getMoveCost('ai', card) <= virtualStam && slotsLeft >= card.moments) validMoves.push(card);
        });

        let chosenMove = null;

        if (state.ai.hp < state.ai.maxHp * 0.4) {
            let defensiveMoves = validMoves.filter(m => m.type === 'block' || m.type === 'parry' || (m.effect && (m.effect.includes('heal') || m.effect.includes('reduce_dmg'))));
            if (defensiveMoves.length > 0 && Math.random() < 0.75) chosenMove = defensiveMoves[Math.floor(Math.random() * defensiveMoves.length)];
        }

        if (!chosenMove && virtualStam >= 2 && (aiClass === 'Mauja' || aiClass === 'Paladin' || aiClass === 'Necromancer')) {
            let heavyMoves = validMoves.filter(m => m.cost >= 2);
            if (heavyMoves.length > 0 && Math.random() < 0.6) chosenMove = heavyMoves[Math.floor(Math.random() * heavyMoves.length)];
        }

        if (!chosenMove && (aiClass === 'Rogue' || aiClass === 'Vampiress')) {
            let fastMoves = validMoves.filter(m => m.moments === 1 && (m.type === 'attack' || m.type === 'grab'));
            if (fastMoves.length > 0 && Math.random() < 0.6) chosenMove = fastMoves[Math.floor(Math.random() * fastMoves.length)];
        }
        
        if (!chosenMove) chosenMove = validMoves[Math.floor(Math.random() * validMoves.length)];

        virtualStam -= getMoveCost('ai', chosenMove); 
        
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
            <div class="card-desc">${formatKeywords(card.desc ? card.desc : '')}</div>
            ${card.dmg > 0 ? `<div class="card-dmg">${card.dmg} DMG</div>` : ''}
        </div>
    `;
}

function _startResolutionImpl() {
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

// Queue wrapper (keeps UX identical, prevents input races)
function startResolution() {
    if (!window.EngineRuntime) return _startResolutionImpl();
    window.EngineRuntime.dispatch({ type: window.EngineRuntime.ActionTypes.START_RESOLUTION, payload: {} });
}

function _lockInImpl() {
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

function lockIn() {
    if (!window.EngineRuntime) return _lockInImpl();
    window.EngineRuntime.dispatch({ type: window.EngineRuntime.ActionTypes.LOCK_IN, payload: {} });
}

function _pivotImpl() {
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

        state.player.stam = Math.min(state.player.maxStam, state.player.stam + (pData.card.paidCost ?? pData.card.cost ?? 0)); 
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

function pivot() {
    if (!window.EngineRuntime) return _pivotImpl();
    window.EngineRuntime.dispatch({ type: window.EngineRuntime.ActionTypes.PIVOT, payload: {} });
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
            state.ai.stam = Math.min(state.ai.maxStam, state.ai.stam + (aiCard.paidCost ?? getMoveCost('ai', aiCard) ?? aiCard.cost ?? 0)); 
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
                if (getMoveCost('ai', c) <= virtualStam && c.moments <= slotsLeftToFill) validMoves.push(c);
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

            virtualStam -= getMoveCost('ai', chosenMove);
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
