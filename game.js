function aiGetDifficulty() {
    const level = String(state.aiDifficulty || (window.getAIDifficulty ? window.getAIDifficulty() : 'hard') || 'hard').toLowerCase();
    if (level === 'normal' || level === 'hard' || level === 'pro') return level;
    return 'hard';
}

function aiGetMind() {
    if (!state.aiMind) {
        state.aiMind = {
            revealed: { attack: 0, grab: 0, block: 0, parry: 0, buff: 0, utility: 0 },
            roundsSeen: 0,
            adapt: {
                aggression: 0.5,
                defense: 0.5,
                antiParry: 0.5,
                antiGrab: 0.5
            }
        };
    }
    return state.aiMind;
}
function aiRememberReveal(card) {
    if (!card) return;
    const mind = aiGetMind();
    const type = String(card.type || 'utility');
    if (typeof mind.revealed[type] !== 'number') mind.revealed[type] = 0;
    mind.revealed[type] += 1;
    mind.roundsSeen += 1;
}

function aiLearnFromRound() {
    if (aiGetDifficulty() !== 'pro') return;
    const mind = aiGetMind();

    const aiLost = !!state.ai?.roundData?.lostLife;
    const pLost = !!state.player?.roundData?.lostLife;

    // Gentle decay so the AI evolves but does not lock into one script forever.
    const nudgeToMid = (v) => (v * 0.88) + (0.5 * 0.12);
    mind.adapt.aggression = nudgeToMid(mind.adapt.aggression);
    mind.adapt.defense = nudgeToMid(mind.adapt.defense);
    mind.adapt.antiParry = nudgeToMid(mind.adapt.antiParry);
    mind.adapt.antiGrab = nudgeToMid(mind.adapt.antiGrab);

    if (aiLost && !pLost) {
        mind.adapt.defense = Math.min(1, mind.adapt.defense + 0.11);
        mind.adapt.antiGrab = Math.min(1, mind.adapt.antiGrab + 0.09);
        mind.adapt.aggression = Math.max(0, mind.adapt.aggression - 0.05);
    } else if (pLost && !aiLost) {
        mind.adapt.aggression = Math.min(1, mind.adapt.aggression + 0.11);
        mind.adapt.antiParry = Math.min(1, mind.adapt.antiParry + 0.08);
        mind.adapt.defense = Math.max(0, mind.adapt.defense - 0.04);
    } else if (pLost && aiLost) {
        mind.adapt.antiParry = Math.min(1, mind.adapt.antiParry + 0.04);
        mind.adapt.antiGrab = Math.min(1, mind.adapt.antiGrab + 0.04);
    }
}

window.aiLearnFromRound = aiLearnFromRound;
function aiBuildHandModel(hand) {
    const model = {
        attack: 0, grab: 0, block: 0, parry: 0, buff: 0, utility: 0,
        enhancer: 0, total: 0, highDmg: 0, avgCost: 0, avgMoments: 1
    };
    if (!Array.isArray(hand) || !hand.length) return model;

    let totalCost = 0;
    let totalMoments = 0;
    for (const card of hand) {
        if (!card) continue;
        model.total += 1;
        const t = String(card.type || 'utility');
        if (typeof model[t] === 'number') model[t] += 1;
        if ((card.dmg || 0) >= 4) model.highDmg += 1;
        totalCost += (card.cost || 0);
        totalMoments += (card.moments || 1);
    }
    model.avgCost = model.total ? (totalCost / model.total) : 0;
    model.avgMoments = model.total ? (totalMoments / model.total) : 1;
    return model;
}

function aiEstimatePlayerProfile(useMemory = false) {
    const p = state.player;
    const mind = aiGetMind();

    const hpRatio = p.maxHp > 0 ? (p.hp / p.maxHp) : 1;
    const stamRatio = Math.min(1, (p.stam || 0) / Math.max(1, p.maxStam || 6));

    // Strict anti-cheat: use only observed history, never player's hidden hand contents.
    const seenTotal = Object.values(mind.revealed).reduce((a, b) => a + b, 0);
    const observed = {
        attack: (mind.revealed.attack || 0) / Math.max(1, seenTotal),
        grab: (mind.revealed.grab || 0) / Math.max(1, seenTotal),
        block: (mind.revealed.block || 0) / Math.max(1, seenTotal),
        parry: (mind.revealed.parry || 0) / Math.max(1, seenTotal),
        highDmgRate: Math.min(1, (mind.adapt.aggression || 0.5) * 0.8)
    };

    // Fallback priors before enough reveals.
    if (seenTotal < 3) {
        observed.attack = 0.34;
        observed.grab = 0.16;
        observed.block = 0.30;
        observed.parry = 0.20;
        observed.highDmgRate = 0.45;
    }

    const defenseDensity = observed.block + observed.parry;
    const aggroDensity = observed.attack + observed.grab;
    const handRatio = Math.min(1, 0.45 + (stamRatio * 0.35));

    let defendBias = 0.12 + (defenseDensity * 0.55);
    if ((p.statuses?.mustBlock || 0) > 0) defendBias += 0.35;
    if ((p.stam || 0) <= 1) defendBias += 0.18;
    if (hpRatio < 0.45) defendBias += 0.12;
    defendBias = Math.max(0.05, Math.min(0.95, defendBias));

    let attackBias = 0.14 + (aggroDensity * 0.55) + (stamRatio * 0.22) + (handRatio * 0.14);
    attackBias += observed.highDmgRate * 0.12;
    attackBias -= defendBias * 0.2;
    attackBias = Math.max(0.05, Math.min(0.98, attackBias));

    let counterParryBias = Math.max(0.02, Math.min(0.9, (observed.parry * 1.15) + defenseDensity * 0.2));
    let counterGrabBias = Math.max(0.02, Math.min(0.9, (observed.grab * 1.15) + aggroDensity * 0.15));

    if (useMemory) {
        counterParryBias = Math.max(0.02, Math.min(1, (counterParryBias * 0.7) + (mind.adapt.antiParry * 0.3)));
        counterGrabBias = Math.max(0.02, Math.min(1, (counterGrabBias * 0.7) + (mind.adapt.antiGrab * 0.3)));
        attackBias = Math.max(0.05, Math.min(0.99, (attackBias * 0.82) + (mind.adapt.aggression * 0.18)));
        defendBias = Math.max(0.05, Math.min(0.99, (defendBias * 0.82) + (mind.adapt.defense * 0.18)));
    }

    const threat = Math.max(0.05, Math.min(0.98, (stamRatio * 0.42) + (handRatio * 0.2) + (attackBias * 0.38)));
    const handModel = { total: seenTotal, highDmg: Math.round(observed.highDmgRate * 5) };

    return { defendBias, attackBias, threat, hpRatio, handRatio, stamRatio, handModel, counterParryBias, counterGrabBias };
}
function aiScoreMove(move, ctx) {
    if (!move) return -999;
    const cost = getMoveCost('ai', move);
    if (cost > ctx.virtualStam) return -999;
    if ((move.moments || 1) > ctx.slotsLeft) return -999;

    const p = ctx.playerModel;
    const aiHpRatio = state.ai.maxHp > 0 ? (state.ai.hp / state.ai.maxHp) : 1;
    const lowHp = aiHpRatio < 0.45;
    const finishing = (state.player.hp || 0) <= 10;
    const postMoveStam = ctx.virtualStam - cost;

    let score = (Math.random() * 0.55);

    if (move.type === 'attack') {
        score += 22 + ((move.dmg || 0) * 2.2) - ((move.moments || 1) - 1) * 2.4;
        score += (1 - p.defendBias) * 5.5;
        score -= p.counterParryBias * 7.5;
        if (finishing) score += 6;
    } else if (move.type === 'grab') {
        score += 17 + ((move.dmg || 0) * 1.9);
        score += p.defendBias * 15;
        score += p.counterParryBias * 12;
        score -= p.attackBias * 7;
    } else if (move.type === 'block') {
        score += 8 + p.threat * 17 + p.counterGrabBias * 8;
        if (lowHp) score += 6;
    } else if (move.type === 'parry') {
        score += 9 + p.attackBias * 13 + p.threat * 9;
        if (lowHp) score += 3;
    } else if (move.type === 'buff' || move.type === 'utility') {
        score += 8;
        if (ctx.slotIndex <= 2) score += 3;
        if (p.defendBias > 0.55) score += 2.5;
    }

    if ((move.effect || '').includes('heal') && lowHp) score += 10;
    if ((move.effect || '').includes('reduce_dmg') && lowHp) score += 8;
    if (move.effect === 'dont' && (state.player.statuses?.hypnotized || 0) > 0) score += 14;
    if ((move.effect === 'hypnotize' || move.effect === 'hypnotized') && (state.player.statuses?.hypnotized || 0) <= 0) score += 8;

    if (ctx.revealedPlayerCard) {
        const rp = ctx.revealedPlayerCard;
        if (rp.type === 'parry') {
            if (move.type === 'grab') score += 13;
            if (move.type === 'attack') score -= 9;
        } else if (rp.type === 'block') {
            if (move.type === 'grab') score += 11;
            if (move.type === 'buff' || move.type === 'utility') score += 2;
        } else if (rp.type === 'attack') {
            if (move.type === 'parry') score += 11;
            if (move.type === 'block') score += 6;
            if (move.type === 'grab') score -= 6;
        } else if (rp.type === 'grab') {
            if (move.type === 'attack') score += 8;
            if (move.type === 'block') score += 5;
        }
    }

    if (postMoveStam < 0) score -= 20;
    if (postMoveStam === 0 && ctx.slotsLeft >= 2) score -= 2.5;
    if (cost >= Math.max(1, Math.ceil(ctx.virtualStam * 0.75)) && move.type === 'utility') score -= 3;
    if (ctx.lastMove && move.type === ctx.lastMove.type) score -= 2.2;
    if (lowHp && move.type === 'attack' && (move.moments || 1) >= 3) score -= 3.2;
    if (ctx.slotIndex <= 1 && move.type === 'parry' && p.attackBias < 0.35) score -= 2.5;
    if (ctx.slotIndex >= 3 && move.type === 'buff') score -= 3;

    return score;
}

function aiPickMove(validMoves, ctx) {
    if (!validMoves || !validMoves.length) return null;
    const scored = validMoves
        .map(m => ({ move: m, score: aiScoreMove(m, ctx) }))
        .filter(x => x.score > -900)
        .sort((a, b) => b.score - a.score);

    if (!scored.length) return null;
    if (scored.length === 1) return scored[0].move;

    const top = scored.slice(0, Math.min(4, scored.length));
    const weights = top.map(x => Math.exp(x.score / 16));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < top.length; i++) {
        r -= weights[i];
        if (r <= 0) return top[i].move;
    }
    return top[0].move;
}

function aiPickMoveNormal(validMoves, ctx) {
    if (!validMoves || !validMoves.length) return null;

    const aiClass = state.ai.class;
    let chosenMove = null;

    if (state.ai.hp < state.ai.maxHp * 0.4) {
        const defensiveMoves = validMoves.filter(m => m.type === 'block' || m.type === 'parry' || (m.effect && (m.effect.includes('heal') || m.effect.includes('reduce_dmg'))));
        if (defensiveMoves.length > 0 && Math.random() < 0.75) chosenMove = defensiveMoves[Math.floor(Math.random() * defensiveMoves.length)];
    }

    if (!chosenMove && ctx.virtualStam >= 2 && (aiClass === 'Mauja' || aiClass === 'Paladin' || aiClass === 'Necromancer')) {
        const heavyMoves = validMoves.filter(m => getMoveCost('ai', m) >= 2);
        if (heavyMoves.length > 0 && Math.random() < 0.6) chosenMove = heavyMoves[Math.floor(Math.random() * heavyMoves.length)];
    }

    if (!chosenMove && (aiClass === 'Rogue' || aiClass === 'Vampiress')) {
        const fastMoves = validMoves.filter(m => m.moments === 1 && (m.type === 'attack' || m.type === 'grab'));
        if (fastMoves.length > 0 && Math.random() < 0.6) chosenMove = fastMoves[Math.floor(Math.random() * fastMoves.length)];
    }

    if (!chosenMove && Math.random() < 0.2) {
        const randomIdx = Math.floor(Math.random() * validMoves.length);
        chosenMove = validMoves[randomIdx];
    }

    return chosenMove || validMoves[Math.floor(Math.random() * validMoves.length)];
}

function aiPickMoveByDifficulty(validMoves, ctx) {
    const level = aiGetDifficulty();
    if (level === 'normal') return aiPickMoveNormal(validMoves, ctx);
    return aiPickMove(validMoves, ctx);
}
function aiShouldPivot(aiCard, pCard) {
    if (!aiCard || !pCard) return false;

    const level = aiGetDifficulty();
    if (level === 'normal') {
        let shouldPivot = false;
        if (aiCard.type === 'attack' && pCard.type === 'parry') shouldPivot = true;
        if (aiCard.type === 'grab' && pCard.type === 'attack') shouldPivot = true;
        if (aiCard.type === 'attack' && (aiCard.dmg || 0) >= 3 && pCard.type === 'block' && Math.random() < 0.6) shouldPivot = true;
        if (state.ai.hp < state.ai.maxHp * 0.4 && pCard.type === 'attack' && (pCard.dmg || 0) >= 3 && aiCard.type !== 'block' && aiCard.type !== 'parry' && Math.random() < 0.8) shouldPivot = true;
        return shouldPivot;
    }

    const playerModel = aiEstimatePlayerProfile(level === 'pro');
    let score = 0;

    if (aiCard.type === 'attack' && pCard.type === 'parry') score += 9;
    if (aiCard.type === 'grab' && pCard.type === 'attack') score += 8;
    if (aiCard.type === 'attack' && pCard.type === 'block' && (aiCard.dmg || 0) >= 4) score += 5;
    if (state.ai.hp < state.ai.maxHp * 0.45 && pCard.type === 'attack') score += 6;

    score += playerModel.threat * 5.5;
    score += playerModel.stamRatio * 2.5;
    score += (playerModel.handModel?.highDmg || 0) * 0.7;

    if (level === 'pro') {
        const mind = aiGetMind();
        score += (mind.adapt.defense * 2.2);
        score += (mind.adapt.antiParry * 1.6);
    }

    score += (Math.random() * 2.4);
    return score >= 9.8;
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
        if (ability1 && virtualStam >= getMoveCost('ai', ability1) && slotsLeft >= ability1.moments && !state.ai.timeline.some(c => c && c.name === ability1.name)) {
            validMoves.push(ability1);
        }
        
        // Let the AI consider Ability 2
        if (ability2 && virtualStam >= getMoveCost('ai', ability2) && slotsLeft >= ability2.moments && !state.ai.timeline.some(c => c && c.name === ability2.name)) {
            validMoves.push(ability2);
        }

        state.ai.hand.forEach(card => {
            if (card.type === 'enhancer') return;
            if (getMoveCost('ai', card) <= virtualStam && slotsLeft >= card.moments) validMoves.push(card);
        });

        const ctx = {
            slotIndex: i,
            slotsLeft,
            virtualStam,
            playerModel: aiEstimatePlayerProfile(aiGetDifficulty() === 'pro'),
            lastMove: (i > 0) ? getActiveCard('ai', i - 1) : null,
            revealedPlayerCard: null
        };
        let chosenMove = aiPickMoveByDifficulty(validMoves, ctx);
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

function cloneFlashCardPublic(card) {
    if (!card || card === 'occupied') return null;
    return {
        name: card.name || '',
        type: card.type || 'utility',
        dmg: card.dmg || 0,
        moments: card.moments || 1,
        effect: card.effect || ''
    };
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

        if (typeof step.requiredEnhancerOnSlot === 'number') {
            const d = getCardData('player', step.requiredEnhancerOnSlot);
            const hasEnh = !!(d && d.card && Array.isArray(d.card.enhancers) && d.card.enhancers.length > 0);
            if (!hasEnh) {
                alert('Coach: Attach the enhancer by dropping it on your action card first.');
                return;
            }
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
    state.originalPCard = cloneFlashCardPublic(pData.card);
    state.originalAICard = cloneFlashCardPublic(aiData.card);

    // AI commits now from flash info only (before seeing if player pivots).
    const preShouldPivot = (state.originalAICard && state.originalPCard)
        ? aiShouldPivot(state.originalAICard, state.originalPCard)
        : false;
    state.aiFlashDecision = { shouldPivot: !!preShouldPivot };
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
        if (Array.isArray(pData.card.enhancers) && pData.card.enhancers.length > 0) {
            pData.card.enhancers.forEach(enh => {
                state.player.stam = Math.min(state.player.maxStam, state.player.stam + (enh?.paidCost ?? enh?.cost ?? 0));
                if (enh) state.player.hand.push(enh);
            });
            pData.card.enhancers = [];
        }
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
    
    // AI can only use frozen flash info (same info a regular player has).

    const aiCard = state.originalAICard;
    const pCard = state.originalPCard;
    if (aiGetDifficulty() === 'pro') aiRememberReveal(pCard);
    
    // Live AI timeline is used only for executing AI's own pivot refund/clear.
    const aiData = getCardData('ai', state.flashMoment);
    const aiLiveCard = aiData?.card || null;
    let shouldPivot = !!(state.aiFlashDecision && state.aiFlashDecision.shouldPivot);

    // Use decision committed at flash time; never recompute from post-pivot player state.
    if (!state.aiFlashDecision && aiCard && pCard) {
        shouldPivot = aiShouldPivot(aiCard, pCard);
    }

    // --- EXECUTE THE AI PIVOT ---
    if (shouldPivot && state.ai.stam >= 1) {
        state.ai.stam -= 1; // Pay the Pivot Tax
        
        let pivotStartIndex = state.flashMoment;
        let momentsFreed = 1;
        
        if (aiLiveCard) {
            pivotStartIndex = aiData.startIndex;
            momentsFreed = aiLiveCard.moments;
            state.ai.stam = Math.min(state.ai.maxStam, state.ai.stam + (aiLiveCard.paidCost ?? getMoveCost('ai', aiLiveCard) ?? aiLiveCard.cost ?? 0)); 
            if (Array.isArray(aiLiveCard.enhancers) && aiLiveCard.enhancers.length > 0) {
                aiLiveCard.enhancers.forEach(enh => {
                    state.ai.stam = Math.min(state.ai.maxStam, state.ai.stam + (enh?.paidCost ?? enh?.cost ?? 0));
                    if (enh) state.ai.hand.push(enh);
                });
                aiLiveCard.enhancers = [];
            }
            if (!aiLiveCard.isBasic) state.ai.hand.push(aiLiveCard); 
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
                if (c.type === 'enhancer') return;
                if (getMoveCost('ai', c) <= virtualStam && c.moments <= slotsLeftToFill) validMoves.push(c);
            });

            const pivotCtx = {
                slotIndex: currentSlot,
                slotsLeft: slotsLeftToFill,
                virtualStam,
                playerModel: aiEstimatePlayerProfile(aiGetDifficulty() === 'pro'),
                lastMove: (currentSlot > pivotStartIndex) ? getActiveCard('ai', currentSlot - 1) : null,
                revealedPlayerCard: pCard || null
            };
            let chosenMove = aiPickMoveByDifficulty(validMoves, pivotCtx);
            if (!chosenMove) chosenMove = validMoves[Math.floor(Math.random() * validMoves.length)];

            virtualStam -= getMoveCost('ai', chosenMove);
            state.ai.stam -= getMoveCost('ai', chosenMove);
            
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

    state.aiFlashDecision = null;
    renderAITimeline(); updateUI();
    
    setTimeout(() => {
        state.currentMoment = 0; 
        resolveMoment(); 
    }, 1000); 
}






























