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
            byMoment: Array.from({ length: 5 }, () => ({
                samples: 0,
                attack: 0, grab: 0, block: 0, parry: 0, buff: 0, utility: 0, enhancer: 0
            })),
            signatureCounts: {},
            lastSignature: '',
            repeatPressure: 0,
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

function aiMoveEffectText(move) {
    if (!move) return '';
    let text = String(move.effect || '');
    if (Array.isArray(move.effects)) {
        text += ' ' + move.effects.map((e) => String(e?.type || '')).join(' ');
    }
    return text.toLowerCase();
}

function aiMoveHasEffectType(move, typeKey) {
    const k = String(typeKey || '').toLowerCase();
    if (!k || !move) return false;
    if (String(move.effect || '').toLowerCase() === k) return true;
    if (!Array.isArray(move.effects)) return false;
    return move.effects.some((e) => String(e?.type || '').toLowerCase() === k);
}

function aiObserveResolvedRound() {
    const mind = aiGetMind();
    const momentTypes = [];
    for (let i = 0; i < 5; i++) {
        const card = getActiveCard('player', i);
        const type = card ? String(card.type || 'utility').toLowerCase() : 'empty';
        momentTypes.push(type);
        if (type === 'empty') continue;

        if (!mind.byMoment[i]) continue;
        mind.byMoment[i].samples += 1;
        if (typeof mind.byMoment[i][type] !== 'number') mind.byMoment[i][type] = 0;
        mind.byMoment[i][type] += 1;

        // Public information after resolution; no hidden-hand cheating.
        aiRememberReveal(card);
    }

    const sig = momentTypes.join('|');
    mind.signatureCounts[sig] = (mind.signatureCounts[sig] || 0) + 1;
    if (mind.lastSignature && mind.lastSignature === sig) {
        mind.repeatPressure = Math.min(6, (mind.repeatPressure || 0) + 1);
    } else {
        mind.repeatPressure = Math.max(0, (mind.repeatPressure || 0) - 1);
    }
    mind.lastSignature = sig;
}

function aiGetSlotIntel(slotIndex) {
    const m = aiGetMind().byMoment?.[slotIndex];
    if (!m) return {
        samples: 0,
        attackRate: 0, grabRate: 0, blockRate: 0, parryRate: 0, buffRate: 0, utilityRate: 0,
        blockParryRate: 0, predictable: false
    };
    const s = Math.max(0, Number(m.samples || 0));
    if (s <= 0) return {
        samples: 0,
        attackRate: 0, grabRate: 0, blockRate: 0, parryRate: 0, buffRate: 0, utilityRate: 0,
        blockParryRate: 0, predictable: false
    };

    const attackRate = (m.attack || 0) / s;
    const grabRate = (m.grab || 0) / s;
    const blockRate = (m.block || 0) / s;
    const parryRate = (m.parry || 0) / s;
    const buffRate = (m.buff || 0) / s;
    const utilityRate = (m.utility || 0) / s;
    const blockParryRate = ((m.block || 0) + (m.parry || 0)) / s;
    const rates = [attackRate, grabRate, blockParryRate];
    const topRate = Math.max(...rates);
    const predictable = s >= 3 && topRate >= 0.55;
    return { samples: s, attackRate, grabRate, blockRate, parryRate, buffRate, utilityRate, blockParryRate, predictable };
}

function aiCounterPayoffVs(playerType, aiType) {
    const p = String(playerType || '').toLowerCase();
    const a = String(aiType || '').toLowerCase();
    const tbl = {
        attack: { attack: 1.5, grab: -6.5, block: 2, parry: -7, buff: 0.5, utility: 0.5 },
        grab: { attack: 10, grab: -1.5, block: -10, parry: -8, buff: 1.5, utility: 1.5 },
        block: { attack: 5, grab: 8, block: 0.3, parry: 0.2, buff: -1, utility: -1 },
        parry: { attack: 9, grab: -7, block: 0.2, parry: 0, buff: -1, utility: -1 },
        buff: { attack: 2.5, grab: 3, block: 2, parry: 2, buff: -0.5, utility: -0.2 },
        utility: { attack: 2.5, grab: 3, block: 2, parry: 2, buff: -0.2, utility: -0.2 }
    };
    return Number(tbl[p]?.[a] ?? 0);
}

function aiExpectedCounterValue(aiType, intel) {
    const i = intel || {};
    const pAttack = Number(i.attackRate || 0);
    const pGrab = Number(i.grabRate || 0);
    const pBlock = Number(i.blockRate || 0);
    const pParry = Number(i.parryRate || 0);
    const pBuff = Number(i.buffRate || 0);
    const pUtil = Number(i.utilityRate || 0);
    return (
        pAttack * aiCounterPayoffVs('attack', aiType) +
        pGrab * aiCounterPayoffVs('grab', aiType) +
        pBlock * aiCounterPayoffVs('block', aiType) +
        pParry * aiCounterPayoffVs('parry', aiType) +
        pBuff * aiCounterPayoffVs('buff', aiType) +
        pUtil * aiCounterPayoffVs('utility', aiType)
    );
}
function aiGetLateTypeThreat(slotIndex, typeKey) {
    const start = Math.max(3, Number(slotIndex || 0));
    const k = String(typeKey || '').toLowerCase();
    let maxRate = 0;
    let maxSamples = 0;
    for (let i = start; i <= 4; i++) {
        const intel = aiGetSlotIntel(i);
        const s = Number(intel.samples || 0);
        const r = Number(intel[k + 'Rate'] || 0);
        if (s >= 2 && r > maxRate) {
            maxRate = r;
            maxSamples = s;
        }
    }
    return { rate: maxRate, samples: maxSamples };
}

function aiGetLateGrabThreat(slotIndex) {
    return aiGetLateTypeThreat(slotIndex, 'grab');
}

function aiGetLateAttackThreat(slotIndex) {
    return aiGetLateTypeThreat(slotIndex, 'attack');
}
function aiHasLateGrabThreat(fromSlot) {
    const start = Math.max(3, Number(fromSlot || 0) + 1);
    for (let i = start; i <= 4; i++) {
        const intel = aiGetSlotIntel(i);
        if ((intel.samples || 0) >= 2 && (intel.grabRate || 0) >= 0.35) return true;
    }
    return false;
}

function aiHasLateAttackThreat(fromSlot) {
    const start = Math.max(3, Number(fromSlot || 0) + 1);
    for (let i = start; i <= 4; i++) {
        const intel = aiGetSlotIntel(i);
        if ((intel.samples || 0) >= 2 && (intel.attackRate || 0) >= 0.45) return true;
    }
    return false;
}

function aiLearnFromRound() {
    const level = aiGetDifficulty();
    if (level === 'normal') return;

    aiObserveResolvedRound();
    if (level !== 'pro') return;
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

function aiTextForMove(move) {
    return `${String(move?.desc || '')} ${String(move?.specialNotes || '')}`.toLowerCase();
}

function aiGetStatusApplicationAmount(move, statusKey) {
    if (!move) return 0;
    const key = String(statusKey || '').toLowerCase();
    let amount = 0;
    if (Array.isArray(move.effects)) {
        for (const fx of move.effects) {
            const type = String(fx?.type || '').toLowerCase();
            if (type === key) amount += Math.max(1, Number(fx?.value) || 1);
            const m = type.match(new RegExp(`^${key}_(\\d+)_on_`));
            if (m) amount += Math.max(1, Number(m[1]) || 1);
        }
    }
    return amount;
}

function aiMoveConsumesStatus(move, statusKey) {
    if (!move) return false;
    const key = String(statusKey || '').toLowerCase();
    const text = aiTextForMove(move);
    if (key === 'freeze' && /remove all freeze|consume freeze/.test(text)) return true;
    if (key === 'bleed' && /consume bleed/.test(text)) return true;
    if (key === 'hypnotized' && /consume hypnotized/.test(text)) return true;
    if (!Array.isArray(move.effects)) return false;
    return move.effects.some((fx) => {
        const type = String(fx?.type || '').toLowerCase();
        if (type === `consume_${key}` || type === `consume_${key}_burst`) return true;
        if (key === 'freeze' && type === 'break_the_ice') return true;
        if (key === 'bleed' && type === 'consume_bleed_damage') return true;
        return false;
    });
}

function aiGetOpponentStatusThresholds(move, statusKey) {
    if (!move) return [];
    const key = String(statusKey || '').toUpperCase();
    const text = `${String(move?.desc || '')} ${String(move?.specialNotes || '')}`;
    const patterns = [
        new RegExp(`opponent[^.]{0,80}?(\\d+)\\+\\s*${key}`, 'ig'),
        new RegExp(`opponent[^.]{0,80}?${key}[^\\d]{0,16}(\\d+)\\+`, 'ig'),
        new RegExp(`${key}[^\\d]{0,16}(\\d+)\\+`, 'ig')
    ];
    const out = [];
    for (const re of patterns) {
        let match;
        while ((match = re.exec(text))) {
            const n = Number(match[1] || 0);
            if (n > 0) out.push(n);
        }
    }
    return [...new Set(out)].sort((a, b) => a - b);
}

function aiGetFutureStatusThresholdDemand(statusKey, ctx) {
    const futureMoves = []
        .concat(Array.isArray(ctx?.aiHand) ? ctx.aiHand : [])
        .concat(ctx?.aiAbility1 ? [ctx.aiAbility1] : [])
        .concat(ctx?.aiAbility2 ? [ctx.aiAbility2] : []);
    const thresholds = [];
    for (const move of futureMoves) thresholds.push(...aiGetOpponentStatusThresholds(move, statusKey));
    if (!thresholds.length) return { count: 0, min: 0, nearMin: 0 };
    thresholds.sort((a, b) => a - b);
    return { count: thresholds.length, min: thresholds[0], nearMin: thresholds[0] };
}

function aiScoreFreezePlan(move, ctx) {
    if (!move) return 0;
    const opponentFreeze = Number(state.player?.statuses?.freeze || 0);
    const aiClass = String(state.ai?.class || '').toLowerCase();
    const addsFreeze = aiGetStatusApplicationAmount(move, 'freeze');
    const consumesFreeze = aiMoveConsumesStatus(move, 'freeze');
    const freezeThresholds = aiGetOpponentStatusThresholds(move, 'freeze');
    const freezeDemand = aiGetFutureStatusThresholdDemand('freeze', ctx);
    let score = 0;

    if (addsFreeze > 0) {
        score += 1.6 * addsFreeze;
        if (freezeDemand.count > 0 && opponentFreeze < freezeDemand.min) {
            const gap = Math.max(0, freezeDemand.min - opponentFreeze);
            score += Math.min(10, (addsFreeze * 1.8) + Math.max(0, 5 - gap) * 1.2);
        }
        if (aiClass === 'ice assassin' && opponentFreeze < 5) {
            const gapToPassive = Math.max(0, 5 - opponentFreeze);
            score += Math.max(0, 7 - gapToPassive) * 0.9;
        }
    }

    if (freezeThresholds.length) {
        const best = freezeThresholds[0];
        if (opponentFreeze >= best) score += 8 + Math.min(6, opponentFreeze - best);
        else score -= Math.min(8, (best - opponentFreeze) * 1.5);
    }

    if (consumesFreeze) {
        if (aiClass === 'ice assassin' && opponentFreeze >= 5 && opponentFreeze < 8) score -= 8;
        if (freezeDemand.count > 0 && opponentFreeze < freezeDemand.min) {
            score -= Math.min(12, (freezeDemand.min - opponentFreeze) * 1.8 + freezeDemand.count * 1.2);
        } else if (opponentFreeze >= 4) {
            score += Math.min(10, opponentFreeze * 0.8);
        }
    }

    if (aiClass === 'ice assassin' && move.type === 'attack' && opponentFreeze >= 5) {
        score += 3.5;
    }

    return score;
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

    let score = (ctx?.noRandom ? 0 : (Math.random() * 0.55));

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
    } else if (move.type === 'wait') {
        score -= 7;
    } else if (move.type === 'buff' || move.type === 'utility') {
        score += 8;
        if (ctx.slotIndex <= 2) score += 3;
        if (p.defendBias > 0.55) score += 2.5;
    }

    const effectText = aiMoveEffectText(move);
    if (effectText.includes('heal') && lowHp) score += 10;
    if (effectText.includes('reduce_dmg') && lowHp) score += 8;
    if (aiMoveHasEffectType(move, 'dont') && (state.player.statuses?.hypnotized || 0) > 0) score += 14;
    if ((aiMoveHasEffectType(move, 'hypnotize') || aiMoveHasEffectType(move, 'hypnotized')) && (state.player.statuses?.hypnotized || 0) <= 0) score += 8;
    score += aiScoreFreezePlan(move, ctx);

        // Slot-based pattern punish from previously resolved rounds (public info only).
    const slotIntel = aiGetSlotIntel(ctx.slotIndex);
    const lateThreatForScore = aiGetLateGrabThreat(ctx.slotIndex);
    const projectedLateGrabRate = Math.max(Number(slotIntel.grabRate || 0), Number(lateThreatForScore.rate || 0));
    const lateAttackThreatForScore = aiGetLateAttackThreat(ctx.slotIndex);
    const projectedLateAttackRate = Math.max(Number(slotIntel.attackRate || 0), Number(lateAttackThreatForScore.rate || 0));
    const advancedDifficulty = (ctx.difficulty === 'hard' || ctx.difficulty === 'pro');
    if (advancedDifficulty && slotIntel.samples >= 2) {
        // Statistical best-response term (expected value vs observed slot distribution).
        score += aiExpectedCounterValue(move.type, slotIntel) * 2.8;

        if (ctx.slotIndex >= 3 && projectedLateGrabRate >= 0.40) {
            if (move.type === 'attack') score += 8 + (projectedLateGrabRate * 8);
            if (move.type === 'block' || move.type === 'parry') score -= 14;
            if (move.type === 'buff' || move.type === 'utility') score -= 5;
        }
        if (ctx.slotIndex === 4 && projectedLateGrabRate >= 0.35) {
            if (move.type === 'attack') score += 12;
            if (move.type === 'grab') score -= 5;
            if (move.type === 'block' || move.type === 'parry') score -= 18;
            if (move.type === 'buff' || move.type === 'utility') score -= 8;
        }
    }
    if (slotIntel.samples >= 2) {
        if (projectedLateAttackRate >= 0.5) {
            if (move.type === 'parry') score += 11 + projectedLateAttackRate * 12;
            if (move.type === 'attack') score += 4 + projectedLateAttackRate * 7;
            if (move.type === 'block') score -= (lowHp ? 2 : 8);
            if (move.type === 'grab') score -= 14;
        }
        if (projectedLateGrabRate >= 0.35) {
            if (move.type === 'attack') score += 18 + projectedLateGrabRate * 16;
            if (move.type === 'grab') score -= 8;
            if (move.type === 'block') score -= 16;
            if (move.type === 'parry') score -= 14;
        }
        if (slotIntel.blockParryRate >= 0.55) {
            if (move.type === 'grab') score += 6 + slotIntel.blockParryRate * 8;
            if (move.type === 'buff' || move.type === 'utility') score += 1.5;
        }
    }
    if ((ctx.difficulty === 'hard' || ctx.difficulty === 'pro') && slotIntel.predictable) {
        const rep = aiGetMind().repeatPressure || 0;
        if (rep >= 2) {
            if (projectedLateAttackRate >= 0.5 && move.type === 'parry') score += 6 + rep * 1.5;
            if (projectedLateGrabRate >= 0.35 && move.type === 'attack') score += 9 + rep * 2;
        }
    }

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

    if (advancedDifficulty && (ctx.futureGrabTailThreat || ctx.futureAttackTailThreat) && ctx.slotIndex <= 3) {
        if (move.type !== 'attack' && move.type !== 'parry' && postMoveStam <= 0) score -= 10;
        if ((move.type === 'buff' || move.type === 'utility') && cost > 0) score -= 6;
        if (move.type === 'attack' && cost <= 1 && (move.moments || 1) === 1) score += 3;
        if (move.type === 'wait' && ctx.slotIndex <= 2) score += 8;
        if (move.type === 'wait' && ctx.slotIndex >= 3) score -= 8;
    }

    if (postMoveStam < 0) score -= 20;
    if (postMoveStam === 0 && ctx.slotsLeft >= 2) score -= 2.5;
    if (cost >= Math.max(1, Math.ceil(ctx.virtualStam * 0.75)) && move.type === 'utility') score -= 3;
    if (ctx.lastMove && move.type === ctx.lastMove.type) score -= 2.2;
    if (lowHp && move.type === 'attack' && (move.moments || 1) >= 3) score -= 3.2;
    if (ctx.slotIndex <= 1 && move.type === 'parry' && p.attackBias < 0.35) score -= 2.5;
    if (ctx.slotIndex >= 3 && move.type === 'buff') score -= 3;
    if ((ctx.difficulty === 'hard' || ctx.difficulty === 'pro') && (ctx.defensiveSoFar || 0) >= 2) {
        if (move.type === 'block' || move.type === 'parry') score -= (lowHp ? 3 : 7);
        if (move.type === 'attack' || move.type === 'grab') score += 2.5;
    }
    if ((ctx.difficulty === 'hard' || ctx.difficulty === 'pro')
        && (ctx.proactiveSoFar || 0) === 0
        && ctx.slotIndex >= 2
        && (ctx.virtualStam || 0) >= 1) {
        if (move.type === 'block' || move.type === 'parry') score -= (lowHp ? 3 : 9);
        if (move.type === 'attack' || move.type === 'grab' || move.type === 'buff' || move.type === 'utility') score += 4;
    }

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

    const proactiveMoves = validMoves.filter(
        (m) => m && (m.type === 'attack' || m.type === 'grab' || m.type === 'buff' || m.type === 'utility')
    );

    if ((ctx?.defensiveSoFar || 0) >= 2 && proactiveMoves.length) {
        const bestProactive = proactiveMoves
            .map((m) => ({ move: m, score: aiScoreMove(m, { ...ctx, noRandom: true }) }))
            .sort((a, b) => b.score - a.score)[0];
        if (bestProactive) return bestProactive.move;
    }

    if ((ctx?.slotIndex || 0) >= 2 && (ctx?.proactiveSoFar || 0) === 0 && proactiveMoves.length) {
        const bestStarter = proactiveMoves
            .map((m) => ({ move: m, score: aiScoreMove(m, { ...ctx, noRandom: true }) }))
            .sort((a, b) => b.score - a.score)[0];
        if (bestStarter) return bestStarter.move;
    }

    const scored = validMoves
        .map((m) => {
            let score = aiScoreMove(m, { ...ctx, noRandom: true });
            if (m.type === 'block' || m.type === 'parry') score -= 3.5;
            if ((ctx?.defensiveSoFar || 0) >= 1 && (m.type === 'block' || m.type === 'parry')) score -= 2.5;
            if ((ctx?.slotIndex || 0) >= 3 && (m.type === 'block' || m.type === 'parry')) score -= 2.5;
            if (m.type === 'attack' || m.type === 'grab') score += 1.8;
            return { move: m, score };
        })
        .sort((a, b) => b.score - a.score);

    if (!scored.length) return null;
    if (scored.length === 1) return scored[0].move;

    const top = scored.slice(0, Math.min(3, scored.length));
    const weights = top.map((x) => Math.exp(x.score / 12));
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < top.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return top[i].move;
    }
    return top[0].move;
}
function aiPickCounterMove(validMoves, ctx) {
    const level = String(ctx?.difficulty || aiGetDifficulty() || 'hard').toLowerCase();
    if (level === 'normal') return null;
    if (!Array.isArray(validMoves) || !validMoves.length) return null;

    const intel = aiGetSlotIntel(ctx.slotIndex);
    const revealedType = String(ctx?.revealedPlayerCard?.type || '').toLowerCase();
    if ((intel.samples || 0) < 2 && !revealedType) return null;

    const rep = aiGetMind().repeatPressure || 0;
    const lateSlot = Number(ctx?.slotIndex || 0) >= 3;
    const lateGrabThreat = aiGetLateGrabThreat(ctx?.slotIndex || 0);
    const lateAttackThreat = aiGetLateAttackThreat(ctx?.slotIndex || 0);
    const projectedGrabRate = Math.max(Number(intel.grabRate || 0), Number(lateGrabThreat.rate || 0));
    const projectedAttackRate = Math.max(Number(intel.attackRate || 0), Number(lateAttackThreat.rate || 0));
    const grabHeavy = projectedGrabRate >= (rep >= 1 ? 0.30 : 0.40);
    const attackHeavy = projectedAttackRate >= (rep >= 1 ? 0.38 : 0.50);

    const scored = validMoves
        .filter(m => !!m)
        .map((m) => {
            let ev = revealedType
                ? aiCounterPayoffVs(revealedType, m.type) * 1.35
                : aiExpectedCounterValue(m.type, intel);

            if (lateSlot && grabHeavy) {
                if (m.type === 'attack') ev += 4 + projectedGrabRate * 4;
                if (m.type === 'block' || m.type === 'parry') ev -= 6;
                if (m.type === 'utility') ev -= 2.5;
                if (m.type === 'buff') ev -= 12;
            }
            if (lateSlot && attackHeavy) {
                if (m.type === 'parry') ev += 7 + projectedAttackRate * 5;
                if (m.type === 'attack') ev += 2 + projectedAttackRate * 2;
                if (m.type === 'grab') ev -= 10;
                if (m.type === 'buff') ev -= 8;
                if (m.type === 'utility') ev -= 4;
            }

            if (m.type === 'attack' || m.type === 'grab') ev += Number(m.dmg || 0) * 0.08;
            ev -= Number(getMoveCost('ai', m) || 0) * 0.04;

            return { move: m, ev };
        })
        .sort((a, b) => b.ev - a.ev);

    if (!scored.length) return null;

    if (lateSlot && attackHeavy) {
        const forcedParry = scored.find(x => x?.move?.type === 'parry');
        if (forcedParry) return forcedParry.move;
        const forcedAtkVsAtk = scored.find(x => x?.move?.type === 'attack');
        if (forcedAtkVsAtk) return forcedAtkVsAtk.move;
    }
    if (lateSlot && grabHeavy) {
        const forcedAtk = scored.find(x => x?.move?.type === 'attack');
        if (forcedAtk) return forcedAtk.move;
    }

    const best = scored[0];
    const second = scored[1] || { ev: -999 };
    const margin = best.ev - second.ev;

    const confident = revealedType
        ? best.ev >= 0.3
        : ((intel.samples || 0) >= 3 && (best.ev >= 1.2 || margin >= 0.75 || rep >= 2));

    if (!confident) return null;
    return best.move || null;
}
function aiMaybeForceProactiveMove(validMoves, ctx, chosenMove) {
    const level = String(ctx?.difficulty || aiGetDifficulty() || 'hard').toLowerCase();
    if (level !== 'hard' && level !== 'pro') return chosenMove;
    if (!chosenMove || ctx.slotIndex < 1) return chosenMove;
    if (chosenMove.type !== 'block' && chosenMove.type !== 'parry') return chosenMove;

    const proactiveChoices = (validMoves || []).filter(m => m && (m.type === 'attack' || m.type === 'grab' || m.type === 'buff' || m.type === 'utility'));
    if (!proactiveChoices.length) return chosenMove;

    const forceBecauseNoPressureYet = (ctx.slotIndex >= 1 && (ctx.proactiveSoFar || 0) === 0 && (ctx.virtualStam || 0) >= 1);
    const forceBecauseTooDefensive = (ctx.defensiveSoFar || 0) >= 2;
    const forceBecausePattern = !!(ctx.slotIntel && ctx.slotIntel.predictable);

    if (forceBecauseNoPressureYet || forceBecauseTooDefensive || forceBecausePattern) {
        return proactiveChoices.sort((a, b) => (Number(b.dmg || 0) - Number(a.dmg || 0)) || (Number(a.cost || 0) - Number(b.cost || 0)))[0];
    }
    return chosenMove;
}

function aiPruneDominatedMoves(validMoves, ctx) {
    if (!Array.isArray(validMoves) || !validMoves.length) return validMoves;
    const level = String(ctx?.difficulty || aiGetDifficulty() || 'hard').toLowerCase();
    if (level !== 'hard' && level !== 'pro') return validMoves;
    if (validMoves.length <= 1) return validMoves;

    const hasType = (t) => validMoves.some(m => m && m.type === t);
    const intel = ctx?.slotIntel || aiGetSlotIntel(ctx?.slotIndex ?? 0);
    const rep = aiGetMind().repeatPressure || 0;
    const strictAttack = rep >= 1 ? 0.45 : 0.58;
    const strictGrab = rep >= 1 ? 0.35 : 0.45;
    const lateGrabThreat = aiGetLateGrabThreat(ctx?.slotIndex ?? 0);
    const lateAttackThreat = aiGetLateAttackThreat(ctx?.slotIndex ?? 0);
    const projectedGrabRate = Math.max(Number(intel.grabRate || 0), Number(lateGrabThreat.rate || 0));
    const projectedAttackRate = Math.max(Number(intel.attackRate || 0), Number(lateAttackThreat.rate || 0));
    const revealed = ctx?.revealedPlayerCard || null;

    const isDominated = (m) => {
        if (!m) return false;

        if (revealed) {
            if (revealed.type === 'attack') {
                if (m.type === 'grab') return true;
                if (m.type === 'block' && hasType('parry')) return true;
            }
            if (revealed.type === 'grab') {
                if (m.type === 'block') return true;
                if (m.type === 'parry' && hasType('attack')) return true;
            }
        }

        if (projectedAttackRate >= strictAttack) {
            if (m.type === 'grab') return true;
            if (m.type === 'block' && (hasType('parry') || hasType('attack'))) return true;
            if ((ctx?.slotIndex ?? 0) >= 3 && hasType('parry') && (m.type === 'buff' || m.type === 'utility')) return true;
        }
        if (projectedGrabRate >= strictGrab) {
            if (m.type === 'block') return true;
            if (m.type === 'grab' && hasType('attack')) return true;
            if (m.type === 'parry' && hasType('attack')) return true;
            if ((ctx?.slotIndex ?? 0) >= 3 && hasType('attack') && (m.type === 'buff' || m.type === 'utility')) return true;
        }
        return false;
    };

    const filtered = validMoves.filter(m => !isDominated(m));
    return filtered.length ? filtered : validMoves;
}
function aiApplyLateGrabAntiTurtle(validMoves, ctx) {
    if (!Array.isArray(validMoves) || !validMoves.length) return validMoves;
    const level = String(ctx?.difficulty || aiGetDifficulty() || 'hard').toLowerCase();
    if (level !== 'hard' && level !== 'pro') return validMoves;

    const slotIndex = Number(ctx?.slotIndex || 0);
    if (slotIndex < 3) return validMoves;

    const intel = ctx?.slotIntel || aiGetSlotIntel(slotIndex);
    const revealedType = String(ctx?.revealedPlayerCard?.type || '').toLowerCase();
    const rep = aiGetMind().repeatPressure || 0;
    const lateGrabThreat = aiGetLateGrabThreat(slotIndex);
    const lateAttackThreat = aiGetLateAttackThreat(slotIndex);
    const projectedGrabRate = Math.max(Number(intel.grabRate || 0), Number(lateGrabThreat.rate || 0));
    const projectedAttackRate = Math.max(Number(intel.attackRate || 0), Number(lateAttackThreat.rate || 0));
    const grabHeavy = revealedType === 'grab' || (projectedGrabRate >= (rep >= 1 ? 0.30 : 0.40));
    const attackHeavy = revealedType === 'attack' || (projectedAttackRate >= (rep >= 1 ? 0.38 : 0.50));

    if (attackHeavy && projectedAttackRate >= projectedGrabRate) {
        const parries = validMoves.filter(m => m && m.type === 'parry');
        if (parries.length) return parries;
        const attacks = validMoves.filter(m => m && m.type === 'attack');
        if (attacks.length) return attacks;
        const blocks = validMoves.filter(m => m && m.type === 'block');
        if (blocks.length) return blocks;
        const nonGrab = validMoves.filter(m => m && m.type !== 'grab');
        if (nonGrab.length) return nonGrab;
        return validMoves;
    }

    if (!grabHeavy) return validMoves;

    const attacks = validMoves.filter(m => m && m.type === 'attack');
    if (attacks.length) return attacks;

    const grabs = validMoves.filter(m => m && m.type === 'grab');
    if (grabs.length) return grabs;

    const utilities = validMoves.filter(m => m && m.type === 'utility');
    if (utilities.length) return utilities;

    const nonBuff = validMoves.filter(m => m && m.type !== 'buff');
    if (nonBuff.length) return nonBuff;

    return validMoves;
}
function aiPickMoveByDifficulty(validMoves, ctx) {
    const level = aiGetDifficulty();
    if (level === 'normal') return aiPickMoveNormal(validMoves, ctx);
    const forcedCounter = aiPickCounterMove(validMoves, ctx);
    if (forcedCounter) return forcedCounter;
    let pick = aiPickMove(validMoves, ctx);
    pick = aiMaybeForceProactiveMove(validMoves, ctx, pick);
    return pick;
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
function aiExertDiscardComparator(a, b) {
    const ac = Number(a?.cost || 0);
    const bc = Number(b?.cost || 0);
    if (ac !== bc) return ac - bc;
    const av = Number(a?.dmg || 0) + (String(a?.type || '') === 'attack' ? 1.5 : 0);
    const bv = Number(b?.dmg || 0) + (String(b?.type || '') === 'attack' ? 1.5 : 0);
    return av - bv;
}

function aiGetActiveFromTimeline(timeline, momentIndex) {
    if (!Array.isArray(timeline) || momentIndex < 0 || momentIndex > 4) return null;
    const item = timeline[momentIndex];
    if (item && item !== 'occupied') return item;
    if (item === 'occupied') {
        for (let i = momentIndex + 1; i < 5; i++) {
            const fwd = timeline[i];
            if (fwd && fwd !== 'occupied') {
                const startIndex = i - ((fwd.moments || 1) - 1);
                if (momentIndex >= startIndex && momentIndex <= i) return fwd;
            }
        }
    }
    return null;
}

function aiCountPlanTypes(timeline, startIdx, endIdx) {
    const out = { defensive: 0, proactive: 0 };
    if (!Array.isArray(timeline)) return out;
    for (let i = Math.max(0, startIdx); i < Math.min(5, endIdx); i++) {
        const c = timeline[i];
        if (!c || c === 'occupied') continue;
        if (c.type === 'block' || c.type === 'parry') out.defensive += 1;
        if (c.type === 'attack' || c.type === 'grab' || c.type === 'buff' || c.type === 'utility') out.proactive += 1;
    }
    return out;
}

function aiCanFitMoveInWindow(timeline, slotIndex, moments, windowEnd) {
    const m = Math.max(1, Number(moments || 1));
    if ((slotIndex + m) > windowEnd) return false;
    for (let j = 0; j < m; j++) {
        if (timeline[slotIndex + j] !== null) return false;
    }
    return true;
}

function aiBuildValidMovesForState(stateObj, opts, slotIndex) {
    const out = [];
    const aiLevel = String(opts?.aiLevel || aiGetDifficulty()).toLowerCase();
    const windowEnd = Number(opts?.windowEnd || 5);
    const timeline = stateObj.timeline;
    const virtualStam = Number(stateObj.virtualStam || 0);

    out.push({ name: 'Block', type: 'block', cost: 0, moments: 1, dmg: 0, isBasic: true });
    if (virtualStam >= 1) out.push({ name: 'Parry', type: 'parry', cost: 1, moments: 1, dmg: 0, isBasic: true });
    if (aiLevel === 'hard' || aiLevel === 'pro') out.push({ name: 'Hold', type: 'wait', cost: 0, moments: 1, dmg: 0, isBasic: true, isWait: true });

    const ability1 = opts?.ability1 || null;
    const ability2 = opts?.ability2 || null;
    const hasByName = (n) => timeline.some(c => c && c !== 'occupied' && c.name === n);

    if (ability1 && !hasByName(ability1.name)) {
        const c = Number(getMoveCost('ai', ability1) || 0);
        const m = Number(ability1.moments || 1);
        if (c <= virtualStam && aiCanFitMoveInWindow(timeline, slotIndex, m, windowEnd)) out.push(ability1);
    }
    if (ability2 && !hasByName(ability2.name)) {
        const c = Number(getMoveCost('ai', ability2) || 0);
        const m = Number(ability2.moments || 1);
        if (c <= virtualStam && aiCanFitMoveInWindow(timeline, slotIndex, m, windowEnd)) out.push(ability2);
    }

    (stateObj.hand || []).forEach((card) => {
        if (!card || card.type === 'enhancer') return;
        const c = Number(getMoveCost('ai', card) || 0);
        const m = Number(card.moments || 1);
        if (m <= 0) return;
        if (c <= virtualStam && aiCanFitMoveInWindow(timeline, slotIndex, m, windowEnd)) out.push(card);
    });

    return out;
}

function aiStateContextForPlan(stateObj, slotIndex, opts) {
    const counts = aiCountPlanTypes(stateObj.timeline, Number(opts?.windowStart || 0), slotIndex + 1);
    return {
        slotIndex,
        slotsLeft: Math.max(0, Number(opts?.windowEnd || 5) - slotIndex),
        virtualStam: Number(stateObj.virtualStam || 0),
        playerModel: opts.playerModel || aiEstimatePlayerProfile(String(opts?.aiLevel || aiGetDifficulty()) === 'pro'),
        lastMove: aiGetActiveFromTimeline(stateObj.timeline, slotIndex - 1),
        revealedPlayerCard: opts.revealedPlayerCard || null,
        difficulty: opts.aiLevel || aiGetDifficulty(),
        defensiveSoFar: counts.defensive,
        proactiveSoFar: counts.proactive,
        slotIntel: aiGetSlotIntel(slotIndex),
        futureGrabTailThreat: aiHasLateGrabThreat(slotIndex),
        futureAttackTailThreat: aiHasLateAttackThreat(slotIndex),
        noRandom: true,
        aiHand: (stateObj?.hand || []).slice(),
        aiAbility1: opts?.ability1 || null,
        aiAbility2: opts?.ability2 || null
    };
}

function aiApplyMoveToPlanState(stateObj, move, slotIndex, ctx, opts) {
    const cost = Number(getMoveCost('ai', move) || 0);
    if (cost > Number(stateObj.virtualStam || 0)) return null;

    const next = {
        timeline: stateObj.timeline.slice(),
        hand: stateObj.hand.slice(),
        virtualStam: Number(stateObj.virtualStam || 0) - cost,
        score: Number(stateObj.score || 0),
        cursor: slotIndex + (move?.isWait ? 1 : Math.max(1, Number(move?.moments || 1)))
    };

    if (!move?.isWait) {
        const m = Math.max(1, Number(move?.moments || 1));
        for (let j = 0; j < m - 1; j++) next.timeline[slotIndex + j] = 'occupied';
        next.timeline[slotIndex + (m - 1)] = move;
    }

    if (!move?.isBasic) {
        const idx = next.hand.findIndex(c => c && move && c.uniqueId === move.uniqueId);
        if (idx !== -1) next.hand.splice(idx, 1);
    }

    const scoreDelta = aiScoreMove(move, ctx);
    next.score += Number.isFinite(scoreDelta) ? scoreDelta : -50;
    return next;
}

function aiPlanWindowBeam(opts) {
    const windowStart = Math.max(0, Number(opts?.windowStart || 0));
    const windowEnd = Math.min(5, Number(opts?.windowEnd || 5));
    const aiLevel = String(opts?.aiLevel || aiGetDifficulty()).toLowerCase();
    const beamWidth = Math.max(4, Number(opts?.beamWidth || (aiLevel === 'pro' ? 22 : 14)));

    let beam = [{
        timeline: (opts?.initialTimeline || [null, null, null, null, null]).slice(),
        hand: (opts?.initialHand || []).slice(),
        virtualStam: Number(opts?.initialVirtualStam || 0),
        score: 0,
        cursor: windowStart
    }];

    const rankState = (s) => {
        const counts = aiCountPlanTypes(s.timeline, windowStart, windowEnd);
        return Number(s.score || 0) + (Number(s.virtualStam || 0) * 0.35) + (counts.proactive * 0.15) - (counts.defensive * 0.03);
    };

    for (let iter = 0; iter < 20; iter++) {
        const expanded = [];
        let allDone = true;

        for (const st of beam) {
            let slotIndex = Number(st.cursor || windowStart);
            while (slotIndex < windowEnd && st.timeline[slotIndex] !== null) slotIndex += 1;

            if (slotIndex >= windowEnd) {
                const doneState = { ...st, cursor: slotIndex };
                expanded.push(doneState);
                continue;
            }
            allDone = false;

            let validMoves = aiBuildValidMovesForState(st, { ...opts, windowEnd, aiLevel }, slotIndex);
            const ctx = aiStateContextForPlan(st, slotIndex, { ...opts, windowStart, windowEnd, aiLevel });

            if (aiLevel === 'hard' || aiLevel === 'pro') {
                validMoves = aiApplyLateGrabAntiTurtle(validMoves, ctx);
                validMoves = aiPruneDominatedMoves(validMoves, ctx);
            }

            if (!validMoves.length) {
                validMoves = [{ name: 'Hold', type: 'wait', cost: 0, moments: 1, dmg: 0, isBasic: true, isWait: true }];
            }

            for (const mv of validMoves) {
                const ns = aiApplyMoveToPlanState(st, mv, slotIndex, { ...ctx, virtualStam: st.virtualStam }, { ...opts, windowStart, windowEnd, aiLevel });
                if (ns) expanded.push(ns);
            }
        }

        if (!expanded.length) break;
        expanded.sort((a, b) => rankState(b) - rankState(a));
        beam = expanded.slice(0, beamWidth);
        if (allDone) break;
    }

    if (!beam.length) return null;
    beam.sort((a, b) => {
        const ra = rankState(a);
        const rb = rankState(b);
        if (rb !== ra) return rb - ra;
        return Number(b.virtualStam || 0) - Number(a.virtualStam || 0);
    });
    return beam[0];
}

function aiChooseExertAndPlanMain(opts) {
    const aiLevel = String(opts?.aiLevel || aiGetDifficulty()).toLowerCase();
    const baseHand = (opts?.hand || []).slice();
    const baseStam = Number(opts?.baseStam || 0);
    const maxStam = Number(opts?.maxStam || 7);
    const aiReqBlocks = Number(opts?.aiReqBlocks || 0);

    let maxExert = Math.min(Math.max(0, maxStam - baseStam), Math.max(0, baseHand.length - 1));
    if (aiLevel === 'normal') maxExert = Math.min(maxExert, 1);

    let best = null;

    for (let exert = 0; exert <= maxExert; exert++) {
        const simHand = baseHand.slice().sort(aiExertDiscardComparator);
        const discarded = [];
        for (let i = 0; i < exert; i++) {
            const d = simHand.shift();
            if (d) discarded.push(d);
        }

        const simStam = Math.min(maxStam, baseStam + exert);
        const initialTimeline = [null, null, null, null, null];
        for (let i = 0; i < aiReqBlocks; i++) {
            const idx = initialTimeline.indexOf(null);
            if (idx === -1) break;
            initialTimeline[idx] = { name: 'Block', type: 'block', cost: 0, moments: 1, dmg: 0, isBasic: true };
        }

        const plan = aiPlanWindowBeam({
            windowStart: 0,
            windowEnd: 5,
            initialTimeline,
            initialHand: simHand,
            initialVirtualStam: simStam,
            aiLevel,
            playerModel: opts?.playerModel,
            ability1: opts?.ability1 || null,
            ability2: opts?.ability2 || null,
            revealedPlayerCard: null,
            beamWidth: aiLevel === 'pro' ? 26 : 16
        });
        if (!plan) continue;

        const counts = aiCountPlanTypes(plan.timeline, 0, 5);
        let utility = Number(plan.score || 0) + (Number(plan.virtualStam || 0) * 0.35) + (counts.proactive * 0.2) - (exert * 0.2);
        if ((aiGetLateGrabThreat(3).rate || 0) >= 0.45 && Number(plan.virtualStam || 0) <= 0) utility -= 4;
        if ((aiGetLateAttackThreat(3).rate || 0) >= 0.50 && counts.defensive <= 0) utility -= 3;

        if (!best || utility > best.utility) {
            best = { exertCount: exert, discarded, plan, utility };
        }
    }

    return best;
}

function planAI() {
    if (typeof isTutorialMode !== 'undefined' && isTutorialMode) return;

    const aiClass = state.ai.class;
    const aiLevel = aiGetDifficulty();
    const baseStam = Number(state.ai.stam || 0);
    const aiReqBlocks = Number(state.ai.statuses.mustBlock || 0);
    const ability1 = getAbilityCard(aiClass, 1);
    const ability2 = getAbilityCard(aiClass, 2);

    const chosen = aiChooseExertAndPlanMain({
        aiLevel,
        hand: state.ai.hand,
        baseStam,
        maxStam: state.ai.maxStam,
        aiReqBlocks,
        playerModel: aiEstimatePlayerProfile(aiLevel === 'pro'),
        ability1,
        ability2
    });

    if (chosen && chosen.plan) {
        for (let i = 0; i < Number(chosen.exertCount || 0); i++) {
            log('AI EXERTS! Discarded a card for 1 Stamina.');
            spawnFloatingText('ai', '+1 ⚡', 'float-heal');
        }
        state.ai.stam = Math.min(state.ai.maxStam || 7, baseStam + Number(chosen.exertCount || 0));
        state.ai.timeline = chosen.plan.timeline.slice();
        state.ai.hand = chosen.plan.hand.slice();

        renderAITimeline();
        updateUI();
        return;
    }

    // Fallback safety: if planner fails, keep AI functional.
    state.ai.timeline = [
        { name: 'Block', type: 'block', cost: 0, moments: 1, dmg: 0, isBasic: true },
        { name: 'Block', type: 'block', cost: 0, moments: 1, dmg: 0, isBasic: true },
        { name: 'Block', type: 'block', cost: 0, moments: 1, dmg: 0, isBasic: true },
        { name: 'Block', type: 'block', cost: 0, moments: 1, dmg: 0, isBasic: true },
        { name: 'Block', type: 'block', cost: 0, moments: 1, dmg: 0, isBasic: true }
    ];
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
    const classes = ['card'];
    if (card?.type === 'enhancer') classes.push('enhancer-card');
    if (typeof window.isMultiMomentActiveCard === 'function' && window.isMultiMomentActiveCard(card)) classes.push('multi-active-card');
    return `
        <div class="${classes.join(' ')}" style="width: 100%; height: 100%; margin: 0; box-sizing: border-box; cursor: default;">
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
                    if (!state.player.timeline[i].isBasic && !state.player.timeline[i].isAbility) state.player.hand.push(state.player.timeline[i]);
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
        if (!pData.card.isBasic && !pData.card.isAbility) state.player.hand.push(pData.card);
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
            if (!aiLiveCard.isBasic && !aiLiveCard.isAbility) state.ai.hand.push(aiLiveCard); 
            for(let i=0; i<momentsFreed; i++) state.ai.timeline[pivotStartIndex + i] = null; 
        } else {
             state.ai.timeline[state.flashMoment] = null;
        }

        // --- AI MINI-PLANNING ---
        let currentSlot = pivotStartIndex;
        let slotsLeftToFill = momentsFreed;
        let virtualStam = state.ai.stam;

        const pivotPlan = aiPlanWindowBeam({
            windowStart: pivotStartIndex,
            windowEnd: Math.min(5, pivotStartIndex + momentsFreed),
            initialTimeline: state.ai.timeline.slice(),
            initialHand: state.ai.hand.slice(),
            initialVirtualStam: state.ai.stam,
            aiLevel: aiGetDifficulty(),
            playerModel: aiEstimatePlayerProfile(aiGetDifficulty() === 'pro'),
            revealedPlayerCard: pCard || null,
            beamWidth: aiGetDifficulty() === 'pro' ? 20 : 12
        });
        if (pivotPlan) {
            state.ai.timeline = pivotPlan.timeline.slice();
            state.ai.hand = pivotPlan.hand.slice();
            state.ai.stam = Math.max(0, Number(pivotPlan.virtualStam || 0));
            slotsLeftToFill = 0;
        }

        while (slotsLeftToFill > 0) {
            let validMoves = [];
            validMoves.push({ name: 'Block', type: 'block', cost: 0, moments: 1, dmg: 0, isBasic: true });
            if (virtualStam >= 1) validMoves.push({ name: 'Parry', type: 'parry', cost: 1, moments: 1, dmg: 0, isBasic: true });
            if (aiGetDifficulty() === 'hard' || aiGetDifficulty() === 'pro') validMoves.push({ name: 'Hold', type: 'wait', cost: 0, moments: 1, dmg: 0, isBasic: true, isWait: true });
            
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
                revealedPlayerCard: pCard || null,
                difficulty: aiGetDifficulty(),
                defensiveSoFar: state.ai.timeline.filter((c, idx) => idx >= pivotStartIndex && idx <= currentSlot && c && c !== 'occupied' && (c.type === 'block' || c.type === 'parry')).length,
                proactiveSoFar: state.ai.timeline.filter((c, idx) => idx >= pivotStartIndex && idx <= currentSlot && c && c !== 'occupied' && (c.type === 'attack' || c.type === 'grab' || c.type === 'buff' || c.type === 'utility')).length,
                slotIntel: aiGetSlotIntel(currentSlot),
                futureGrabTailThreat: aiHasLateGrabThreat(currentSlot),
                futureAttackTailThreat: aiHasLateAttackThreat(currentSlot)
            };
            if (pivotCtx.difficulty === 'hard' || pivotCtx.difficulty === 'pro') {
                const lowHpPivot = (state.ai.maxHp > 0) ? ((state.ai.hp / state.ai.maxHp) < 0.4) : false;
                const minProactivePivot = lowHpPivot ? 1 : 2;
                const maxDefensivePivot = lowHpPivot ? 3 : 2;
                const proactiveNeededPivot = Math.max(0, minProactivePivot - (pivotCtx.proactiveSoFar || 0));
                const mustProactiveNowPivot = proactiveNeededPivot >= Math.max(1, pivotCtx.slotsLeft || 1) || (pivotCtx.slotIndex >= (pivotStartIndex + 1) && (pivotCtx.proactiveSoFar || 0) === 0);
                const proactivePoolPivot = validMoves.filter(m => m && (m.type === 'attack' || m.type === 'grab' || m.type === 'buff' || m.type === 'utility'));
                if (mustProactiveNowPivot && proactivePoolPivot.length) {
                    validMoves = proactivePoolPivot;
                } else if ((pivotCtx.defensiveSoFar || 0) >= maxDefensivePivot && proactivePoolPivot.length) {
                    validMoves = proactivePoolPivot;
                }
            }
            validMoves = aiApplyLateGrabAntiTurtle(validMoves, pivotCtx);
            validMoves = aiPruneDominatedMoves(validMoves, pivotCtx);
            let chosenMove = aiPickMoveByDifficulty(validMoves, pivotCtx);
            if (!chosenMove) chosenMove = validMoves[Math.floor(Math.random() * validMoves.length)];

            virtualStam -= getMoveCost('ai', chosenMove);
            state.ai.stam -= getMoveCost('ai', chosenMove);
            
            if (!chosenMove.isWait) {
                for(let j=0; j < chosenMove.moments; j++) {
                    state.ai.timeline[currentSlot + j] = (j === chosenMove.moments - 1) ? chosenMove : 'occupied';
                }
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

