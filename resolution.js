function resolveMoment() {
    if (state.currentMoment > 4) { 
        if (state.player.class === 'Necromancer' && state.player.roundData.appliedStatus) { state.player.stam = Math.min(state.player.maxStam, state.player.stam + 1); log("Player Necromancer gained 1 Stam (Passive)."); }
        if (state.ai.class === 'Necromancer' && state.ai.roundData.appliedStatus) { state.ai.stam = Math.min(state.ai.maxStam, state.ai.stam + 1); log("AI Necromancer gained 1 Stam (Passive)."); }
        if (state.player.class === 'Brute' && state.player.roundData.lostLife) { state.player.stam = Math.min(state.player.maxStam, state.player.stam + 1); log("Player Brute gained 1 Stam (Passive)."); }
        if (state.ai.class === 'Brute' && state.ai.roundData.lostLife) { state.ai.stam = Math.min(state.ai.maxStam, state.ai.stam + 1); log("AI Brute gained 1 Stam (Passive)."); }
        setTimeout(() => nextTurn(), END_ROUND_DELAY); return; 
    }
    
    // 1. Clear all previous glows from both slots AND cards
    document.querySelectorAll('.slot, .card').forEach(el => {
        el.style.boxShadow = 'none';
        el.style.filter = 'none'; // Clear any brightness filters
    });
    document.querySelectorAll('.resolving').forEach(el => el.classList.remove('resolving'));

    // Track HP changes for consistent feedback (works with multi-moment cards)
    const pHpBefore = state.player.hp;
    const aiHpBefore = state.ai.hp;



    // 2. Identify the current slots
    const pSlot = document.querySelector(`#player-timeline .slot:nth-child(${state.currentMoment+1})`);
    const aiSlot = document.querySelector(`#ai-timeline .slot:nth-child(${state.currentMoment+1})`);
    
    // 3. Helper function to make the 'top-most' element glow
    const applyGlow = (slot) => {
        if (!slot) return;
        
        // Check if there is a card inside this slot
        const card = slot.querySelector('.card');
        const target = card || slot; // Glow the card if it exists, otherwise the slot
        
        target.style.boxShadow = '0 0 20px 8px rgba(255, 255, 255, 0.7)';
        
        // If it's a card, let's also make it slightly brighter so it "pops"
        if (card) {
            card.style.filter = 'brightness(1.2)';
            card.style.zIndex = '10'; // Ensure it sits above neighboring cards
        }
    };

    applyGlow(pSlot);
    applyGlow(aiSlot);
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
        {
        const costToPay = (!aiAction.paidUpfront) ? getMoveCost('ai', aiAction) : 0;
        if (!aiAction.paidUpfront) aiAction.paidCost = costToPay;
        state.ai.stam = Math.max(0, state.ai.stam - costToPay);
    } 
        if(aiAction.type === 'attack') { 
            let roguePenalty = state.ai.statuses.rogueDebuff || 0;
            aiDmg = aiAction.dmg + state.ai.statuses.nextAtkMod - roguePenalty; 
            state.ai.statuses.nextAtkMod = 0; state.ai.statuses.rogueDebuff = 0; 
        }
        if(aiAction.type === 'parry') aiParry = true;
        if(aiAction.type === 'grab') { aiGrab = true; aiDmg = (aiAction.dmg || 0) + state.ai.statuses.nextGrabMod; state.ai.statuses.nextGrabMod = 0; }
    }

    if (aiActive && aiActive.type === 'block') aiBlock = true;

    let pGrabHit = false; 
let aiGrabHit = false;

// NEW: track interruption so we can cancel the grabbed action's effect
let pActionInterrupted = false;
let aiActionInterrupted = false;

if (pGrab) {
  const aiIsBuffLike = aiAction && (aiAction.type === 'buff' || aiAction.type === 'utility');

  if (aiBlock || aiParry) {
    pGrabHit = true;
    log(`Player ${pAction.name} GRABS!`);
  }
  // NEW: grab also works on buffs/utilities (and interrupts them)
  else if (aiIsBuffLike) {
    pGrabHit = true;
    aiActionInterrupted = true;
    log(`Player ${pAction.name} GRABS and INTERRUPTS ${aiAction.name}!`);
  }
  else if (aiAction && aiAction.type === 'attack') {
    pDmg = 0;
    log("Player Grab interrupted!");
  }
  else {
    pDmg = 0;
    log("Player Grab misses.");
  }
    }

    if (aiGrab) {
      const pIsBuffLike = pAction && (pAction.type === 'buff' || pAction.type === 'utility');

      if (pBlock || pParry) {
        aiGrabHit = true;
        log(`AI ${aiAction.name} GRABS!`);
      }
      // NEW: grab also works on buffs/utilities (and interrupts them)
      else if (pIsBuffLike) {
        aiGrabHit = true;
        pActionInterrupted = true;
        log(`AI ${aiAction.name} GRABS and INTERRUPTS ${pAction.name}!`);
      }
      else if (pAction && pAction.type === 'attack') {
        aiDmg = 0;
        log("AI Grab interrupted!");
      }
      else {
        aiDmg = 0;
        log("AI Grab misses.");
      }
    }

    if(pParry && aiDmg > 0 && !aiGrab) { aiDmg = 0; log(`Player PARRIES!`); spawnFloatingText('player', 'PARRY', 'float-block'); playSound('block'); state.ai.statuses.drawLess = 1; if (state.player.class === 'Ice Djinn') applyFreezeCounters('player', 'ai', 2); }
    if(aiParry && pDmg > 0 && !pGrab) { pDmg = 0; log(`AI PARRIES!`); spawnFloatingText('ai', 'PARRY', 'float-block'); playSound('block'); state.player.statuses.drawLess = 1; if (state.ai.class === 'Ice Djinn') applyFreezeCounters('ai', 'player', 2); }

    // --- FIXED ARMOR LOGIC: Now safely catches ALL active blocks properly ---
    if(pBlock && aiDmg > 0 && !aiGrab) { 
        if (pActive.name === 'Bone Cage') {
            if(pActive.currentBlock === undefined) pActive.currentBlock = 6;
            let blocked = Math.min(aiDmg, pActive.currentBlock);
            aiDmg -= blocked; pActive.currentBlock -= blocked;
            log(`Player's Bone Cage absorbs ${blocked} DMG!`); spawnFloatingText('player', 'CAGE', 'float-block'); playSound('block');
        } else if (pActive.name === 'Ice Wall') {
            if(pActive.currentBlock === undefined) pActive.currentBlock = 8;
            let blocked = Math.min(aiDmg, pActive.currentBlock);
            aiDmg -= blocked; pActive.currentBlock -= blocked;
            log(`Player's Ice Wall absorbs ${blocked} DMG!`); spawnFloatingText('player', 'ICE WALL', 'float-block'); playSound('block');
            if (blocked > 0) applyFreezeCounters('player', 'ai', 1);
        } else { 
            let effectiveArmor = getEffectiveArmor('player');
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
        } else if (aiActive.name === 'Ice Wall') {
            if(aiActive.currentBlock === undefined) aiActive.currentBlock = 8;
            let blocked = Math.min(pDmg, aiActive.currentBlock);
            pDmg -= blocked; aiActive.currentBlock -= blocked;
            log(`AI's Ice Wall absorbs ${blocked} DMG!`); spawnFloatingText('ai', 'ICE WALL', 'float-block'); playSound('block');
            if (blocked > 0) applyFreezeCounters('ai', 'player', 1);
        } else {
            let effectiveArmor = getEffectiveArmor('ai');
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
        if(pActive && pActive.moments >= 3) { playSound('heavy_impact'); } else playSound('hit');
        
        // Passives - FIXED ROGUE LOGIC
        if(state.player.class === 'Vampiress') { state.player.statuses.nextAtkMod += 1; log("Player Vampiress Passive: +1 DMG next attack!"); }
        if(state.player.class === 'Rogue') { state.ai.statuses.rogueDebuff = (state.ai.statuses.rogueDebuff || 0) + 1; log("Player Rogue Passive: AI next attack -1 DMG!"); }
    }
    
    if(aiDmg > 0) { 
        state.player.hp -= aiDmg; state.player.roundData.lostLife = true;
        log(`AI hits for ${aiDmg}!`); spawnFloatingText('player', `-${aiDmg}`, 'float-dmg'); 
        if(aiActive && aiActive.moments >= 3) { playSound('heavy_impact'); } else playSound('hit');

        // Passives - FIXED ROGUE LOGIC
        if(state.ai.class === 'Vampiress') { state.ai.statuses.nextAtkMod += 1; log("AI Vampiress Passive: +1 DMG next attack!"); }
        if(state.ai.class === 'Rogue') { state.player.statuses.rogueDebuff = (state.player.statuses.rogueDebuff || 0) + 1; log("AI Rogue Passive: Player next attack -1 DMG!"); }
    }


    // 3.5 Feedback (Balatro-snappy): shake based on ACTUAL HP loss this moment
    const pHpLoss = Math.max(0, pHpBefore - state.player.hp);
    const aiHpLoss = Math.max(0, aiHpBefore - state.ai.hp);
    const momentImpact = Math.max(pHpLoss, aiHpLoss);

    if (momentImpact >= 5) {
        triggerShake(2);
        punchPortrait(pHpLoss > 0 ? 'player' : 'ai', 2);
    } else if (momentImpact >= 3) {
        triggerShake(1);
        punchPortrait(pHpLoss > 0 ? 'player' : 'ai', 1);
    } else if (momentImpact >= 1) {
        // small hits: portrait punch only (no screen shake)
        punchPortrait(pHpLoss > 0 ? 'player' : 'ai', 1);
    }
    // 4. Trigger Effects
    if (pAction && pAction.effect && !pActionInterrupted) {
    applyEffect('player', 'ai', pAction.effect, { hitLanded: pDmg > 0, grabHit: pGrabHit, targetBlocked: aiBlock, targetParried: aiParry, dmgOut: pDmg });
    }
    if (aiAction && aiAction.effect && !aiActionInterrupted) {
      applyEffect('ai', 'player', aiAction.effect, { hitLanded: aiDmg > 0, grabHit: aiGrabHit, targetBlocked: pBlock, targetParried: pParry, dmgOut: aiDmg });
    }
    updateUI();
    if(state.player.hp <= 0 || state.ai.hp <= 0) {
        setTimeout(() => alert(state.player.hp <= 0 ? "You Lose!" : "You Win!"), 500);
        return;
    }

    state.currentMoment++;
    setTimeout(resolveMoment, (typeof momentImpact !== 'undefined' && momentImpact >= 5) ? HEAVY_IMPACT_DELAY : (typeof momentImpact !== 'undefined' && momentImpact >= 1) ? LIGHT_IMPACT_DELAY : RESOLVE_DELAY);
}

function applyEffect(sourceKey, targetKey, effectString, context = {}) {
    const source = state[sourceKey];
    const target = state[targetKey];

    // Prefer the registry (new scalable path). Fallback to the legacy switch.
    if (typeof window.tryRunRegisteredEffect === 'function') {
        const handled = window.tryRunRegisteredEffect(effectString, {
            state,
            sourceKey,
            targetKey,
            context,
            api: {
                log: (msg) => log(msg),
                float: (who, text, cssClass) => spawnFloatingText(who, text, cssClass),
                sound: (name) => playSound(name),
            }
        });
        if (handled) return;
    }
    
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
        case 'heal_2': 
            source.hp = Math.min(source.maxHp, source.hp + 2); log(`${sourceKey} heals 2!`); 
            spawnFloatingText(sourceKey, '+2', 'float-heal'); playSound('heal'); break;
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
                let effectiveArmor = Math.max(0, (target.armor || 0) + (target.statuses.bonusArmor || 0) - (target.statuses.armorDebuff || 0));
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
            if(context.hitLanded) { target.statuses.stamPenalty += 1; log(`${targetKey} is CHILLED! Stamina recovery heavily reduced.`); source.roundData.appliedStatus = true; }
            break;
        case 'freeze_1_on_hit':
            if(context.hitLanded) { applyFreezeCounters(sourceKey, targetKey, 1); }
            break;
        case 'cold_wind':
            applyFreezeCounters(sourceKey, targetKey, 1);
            drawCards(1, sourceKey);
            break;
        case 'break_the_ice':
            if(context.grabHit) {
                const stacks = target.statuses.freeze || 0;
                if (stacks > 0) {
                    target.statuses.freeze = 0;
                    target.hp -= stacks;
                    target.roundData.lostLife = true;
                    spawnFloatingText(targetKey, `-${stacks}`, 'float-dmg');
                    log(`Break the Ice detonates ${stacks} FREEZE for ${stacks} extra DMG!`);
                    playSound('heavy_impact');
                }
            }
            break;
        case 'spirit_form':
            source.statuses.armorNextTurn = (source.statuses.armorNextTurn || 0) + 2;
            log(`${sourceKey} will gain +2 Armor next turn.`);
            break;
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

        // Clear last turn's temporary armor and apply queued armor gains
        state.player.statuses.bonusArmor = 0;
        state.ai.statuses.bonusArmor = 0;
        if ((state.player.statuses.armorNextTurn || 0) > 0) {
            state.player.statuses.bonusArmor += state.player.statuses.armorNextTurn;
            log(`Player gains +${state.player.statuses.armorNextTurn} Armor this turn.`);
            state.player.statuses.armorNextTurn = 0;
        }
        if ((state.ai.statuses.armorNextTurn || 0) > 0) {
            state.ai.statuses.bonusArmor += state.ai.statuses.armorNextTurn;
            log(`AI gains +${state.ai.statuses.armorNextTurn} Armor this turn.`);
            state.ai.statuses.armorNextTurn = 0;
        }
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
    if (!window.EngineRuntime) return;
    window.EngineRuntime.dispatch({
        type: window.EngineRuntime.ActionTypes.TOGGLE_EXERT_CARD,
        payload: { handIndex: index }
    });
}

function confirmExert() {
    if (!window.EngineRuntime) return;
    if (state.phase !== 'exert') return;

    // Tutorial: confirm exert is the expected action for some steps.
    if (typeof isTutorialMode !== 'undefined' && isTutorialMode) {
        const step = (typeof tutorialSteps !== 'undefined' && tutorialSteps[currentStep]) ? tutorialSteps[currentStep] : null;
        if (!step || step.expect !== 'confirmExert') return;
        advanceTutorial();
    }

    window.EngineRuntime.dispatch({
        type: window.EngineRuntime.ActionTypes.CONFIRM_EXERT,
        payload: {}
    });
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