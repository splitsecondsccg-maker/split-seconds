// tutorial.js
// Interactive tutorial flow controller (data-driven expectations).

let isTutorialMode = false;
let currentStep = 0;

function forcePlanningPhase() {
    state.phase = 'planning';
    const exert = document.getElementById('exert-controls');
    const actions = document.getElementById('action-controls');
    if (exert) exert.style.display = 'none';
    if (actions) actions.style.display = 'flex';
    document.body.classList.remove('exert-mode');
}

function forceExertPhase() {
    state.phase = 'exert';
    const exert = document.getElementById('exert-controls');
    const actions = document.getElementById('action-controls');
    if (exert) exert.style.display = 'flex';
    if (actions) actions.style.display = 'none';
    document.body.classList.add('exert-mode');
}

function clearAllGlowsAndHighlights() {
    // Clear tutorial spotlights
    document.querySelectorAll('.tutorial-spotlight').forEach(el => el.classList.remove('tutorial-spotlight'));

    // Clear flash highlight
    document.querySelectorAll('.slot').forEach(s => s.classList.remove('flash-highlight'));

    // Clear pivot glow + resolve glow
    document.querySelectorAll('#player-timeline .slot, #ai-timeline .slot').forEach(s => {
        s.style.boxShadow = 'none';
        s.style.filter = 'none';
        s.style.backgroundColor = 'transparent';
    });

    // Clear any leftover z-index from resolve
    document.querySelectorAll('.timeline-card').forEach(c => {
        c.style.zIndex = '';
        c.classList.remove('resolving');
    });
}

function clearBoard({ clearHands = true } = {}) {
    // Reset state
    state.player.timeline = [null, null, null, null, null];
    state.ai.timeline = [null, null, null, null, null];
    if (clearHands) {
        state.player.hand = [];
        state.ai.hand = [];
    }

    // Remove any rendered timeline cards
    document.querySelectorAll('.player-placed, .ai-placed').forEach(e => e.remove());

    clearAllGlowsAndHighlights();

    // Close Flash if open
    const flash = document.getElementById('flash-modal');
    if (flash) flash.style.display = 'none';

    // Reset pivot bookkeeping (if any)
    state.pivotSlots = null;
    state.originalPCard = null;
    state.originalAICard = null;
}

function hideNext() {
    const btn = document.getElementById('tutorial-next-btn');
    if (btn) btn.style.display = 'none';
    document.body.classList.add('tutorial-no-next');
}
function showNext() {
    const btn = document.getElementById('tutorial-next-btn');
    if (btn) btn.style.display = 'inline-block';
    document.body.classList.remove('tutorial-no-next');
}

function spotlightStep(step) {
    clearAllGlowsAndHighlights();

    const ids = step.highlightIds || [];
    const selectors = step.highlightSelectors || [];

    const hasHighlights = ids.length > 0 || selectors.length > 0;
    if (hasHighlights) document.body.classList.add('tutorial-dimmed');
    else document.body.classList.remove('tutorial-dimmed');

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('tutorial-spotlight');
    });

    selectors.forEach(sel => {
        try {
            document.querySelectorAll(sel).forEach(el => el.classList.add('tutorial-spotlight'));
        } catch (e) {
            // Ignore invalid selectors
        }
    });

    // Make the coach click-through during interactive steps (so it can't block required clicks)
    const expect = step.expect || null;
    if (expect) document.body.classList.add('tutorial-passive-dialogue');
    else document.body.classList.remove('tutorial-passive-dialogue');
}

function slotSel(side, slot1Based) {
    return `#${side}-timeline .slot:nth-child(${slot1Based})`;
}

function waitUntil(condFn, onReady, timeoutMs = 12000, pollMs = 80) {
    const started = Date.now();
    const t = setInterval(() => {
        if (condFn()) {
            clearInterval(t);
            onReady();
        } else if (Date.now() - started > timeoutMs) {
            clearInterval(t);
            // Fail-safe: don't soft-lock the tutorial.
            showNext();
        }
    }, pollMs);
}

// --- Tutorial cards ---
const TUT = {
    quickJab: { id: 'r1', uniqueId: 'tut_quickjab', name: 'Quick Jab', type: 'attack', cost: 0, moments: 1, dmg: 2, desc: 'Fast jab.' },
    lungingDagger: { id: 'r3', uniqueId: 'tut_lunge', name: 'Lunging Dagger', type: 'attack', cost: 1, moments: 2, dmg: 4, desc: 'Wind-up, then strike.' },
    kidneyStrike: { id: 'r4', uniqueId: 'tut_grab', name: 'Kidney Strike', type: 'grab', cost: 1, moments: 1, dmg: 3, desc: 'Grab: beats Block, loses to Attack.' }
};

// --- Steps ---
// For interactive steps, we use `expect` so engine.js can gate the correct button.
// `requiredSlot` is 0-based (0 = Slot 1).
// `forceFlashMoment` is 0-based (0 = Moment 1). Engine reads it.

const tutorialSteps = [
    {
        message: "Welcome to Split Seconds! We'll learn the UI, the 5-Moment timeline, and the Flash/Pivot mind-game.",
        setup: () => {
            clearBoard();
            forcePlanningPhase();
            const logEl = document.getElementById('battle-log');
            if (logEl) logEl.innerHTML = '<strong>Battle Log</strong>';
        }
    },
    {
        message: "Win condition: reduce the opponent to 0 HP. Your HUD shows HP, Stamina (⚡), and Armor (🛡️).",
        highlightIds: ['player-stats', 'ai-stats']
    },
    {
        message: "This is the Timeline: 5 Moments (Slots 1 → 5). You plan actions into slots, then they resolve in order.",
        highlightIds: ['player-timeline', 'ai-timeline']
    },
    {
        message: "This is your Hand. Cards cost Stamina (⚡) and take time (⏱️). Drag cards onto the timeline to schedule them.",
        highlightIds: ['player-hand']
    },

    // Exert & Draw
    {
        message: "Every round starts with EXERTION: you may burn cards for +1 Stamina each. Then you draw up to 2 cards (hand limit 7).",
        highlightIds: ['exert-controls'],
        setup: () => {
            forceExertPhase();
            state.player.hand = [
                { ...TUT.quickJab, uniqueId: 'tut_exert_preview_1' },
                { ...TUT.quickJab, uniqueId: 'tut_exert_preview_2' },
                { ...TUT.kidneyStrike, uniqueId: 'tut_exert_preview_3' }
            ];
            updateUI();
        }
    },
    {
        message: "Try it: (optional) click a card to burn it, then press CONFIRM & DRAW.",
        expect: 'confirmExert',
        highlightIds: ['exert-controls', 'player-hand', 'btn-confirm-exert'],
        setup: () => {
            hideNext();
            clearBoard({ clearHands: false });
            forceExertPhase();
            state.player.hand = [
                { ...TUT.quickJab, uniqueId: 'tut_exert_1' },
                { ...TUT.quickJab, uniqueId: 'tut_exert_2' },
                { ...TUT.kidneyStrike, uniqueId: 'tut_exert_3' }
            ];
            updateUI();
        }
    },
    {
        message: "Nice. Now you're back to PLANNING. You can also place free Basics: Block (0⚡) and Parry (1⚡).",
        highlightIds: ['action-controls', 'btn-block', 'btn-parry'],
        setup: () => {
            showNext();
            forcePlanningPhase();
        }
    },

    // Block & Armor
    {
        message: "Defense check: the opponent secretly scheduled a 4-DMG attack in Slot 1. Click BLOCK to place it, then hit LOCK.",
        expect: 'lock',
        requiredSlot: 0,
        highlightIds: ['btn-block', 'btn-start-resolution'],
        highlightSelectors: [slotSel('player', 1)],
        setup: () => {
            hideNext();
            forcePlanningPhase();
            clearBoard();
            state.ai.timeline[0] = { name: 'Smite', type: 'attack', cost: 0, moments: 1, dmg: 4, isBasic: true };
            state.player.stam = Math.min(state.player.stam, state.player.maxStam);
            updateUI();
        }
    },
    {
        message: "FLASH: one random Moment is revealed. In the tutorial we force Moment 1 so you can learn. Click LOCK IN.",
        expect: 'lockIn',
        forceFlashMoment: 0,
        highlightIds: ['flash-modal', 'btn-lock'],
        setup: () => { hideNext(); }
    },
    {
        message: "Result: you blocked the attack. Damage is reduced by Armor (🛡️). (Attack 4) − (Your Armor) = damage taken.\n\nNext: let's throw our own attack.",
        setup: () => {
            hideNext();
            waitUntil(() => state.phase === 'exert', () => showNext());
        }
    },

    // Basic attack
    {
        message: "Attack basics: drag Quick Jab into Slot 1, then hit LOCK.",
        expect: 'lock',
        requiredSlot: 0,
        highlightIds: ['player-hand', 'btn-start-resolution'],
        highlightSelectors: [slotSel('player', 1)],
        setup: () => {
            hideNext();
            forcePlanningPhase();
            clearBoard();
            state.player.hand = [{ ...TUT.quickJab, uniqueId: 'tut_attack_1' }];
            updateUI();
        }
    },
    {
        message: "FLASH (Moment 1): you see what BOTH sides have in that Moment. Click LOCK IN.",
        expect: 'lockIn',
        forceFlashMoment: 0,
        highlightIds: ['flash-modal', 'btn-lock'],
        setup: () => { hideNext(); }
    },
    {
        message: "Good. Combat resolves left-to-right (Moment 1 → 5).\n\nNext: Multi-Moment actions.",
        setup: () => {
            hideNext();
            waitUntil(() => state.phase === 'exert', () => showNext());
        }
    },

    // Multi-moment
    {
        message: "Multi-Moment actions take up multiple slots and execute on the LAST slot. Drag Lunging Dagger starting in Slot 1, then hit LOCK.",
        expect: 'lock',
        requiredSlot: 0,
        highlightIds: ['player-hand', 'btn-start-resolution'],
        highlightSelectors: [slotSel('player', 1), slotSel('player', 2)],
        setup: () => {
            hideNext();
            forcePlanningPhase();
            clearBoard();
            state.player.stam = 1;
            state.player.hand = [{ ...TUT.lungingDagger, uniqueId: 'tut_multimoment_1' }];
            updateUI();
        }
    },
    {
        message: "In this lesson we'll peek at Moment 2 (where the dagger actually lands). Click LOCK IN.",
        expect: 'lockIn',
        forceFlashMoment: 1,
        highlightIds: ['flash-modal', 'btn-lock'],
        setup: () => { hideNext(); }
    },
    {
        message: "Great. The early slot(s) are the wind-up; the final slot is the hit.\n\nNext: the Combat Triangle.",
        setup: () => {
            hideNext();
            waitUntil(() => state.phase === 'exert', () => showNext());
        }
    },

    // Combat Triangle: Grab vs Block
    {
        message: "Combat Triangle: Grab beats Block, Block stops Attack, Attack beats Grab (it interrupts).\n\nThe opponent secretly planned a BLOCK in Slot 1. Play Kidney Strike (Grab) in Slot 1 and hit LOCK.",
        expect: 'lock',
        requiredSlot: 0,
        highlightIds: ['player-hand', 'btn-start-resolution'],
        highlightSelectors: [slotSel('player', 1)],
        setup: () => {
            hideNext();
            forcePlanningPhase();
            clearBoard();
            state.ai.timeline[0] = { name: 'Block', type: 'block', cost: 0, moments: 1, dmg: 0, isBasic: true };
            state.player.stam = 1;
            state.player.hand = [{ ...TUT.kidneyStrike, uniqueId: 'tut_grab_1' }];
            updateUI();
        }
    },
    {
        message: "FLASH (Moment 1): you can see their Block. Grab will break through. Click LOCK IN.",
        expect: 'lockIn',
        forceFlashMoment: 0,
        highlightIds: ['flash-modal', 'btn-lock'],
        setup: () => { hideNext(); }
    },
    {
        message: "Yep — Grab punishes Block.\n\nNext: the EMPTY SLOT dodge (and why Pivot matters).",
        setup: () => {
            hideNext();
            waitUntil(() => state.phase === 'exert', () => showNext());
        }
    },

    // Empty slot dodge + pivot
    {
        message: "Important rule: Grabs only connect if the target is Blocking/Parrying. If the target slot is EMPTY (or Attacking), the Grab MISSES.\n\nPlay Kidney Strike in Slot 1 and hit LOCK.",
        expect: 'lock',
        requiredSlot: 0,
        highlightIds: ['player-hand', 'btn-start-resolution'],
        highlightSelectors: [slotSel('player', 1)],
        setup: () => {
            hideNext();
            forcePlanningPhase();
            clearBoard();
            state.ai.timeline[0] = null; // AI plays nothing in Moment 1.
            state.player.stam = 2;
            state.player.hand = [{ ...TUT.kidneyStrike, uniqueId: 'tut_grab_miss_1' }];
            updateUI();
        }
    },
    {
        message: "FLASH shows the opponent is EMPTY in Moment 1 — your Grab would whiff. Click PIVOT to cancel the revealed card (costs 1⚡).",
        expect: 'pivot',
        forceFlashMoment: 0,
        highlightIds: ['flash-modal', 'btn-pivot'],
        setup: () => { hideNext(); }
    },
    {
        message: "Now you can ONLY edit the glowing slot(s). Drag Quick Jab into Slot 1 and click your MAIN LOCK button.",
        expect: 'lock',
        requiredSlot: 0,
        highlightIds: ['player-hand', 'btn-start-resolution'],
        highlightSelectors: [slotSel('player', 1)],
        setup: () => {
            hideNext();
            // We're already in pivot_wait. Give them exactly one option.
            state.player.hand = [{ ...TUT.quickJab, uniqueId: 'tut_pivot_fill_1' }];
            updateUI();
        }
    },
    {
        // FIXED: there is no second flash after a pivot fill.
        message: "Nice pivot. There is **no second Flash** — after you fill the slot(s) and press LOCK, the round goes straight to RESOLUTION.\n\nWatch the timeline resolve, then click NEXT.",
        setup: () => {
            hideNext();
            waitUntil(() => state.phase === 'exert', () => showNext());
        }
    },
    {
        message: "Perfect — this is the core mind-game: plan → Flash reveals one moment → Pivot if needed → Clash.\n\nNext: Parry and the draw penalty.",
        setup: () => {
            hideNext();
            // If we already are in exert, Next will show immediately.
            waitUntil(() => state.phase === 'exert', () => showNext(), 2000);
        }
    },

    // Parry lesson
    {
        message: "Parry costs 1⚡. If you attack into a Parry, your attack is canceled AND you draw 1 fewer card next round.\n\nThe opponent secretly planned a PARRY in Slot 1. Play Quick Jab in Slot 1 and hit LOCK.",
        expect: 'lock',
        requiredSlot: 0,
        highlightIds: ['player-hand', 'btn-start-resolution'],
        highlightSelectors: [slotSel('player', 1)],
        setup: () => {
            hideNext();
            forcePlanningPhase();
            clearBoard();
            state.ai.timeline[0] = { name: 'Parry', type: 'parry', cost: 1, moments: 1, dmg: 0, isBasic: true };
            state.player.hand = [{ ...TUT.quickJab, uniqueId: 'tut_into_parry_1' }];
            updateUI();
        }
    },
    {
        message: "FLASH (Moment 1): you see the Parry. We'll still LOCK IN to demonstrate the penalty.",
        expect: 'lockIn',
        forceFlashMoment: 0,
        highlightIds: ['flash-modal', 'btn-lock'],
        setup: () => { hideNext(); }
    },
    {
        message: "Round ends after Moment 5. Because your attack was parried, YOUR next draw is reduced by 1.\n\nWhen EXERTION appears, click CONFIRM & DRAW to see it (you'll draw 1 instead of 2).",
        expect: 'confirmExert',
        highlightIds: ['exert-controls', 'btn-confirm-exert'],
        setup: () => {
            hideNext();
            waitUntil(() => state.phase === 'exert', () => { /* confirmExert advances */ });
        }
    },

    // Abilities
    {
        message: "Last piece: each class has 2 special ABILITIES (⭐). You can use each ability at most once per turn.\n\nClick your first Rogue ability (Quick Step), then hit LOCK.",
        expect: 'lock',
        requiredSlot: 0,
        highlightSelectors: ['#player-ability-container .ability-wrapper:nth-child(1) .ability-btn', '#btn-start-resolution', slotSel('player', 1)],
        setup: () => {
            hideNext();
            forcePlanningPhase();
            clearBoard();
            state.player.hand = [];
            updateUI();
        }
    },
    {
        message: "LOCK IN to resolve it.",
        expect: 'lockIn',
        forceFlashMoment: 0,
        highlightIds: ['flash-modal', 'btn-lock'],
        setup: () => { hideNext(); }
    },
    {
        message: "You're ready. Final reminders:\n• Flash reveals ONE random moment.\n• Pivot costs 1⚡ and only lets you change the revealed card/slot(s).\n• Grabs miss empty slots; Attacks interrupt Grabs.\n• Hand limit is 7; draws over the limit are discarded.\n\nGood luck!",
        setup: () => {
            hideNext();
            waitUntil(() => state.phase === 'exert', () => showNext());
        }
    }
];

function startTutorial() {
    isTutorialMode = true;
    currentStep = 0;

    selectChar('player', 'Rogue');
    selectChar('ai', 'Paladin');

    startGame();

    document.body.classList.add('tutorial-active');

    const overlay = document.getElementById('tutorial-overlay');
    overlay.style.display = 'block';
    overlay.style.zIndex = '9999';
    overlay.style.background = 'transparent';

    runStep();
}

function runStep() {
    if (currentStep >= tutorialSteps.length) {
        endTutorial();
        return;
    }

    const step = tutorialSteps[currentStep];
    const textEl = document.getElementById('tutorial-text');
    if (textEl) textEl.innerText = step.message;

    // Default: Next is visible, unless the step setup hides it.
    showNext();

    
    // Run setup first (it may re-render UI or clear highlights), then apply spotlight.
    if (step.setup) step.setup();
    if (typeof updateUI === 'function') updateUI();

    spotlightStep(step);
}

function advanceTutorial() {
    currentStep++;
    runStep();
}

function endTutorial() {
    isTutorialMode = false;
    document.body.classList.remove('tutorial-active');
    document.body.classList.remove('tutorial-dimmed');
    document.body.classList.remove('tutorial-passive-dialogue');

    const overlay = document.getElementById('tutorial-overlay');
    if (overlay) overlay.style.display = 'none';

    clearAllGlowsAndHighlights();

    alert('Tutorial Complete! Returning to menu.');
    location.reload();
}
