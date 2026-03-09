function getEnhancerDamageBonus(action) {
    if (!action || !Array.isArray(action.enhancers) || action.enhancers.length === 0) return 0;
    return action.enhancers.reduce((sum, enh) => sum + (enh?.enhance?.dmg || 0), 0);
}

function runEnhancerOnHitEffects(action, sourceKey, targetKey, context) {
    if (!action || !Array.isArray(action.enhancers) || !action.enhancers.length) return;
    for (const enh of action.enhancers) {
        const fxList = enh?.enhance?.effects;
        if (Array.isArray(fxList)) {
            for (const fx of fxList) {
                const trigger = String(fx?.trigger || '').toLowerCase();
                if (trigger !== 'on_hit') continue;
                const type = String(fx?.type || '').toLowerCase();
                const value = Math.max(1, Number(fx?.value) || 1);
                if (typeof window.tryRunEffectType === 'function') {
                    const handled = window.tryRunEffectType(type, {
                        sourceKey,
                        targetKey,
                        value,
                        context: context || {},
                        card: enh
                    });
                    if (handled) continue;
                }
                if (typeof applyEffect === 'function') applyEffect(sourceKey, targetKey, type, context || {});
            }
            continue;
        }
        const legacyKey = String(enh?.enhance?.effect || enh?.effect || '').trim();
        if (legacyKey && typeof applyEffect === 'function') applyEffect(sourceKey, targetKey, legacyKey, context || {});
    }
}

function removeTimelineAction(side, actionCard) {
    if (!actionCard) return false;
    const tl = state?.[side]?.timeline;
    if (!tl) return false;
    const endIndex = tl.indexOf(actionCard);
    if (endIndex < 0) return false;
    const startIndex = endIndex - ((actionCard.moments || 1) - 1);
    for (let i = 0; i < (actionCard.moments || 1); i++) {
        const idx = startIndex + i;
        if (idx >= 0 && idx < tl.length) tl[idx] = null;
    }
    return true;
}

function consumeHypnotized(targetKey, sourceKey, reason = 'consumed') {
    const target = state?.[targetKey];
    if (!target || (target.statuses?.hypnotized || 0) <= 0) return false;
    target.statuses.hypnotized = 0;
    log(`${targetKey === 'player' ? 'Player' : 'AI'} loses HYPNOTIZED (${reason}).`);
    spawnFloatingText(targetKey, 'HYPNOTIZED LOST', 'float-block');

    const source = state?.[sourceKey];
    if (source && state[sourceKey]?.class === 'Palea') {
        source.stam = Math.min(source.maxStam, source.stam + 1);
        log(`${sourceKey === 'player' ? 'Player' : 'AI'} Palea gains 1 Stamina.`);
    }
    return true;
}

function actionHasEffectType(action, effectType) {
    if (!action || action.type === 'occupied') return false;
    const key = String(effectType || '').toLowerCase();
    if (!key) return false;
    if (String(action.effect || '').toLowerCase() === key) return true; // legacy
    if (!Array.isArray(action.effects)) return false;
    return action.effects.some((fx) => String(fx?.type || '').toLowerCase() === key);
}
function tryResolveDont(sourceKey, targetKey, sourceAction) {
    if (!sourceAction || sourceAction.type === 'occupied') return false;
    if (!actionHasEffectType(sourceAction, 'dont')) return false;
    const target = state?.[targetKey];
    if (!target || (target.statuses?.hypnotized || 0) <= 0) return false;
    const targetAction = (typeof getActiveCard === 'function')
        ? getActiveCard(targetKey, state.currentMoment)
        : state?.[targetKey]?.timeline?.[state.currentMoment];
    if (!targetAction || targetAction === 'occupied') return false;

    consumeHypnotized(targetKey, sourceKey, "Don't");
    removeTimelineAction(targetKey, targetAction);
    log(`${sourceKey === 'player' ? 'Player' : 'AI'} uses Don't and negates ${targetKey === 'player' ? 'Player' : 'AI'} action.`);
    spawnFloatingText(targetKey, 'NEGATED', 'float-block');
    return true;
}
function tryResolveBlink(sourceKey, targetKey, sourceAction, targetAction) {
    if (!sourceAction || sourceAction.type === 'occupied') return false;
    if (!actionHasEffectType(sourceAction, 'blink')) return false;
    if (!targetAction || targetAction.type !== 'attack') return false;

    removeTimelineAction(targetKey, targetAction);
    const target = state?.[targetKey];
    const source = state?.[sourceKey];
    if (!target || !source) return false;

    target.hp -= 3;
    target.roundData.lostLife = true;
    if (typeof clearHypnotizedOnLifeLoss === 'function') clearHypnotizedOnLifeLoss(targetKey, 'life loss');
    spawnFloatingText(targetKey, '-3', 'float-dmg');
    spawnFloatingText(targetKey, 'BLINKED', 'float-block');
    log(`${sourceKey === 'player' ? 'Player' : 'AI'} BLINK negates the attack and deals 3 DMG.`);
    if (typeof drawCards === 'function') drawCards(1, sourceKey);
    playSound('hit');
    return true;
}
function resolveMoment() {
    if (state.currentMoment > 4) {
        // Persistent status ticks
        if (typeof window.tickPoisonAtTurnEnd === 'function') {
            window.tickPoisonAtTurnEnd('player');
            window.tickPoisonAtTurnEnd('ai');
        }
        if (state.player.class === 'Necromancer' && state.player.roundData.appliedStatus) { state.player.stam = Math.min(state.player.maxStam, state.player.stam + 1); log("Player Necromancer gained 1 Stam (Passive)."); }
        if (state.ai.class === 'Necromancer' && state.ai.roundData.appliedStatus) { state.ai.stam = Math.min(state.ai.maxStam, state.ai.stam + 1); log("AI Necromancer gained 1 Stam (Passive)."); }
        if (state.player.class === 'Mauja' && state.player.roundData.lostLife) { state.player.stam = Math.min(state.player.maxStam, state.player.stam + 1); log("Player Mauja gained 1 Stam (Passive)."); }
        if (state.ai.class === 'Mauja' && state.ai.roundData.lostLife) { state.ai.stam = Math.min(state.ai.maxStam, state.ai.stam + 1); log("AI Mauja gained 1 Stam (Passive)."); }
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

    const pNegated = tryResolveDont('player', 'ai', pAction);
    const aiNegated = tryResolveDont('ai', 'player', aiAction);
    if (pNegated || aiNegated) {
        pAction = state.player.timeline[state.currentMoment];
        aiAction = state.ai.timeline[state.currentMoment];
        pActive = getActiveCard('player', state.currentMoment);
        aiActive = getActiveCard('ai', state.currentMoment);
    }

    if(pAction && pAction !== 'occupied') { document.getElementById(`p-card-mom-${state.currentMoment+1}`)?.classList.add('resolving'); }
    if(aiAction && aiAction !== 'occupied') { document.getElementById(`ai-card-mom-${state.currentMoment+1}`)?.classList.add('resolving'); }

    let pDmg = 0; let aiDmg = 0;
    let pBlock = false; let aiBlock = false; let pParry = false; let aiParry = false; let pGrab = false; let aiGrab = false;
    let pActionInterrupted = false;
    let aiActionInterrupted = false;

    if(state.player.statuses.forceBlock && pAction && pAction !== 'occupied') { log("Player is Intimidated! Action fails."); pAction = null; }
    if(state.ai.statuses.forceBlock && aiAction && aiAction !== 'occupied') { log("AI is Intimidated! Action fails."); aiAction = null; }

    const pBlink = tryResolveBlink('player', 'ai', pAction, aiAction);
    const aiBlink = tryResolveBlink('ai', 'player', aiAction, pAction);
    if (pBlink || aiBlink) {
        if (pBlink) { aiActionInterrupted = true; aiAction = null; }
        if (aiBlink) { pActionInterrupted = true; pAction = null; }
    }
    if(pAction && pAction !== 'occupied') {
        if(pAction.type === 'attack') {
            let roguePenalty = state.player.statuses.rogueDebuff || 0;
            pDmg = pAction.dmg + state.player.statuses.nextAtkMod + getEnhancerDamageBonus(pAction) - roguePenalty;
            if (state.player.class === 'Ice Assassin' && (state.ai.statuses?.freeze || 0) >= 5) pDmg += 1;
            if (pAction.id === 'darkness_night_blade' && (state.ai.hand?.length || 0) === 0) pDmg += 3;
            state.player.statuses.nextAtkMod = 0; state.player.statuses.rogueDebuff = 0;
        }
        if(pAction.type === 'parry') pParry = true;
        if(pAction.type === 'grab') { pGrab = true; pDmg = (pAction.dmg || 0) + state.player.statuses.nextGrabMod + getEnhancerDamageBonus(pAction); state.player.statuses.nextGrabMod = 0; }
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
            aiDmg = aiAction.dmg + state.ai.statuses.nextAtkMod + getEnhancerDamageBonus(aiAction) - roguePenalty;
            if (state.ai.class === 'Ice Assassin' && (state.player.statuses?.freeze || 0) >= 5) aiDmg += 1;
            if (aiAction.id === 'darkness_night_blade' && (state.player.hand?.length || 0) === 0) aiDmg += 3;
            state.ai.statuses.nextAtkMod = 0; state.ai.statuses.rogueDebuff = 0;
        }
        if(aiAction.type === 'parry') aiParry = true;
        if(aiAction.type === 'grab') { aiGrab = true; aiDmg = (aiAction.dmg || 0) + state.ai.statuses.nextGrabMod + getEnhancerDamageBonus(aiAction); state.ai.statuses.nextGrabMod = 0; }
    }

    if (aiActive && aiActive.type === 'block') aiBlock = true;

    let pGrabHit = false;
let aiGrabHit = false;

if (pGrab) {
  const aiIsBuffLike = aiAction && (aiAction.type === 'buff');

  if (aiBlock || aiParry) {
    pGrabHit = true;
    log(`Player ${pAction.name} GRABS!`);
  }
  // Grab interrupts Concentration (buff) only; utilities are not interrupted by grab.
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
      const pIsBuffLike = pAction && (pAction.type === 'buff');

      if (pBlock || pParry) {
        aiGrabHit = true;
        log(`AI ${aiAction.name} GRABS!`);
      }
      // Grab interrupts Concentration (buff) only; utilities are not interrupted by grab.
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
        if (typeof clearHypnotizedOnLifeLoss === 'function') clearHypnotizedOnLifeLoss('ai', 'life loss');
        log(`Player hits for ${pDmg}!`); spawnFloatingText('ai', `-${pDmg}`, 'float-dmg');
        if(pActive && pActive.moments >= 3) { playSound('heavy_impact'); } else playSound('hit');

        // BLEED detonation: on being hit by an ATTACK
        if (pAction && pAction.type === 'attack') {
            detonateBleedOnAttackHit('player', 'ai');

            if ((state.ai.statuses?.poisonSkinActive || 0) > 0) {
                applyPoisonCounters('ai', 'player', 2);
            }
            if (state.ai.class === 'Ice Brute') {
                applyFreezeCounters('ai', 'player', 1);
            }
            if (state.ai.class === 'Fae Brute') {
                applyHypnotizedStatus('ai', 'player');
            }
        }

        // Passives - FIXED ROGUE LOGIC
        if(state.player.class === 'Vampiress') { state.player.statuses.nextAtkMod += 1; log("Player Vampiress Passive: +1 DMG next attack!"); }
        if(state.player.class === 'Rogue') { state.ai.statuses.rogueDebuff = (state.ai.statuses.rogueDebuff || 0) + 1; log("Player Rogue Passive: AI next attack -1 DMG!"); }
    }

    if(aiDmg > 0) {
        state.player.hp -= aiDmg; state.player.roundData.lostLife = true;
        if (typeof clearHypnotizedOnLifeLoss === 'function') clearHypnotizedOnLifeLoss('player', 'life loss');
        log(`AI hits for ${aiDmg}!`); spawnFloatingText('player', `-${aiDmg}`, 'float-dmg');
        if(aiActive && aiActive.moments >= 3) { playSound('heavy_impact'); } else playSound('hit');

        // BLEED detonation: on being hit by an ATTACK
        if (aiAction && aiAction.type === 'attack') {
            detonateBleedOnAttackHit('ai', 'player');

            if ((state.player.statuses?.poisonSkinActive || 0) > 0) {
                applyPoisonCounters('player', 'ai', 2);
            }
            if (state.player.class === 'Ice Brute') {
                applyFreezeCounters('player', 'ai', 1);
            }
            if (state.player.class === 'Fae Brute') {
                applyHypnotizedStatus('player', 'ai');
            }
        }

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

// 4. Trigger Effects (decoupled, data-driven)
const pAttemptedAttack = !!(pAction && pAction !== 'occupied' && pAction.type === 'attack' && (pAction.dmg || 0) > 0 && !pGrab);
const aiAttemptedAttack = !!(aiAction && aiAction !== 'occupied' && aiAction.type === 'attack' && (aiAction.dmg || 0) > 0 && !aiGrab);

const pHit = (pAction && pAction !== 'occupied' && pAction.type === 'attack' && pDmg > 0);
const aiHit = (aiAction && aiAction !== 'occupied' && aiAction.type === 'attack' && aiDmg > 0);

const pContact = pHit || pGrabHit;
const aiContact = aiHit || aiGrabHit;

const pResolved = !!(pAction && pAction !== 'occupied' && !pActionInterrupted && !(pAction.type === 'attack' && aiParry));
const aiResolved = !!(aiAction && aiAction !== 'occupied' && !aiActionInterrupted && !(aiAction.type === 'attack' && pParry));

// Source card triggers (on_hit / on_blocked / on_parried)
if (pAction && pAction !== 'occupied' && !pActionInterrupted) {
    if (pContact) {
        const pHitCtx = { hitLanded: pHit, grabHit: pGrabHit };
        runTriggeredCardEffects(pAction, 'on_hit', { sourceKey: 'player', targetKey: 'ai', context: pHitCtx });
        runEnhancerOnHitEffects(pAction, 'player', 'ai', pHitCtx);
    }
    if (aiBlock && pAttemptedAttack) runTriggeredCardEffects(pAction, 'on_blocked', { sourceKey: 'player', targetKey: 'ai', context: { targetBlocked: true } });
    if (aiParry && pAttemptedAttack) runTriggeredCardEffects(pAction, 'on_parried', { sourceKey: 'player', targetKey: 'ai', context: { targetParried: true } });
}
if (aiAction && aiAction !== 'occupied' && !aiActionInterrupted) {
    if (aiContact) {
        const aiHitCtx = { hitLanded: aiHit, grabHit: aiGrabHit };
        runTriggeredCardEffects(aiAction, 'on_hit', { sourceKey: 'ai', targetKey: 'player', context: aiHitCtx });
        runEnhancerOnHitEffects(aiAction, 'ai', 'player', aiHitCtx);
    }
    if (pBlock && aiAttemptedAttack) runTriggeredCardEffects(aiAction, 'on_blocked', { sourceKey: 'ai', targetKey: 'player', context: { targetBlocked: true } });
    if (pParry && aiAttemptedAttack) runTriggeredCardEffects(aiAction, 'on_parried', { sourceKey: 'ai', targetKey: 'player', context: { targetParried: true } });
}

if (pResolved) {
    runTriggeredCardEffects(pAction, 'on_resolve', {
        sourceKey: 'player',
        targetKey: 'ai',
        context: { resolved: true, hitLanded: pHit, grabHit: pGrabHit, targetBlocked: aiBlock, targetParried: aiParry }
    });
}
if (aiResolved) {
    runTriggeredCardEffects(aiAction, 'on_resolve', {
        sourceKey: 'ai',
        targetKey: 'player',
        context: { resolved: true, hitLanded: aiHit, grabHit: aiGrabHit, targetBlocked: pBlock, targetParried: pParry }
    });
}

// Defender triggers (on_block / on_parry) - attributed to the ACTIVE defense card
if (pBlock && aiAttemptedAttack && pActive && pActive.type === 'block') {
    runTriggeredCardEffects(pActive, 'on_block', { sourceKey: 'player', targetKey: 'ai', context: { blocked: true } });
}
if (aiBlock && pAttemptedAttack && aiActive && aiActive.type === 'block') {
    runTriggeredCardEffects(aiActive, 'on_block', { sourceKey: 'ai', targetKey: 'player', context: { blocked: true } });
}
if (pParry && aiAttemptedAttack && pAction && pAction.type === 'parry') {
    runTriggeredCardEffects(pAction, 'on_parry', { sourceKey: 'player', targetKey: 'ai', context: { parried: true } });
}
if (aiParry && pAttemptedAttack && aiAction && aiAction.type === 'parry') {
    runTriggeredCardEffects(aiAction, 'on_parry', { sourceKey: 'ai', targetKey: 'player', context: { parried: true } });
}

// Legacy string effects (backward compatible)
if (pAction && pAction.effect && !pActionInterrupted) {
    applyEffect('player', 'ai', pAction.effect, { hitLanded: pHit, grabHit: pGrabHit, targetBlocked: aiBlock, targetParried: aiParry, dmgOut: pDmg });
}
if (aiAction && aiAction.effect && !aiActionInterrupted) {
    applyEffect('ai', 'player', aiAction.effect, { hitLanded: aiHit, grabHit: aiGrabHit, targetBlocked: pBlock, targetParried: pParry, dmgOut: aiDmg });
}
updateUI();
    if(state.player.hp <= 0 || state.ai.hp <= 0) {
        setTimeout(() => alert(state.player.hp <= 0 ? "You Lose!" : "You Win!"), 500);
        return;
    }

    state.currentMoment++;
    setTimeout(resolveMoment, (typeof momentImpact !== 'undefined' && momentImpact >= 5) ? HEAVY_IMPACT_DELAY : (typeof momentImpact !== 'undefined' && momentImpact >= 1) ? LIGHT_IMPACT_DELAY : RESOLVE_DELAY);
}


function detonateBleedOnAttackHit(attackerKey, targetKey) {
    const target = state?.[targetKey];
    if (!target) return;
    const stacks = target.statuses?.bleed || 0;
    if (stacks <= 0) return;

    target.statuses.bleed = 0;
    target.hp -= stacks;
    target.roundData.lostLife = true;
    if (typeof clearHypnotizedOnLifeLoss === 'function') clearHypnotizedOnLifeLoss(targetKey, 'life loss');

    spawnFloatingText(targetKey, `-${stacks}`, 'float-dmg');
    log(`${targetKey === 'player' ? 'Player' : 'AI'} BLEEDS for ${stacks}!`);
    playSound('hit');
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
                if (typeof clearHypnotizedOnLifeLoss === 'function') clearHypnotizedOnLifeLoss(targetKey, 'life loss');
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
        case 'poison_skin':
            source.statuses.poisonSkinNextTurn = 1;
            log(`${sourceKey} prepares Poison Skin for next turn.`);
            break;
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
        case 'hypnotize':
        case 'hypnotized':
            if (typeof applyHypnotizedStatus === 'function') applyHypnotizedStatus(sourceKey, targetKey);
            break;
        case 'dont':
            // Resolved at moment start by tryResolveDont(). Keep as no-op fallback.
            break;
        case 'blink':
            // Resolved at moment start by tryResolveBlink(). Keep as no-op fallback.
            break;
        case 'snap_fingers':
            if (consumeHypnotized(targetKey, sourceKey, 'Snap Fingers')) {
                source.statuses.nextAtkMod += 2;
                log(`${sourceKey} snaps fingers: next attack +2 DMG.`);
            }
            break;
        case 'puppet_strings':
            if (consumeHypnotized(targetKey, sourceKey, 'Puppet Strings')) {
                target.statuses.drawLess = Math.max(target.statuses.drawLess || 0, 1);
                source.stam = Math.min(source.maxStam, source.stam + 1);
                log(`${sourceKey} pulls the strings: ${targetKey} draws 1 less next turn.`);
            }
            break;
        case 'fae_needle':
            if ((context.hitLanded || context.grabHit) && consumeHypnotized(targetKey, sourceKey, 'Fae Needle')) {
                target.hp -= 2;
                target.roundData.lostLife = true;
                if (typeof clearHypnotizedOnLifeLoss === 'function') clearHypnotizedOnLifeLoss(targetKey, 'life loss');
                spawnFloatingText(targetKey, '-2', 'float-dmg');
                log(`${sourceKey}'s Fae Needle bursts for 2 bonus DMG!`);
            }
            break;
        case 'chiller':
            if(context.hitLanded) { target.statuses.stamPenalty += 1; log(`${targetKey} is CHILLED! Stamina recovery heavily reduced.`); source.roundData.appliedStatus = true; }
            break;
        case 'freeze_1_on_hit':
            if(context.hitLanded) { applyFreezeCounters(sourceKey, targetKey, 1); }
            break;
        case 'freeze_2_on_hit':
            if(context.hitLanded || context.grabHit) { applyFreezeCounters(sourceKey, targetKey, 2); }
            break;
        case 'cold_wind':
            applyFreezeCounters(sourceKey, targetKey, 1);
            drawCards(1, sourceKey);
            break;
        case 'frost_hug':
            if (context.grabHit && (target.statuses.freeze || 0) >= 10) {
                target.hp -= 5;
                target.roundData.lostLife = true;
                if (typeof clearHypnotizedOnLifeLoss === 'function') clearHypnotizedOnLifeLoss(targetKey, 'life loss');
                spawnFloatingText(targetKey, '-5', 'float-dmg');
                log(`${sourceKey}'s Frost Hug gains +5 DMG!`);
            }
            break;
        case 'break_the_ice':
            if(context.grabHit) {
                const stacks = target.statuses.freeze || 0;
                if (stacks > 0) {
                    target.statuses.freeze = 0;
                    target.hp -= stacks;
                    target.roundData.lostLife = true;
                    if (typeof clearHypnotizedOnLifeLoss === 'function') clearHypnotizedOnLifeLoss(targetKey, 'life loss');
                    spawnFloatingText(targetKey, `-${stacks}`, 'float-dmg');
                    log(`Break the Ice detonates ${stacks} FREEZE for ${stacks} extra DMG!`);
                    playSound('heavy_impact');
                }
            }
            break;
        case 'forge_ice_dagger': {
            const daggerBase = window.CardsDB?.ice_assassin_ice_dagger;
            if (!daggerBase) break;
            if ((source.hand || []).length >= 7) {
                if (sourceKey === 'player') log('Hand full! Ice Dagger was not created.');
                break;
            }
            const dagger = { ...daggerBase, uniqueId: 'uid_' + Math.random(), _deckId: source._deckId || 'generated' };
            source.hand.push(dagger);
            log(`${sourceKey} forges an Ice Dagger.`);
            if (sourceKey === 'player') playSound('draw');
            break;
        }
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
        const pExhaust = (state.player.statuses.exhausted || 0) > 0 ? 1 : 0;
        const aiExhaust = (state.ai.statuses.exhausted || 0) > 0 ? 1 : 0;
        let pStamRec = Math.max(0, 3 - state.player.statuses.stamPenalty - pExhaust);
        let aiStamRec = Math.max(0, 3 - state.ai.statuses.stamPenalty - aiExhaust);
        state.player.stam = Math.min(state.player.maxStam, state.player.stam + pStamRec);
        state.ai.stam = Math.min(state.ai.maxStam, state.ai.stam + aiStamRec);

        // EXHAUSTED clears after affecting turn-start stamina regen
        state.player.statuses.exhausted = 0;
        state.ai.statuses.exhausted = 0;


        // Reset statuses
        state.player.statuses.dmgReduction = 0; state.player.statuses.forceBlock = false; state.player.statuses.drawOnBlock = false; state.player.statuses.stamOnBlock = false; state.player.statuses.armorDebuff = 0; state.player.statuses.stamPenalty = 0; state.player.statuses.rogueDebuff = 0; state.player.statuses.exhausted = 0;
        state.ai.statuses.dmgReduction = 0; state.ai.statuses.forceBlock = false; state.ai.statuses.drawOnBlock = false; state.ai.statuses.stamOnBlock = false; state.ai.statuses.armorDebuff = 0; state.ai.statuses.stamPenalty = 0; state.ai.statuses.rogueDebuff = 0; state.ai.statuses.exhausted = 0;

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
            log('AI gains +' + state.ai.statuses.armorNextTurn + ' Armor this turn.');
            state.ai.statuses.armorNextTurn = 0;
        }

        state.player.statuses.poisonSkinActive = (state.player.statuses.poisonSkinNextTurn || 0) > 0 ? 1 : 0;
        state.ai.statuses.poisonSkinActive = (state.ai.statuses.poisonSkinNextTurn || 0) > 0 ? 1 : 0;
        state.player.statuses.poisonSkinNextTurn = 0;
        state.ai.statuses.poisonSkinNextTurn = 0;
    }

    if (typeof window.aiLearnFromRound === 'function') window.aiLearnFromRound();

    state.player.roundData = { lostLife: false, appliedStatus: false };
    state.ai.roundData = { lostLife: false, appliedStatus: false };
    state.player.timeline = [null, null, null, null, null];
    state.ai.timeline = [null, null, null, null, null];
    document.querySelectorAll('.player-placed').forEach(e => e.remove());

    // Toggle UI for Exert Phase
    document.getElementById('action-controls').style.display = 'none';
    const exertUI = document.getElementById('exert-controls');
    if (exertUI) exertUI.style.display = 'flex';
    document.getElementById('btn-confirm-exert').innerText = "Confirm Exert (0 ST)";

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

function normalizeTriggerName(t) {
    if (!t) return '';
    const s = String(t).trim().toLowerCase();
    if (s === 'upon hit' || s === 'on hit' || s === 'hit' || s === 'on_hit') return 'on_hit';
    if (s === 'upon attack hit' || s === 'on_attack_hit') return 'on_attack_hit';
    if (s === 'upon block' || s === 'on block' || s === 'block' || s === 'on_block') return 'on_block';
    if (s === 'upon parry' || s === 'on parry' || s === 'parry' || s === 'on_parry') return 'on_parry';
    if (s === 'turn end' || s === 'on turn end' || s === 'on_turn_end') return 'on_turn_end';
    if (s === 'on resolve' || s === 'resolve' || s === 'on_resolve') return 'on_resolve';
    if (s === 'on get blocked' || s === 'on_blocked' || s === 'upon being blocked') return 'on_blocked';
    if (s === 'on get parried' || s === 'on_parried' || s === 'upon being parried') return 'on_parried';
    return s.replace(/\s+/g, '_');
}

function normalizeEffectEntry(entry) {
    // Supported shapes:
    // 1) { trigger, type, value }
    // 2) { trigger, effect: ['bleed', 1] }  or { trigger, effect: { type, value } }
    // 3) ['upon hit', ['bleed', 1]]  or ['on_hit', 'bleed', 1]
    if (!entry) return null;

    if (Array.isArray(entry)) {
        const [tr, a, b] = entry;
        const trigger = normalizeTriggerName(tr);
        if (Array.isArray(a)) {
            const [type, value] = a;
            return { trigger, type: String(type).toLowerCase(), target: 'opponent', value: Number(value) || 0 };
        }
        if (typeof a === 'string') {
            return { trigger, type: a.toLowerCase(), target: 'opponent', value: Number(b) || 0 };
        }
        return null;
    }

    if (typeof entry === 'object') {
        const trigger = normalizeTriggerName(entry.trigger);
        if (entry.type) return { trigger, type: String(entry.type).toLowerCase(), target: String(entry.target || 'opponent').toLowerCase(), value: Number(entry.value) || 0 };
        if (entry.effect) {
            if (Array.isArray(entry.effect)) {
                const [type, value] = entry.effect;
                return { trigger, type: String(type).toLowerCase(), target: 'opponent', value: Number(value) || 0 };
            }
            if (typeof entry.effect === 'object' && entry.effect.type) {
                return { trigger, type: String(entry.effect.type).toLowerCase(), target: String(entry.effect.target || 'opponent').toLowerCase(), value: Number(entry.effect.value) || 0 };
            }
        }
    }

    return null;
}

function runTriggeredCardEffects(card, triggerName, args) {
    if (!card || !card.effects || !Array.isArray(card.effects)) return;

    const trigger = normalizeTriggerName(triggerName);
    for (const raw of card.effects) {
        const e = normalizeEffectEntry(raw);
        if (!e) continue;
        if (e.trigger !== trigger) continue;
        if ((e.value || 0) <= 0) continue;

        // Effect-type registry (preferred)
        const effectTargetKey = ((String(e.target || 'opponent').toLowerCase() === 'self' || String(e.target || 'opponent').toLowerCase() === 'source') ? args.sourceKey : args.targetKey);
        if (typeof window.tryRunEffectType === 'function') {
            const handled = window.tryRunEffectType(e.type, {
                sourceKey: args.sourceKey,
                targetKey: effectTargetKey,
                value: e.value,
                context: args.context || {},
                card
            });
            if (handled) continue;
        }

        // Fallback: allow legacy applyEffect keys as type names
        if (typeof applyEffect === 'function') {
            applyEffect(args.sourceKey, effectTargetKey, e.type, args.context || {});
        }
    }
}






