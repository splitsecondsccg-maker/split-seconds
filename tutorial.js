// tutorial.js
let isTutorialMode = false;
let currentStep = 0;

function forcePlanningPhase() {
    state.phase = 'planning';
    if (document.getElementById('exert-controls')) document.getElementById('exert-controls').style.display = 'none';
    if (document.getElementById('action-controls')) document.getElementById('action-controls').style.display = 'flex';
}

function clearBoard() {
    state.player.timeline = [null, null, null, null, null];
    state.ai.timeline = [null, null, null, null, null];
    state.player.hand = [];
    state.ai.hand = [];
    document.querySelectorAll('.moment-col').forEach(c => c.classList.remove('active-moment'));
}

function hideNext() { document.getElementById('tutorial-next-btn').style.display = 'none'; }
function showNext() { document.getElementById('tutorial-next-btn').style.display = 'inline-block'; }

const tutorialSteps = [
    // --- INTRO & HUD ---
    { message: "Welcome to Split Seconds! Let's learn the interface.", highlightIds: [], setup: () => { clearBoard(); } },
    { message: "Look at the top of the screen. You have Health, Stamina (⚡), and Armor (🛡️). Armor reduces incoming damage when you Block.", highlightIds: [] },
    { message: "This is your Hand. Cards cost Stamina (⚡) and take a certain amount of time to execute (Moments ⏱️).", highlightIds: ["player-hand"] },
    { message: "Combat happens over 5 Moments here on the Timeline.", highlightIds: ["player-timeline", "ai-timeline"] },
    
    // --- LESSON 1: BASIC ATTACK ---
    { message: "Let's attack! Drag 'Quick Jab' (Cost: 0, Moments: 1) into Slot 1, then hit LOCK!", highlightIds: ["player-hand", "player-timeline", "btn-start-resolution"], 
      setup: () => { hideNext(); forcePlanningPhase(); clearBoard();
      state.player.hand = [{ id: 'r1', uniqueId: 'tut_1', name: 'Quick Jab', type: 'attack', cost: 0, moments: 1, dmg: 2 }]; updateUI(); } 
    },
    { message: "This is the Flash! It peeks at the first card played. The AI played nothing. Hit LOCK IN!", highlightIds: ["flash-modal", "btn-lock"], setup: () => { hideNext(); } },
    { message: "Watch the combat resolve! Next, let's learn about Multi-Moment actions.", highlightIds: [], setup: () => { showNext(); } },
    
    // --- LESSON 2: MULTI-MOMENT ---
    { message: "Drag 'Lunging Dagger' (2 Moments) into Slot 1. Notice how it takes up TWO slots! Hit LOCK.", highlightIds: ["player-hand", "player-timeline", "btn-start-resolution"], 
      setup: () => { hideNext(); forcePlanningPhase(); clearBoard();
      state.player.hand = [{ id: 'r3', uniqueId: 'tut_2', name: 'Lunging Dagger', type: 'attack', cost: 1, moments: 2, dmg: 4 }]; 
      state.player.stam = 1; updateUI(); } 
    },
    { message: "It takes longer, but hits harder. Hit LOCK IN to resolve it.", highlightIds: ["flash-modal", "btn-lock"], setup: () => { hideNext(); } },
    
    // --- LESSON 3: COMBAT TRIANGLE ---
    { message: "Now for the Combat Triangle: Attack beats Grab, Grab beats Block, and Block safely stops Attacks.", highlightIds: [], setup: () => { showNext(); } },
    { message: "The opponent is playing a Block. To beat it, use a Grab! Drag 'Kidney Strike' to Slot 1 and hit LOCK.", highlightIds: ["player-hand", "player-timeline", "btn-start-resolution"], 
      setup: () => { hideNext(); forcePlanningPhase(); clearBoard();
      state.ai.timeline[0] = { id: 'b1', name: 'Block', type: 'block', cost: 0, moments: 1, dmg: 0 };
      state.player.hand = [{ id: 'r4', uniqueId: 'tut_3', name: 'Kidney Strike', type: 'grab', cost: 1, moments: 1, dmg: 3 }]; 
      state.player.stam = 1; updateUI(); } 
    },
    { message: "Your Grab will crush their Block! Hit LOCK IN!", highlightIds: ["flash-modal", "btn-lock"], setup: () => { hideNext(); } },

    // --- LESSON 4: THE FLASH, PIVOT, AND ARMOR ---
    { message: "Finally, the most important mechanic: The FLASH and PIVOT.", highlightIds: [], setup: () => { showNext(); } },
    { message: "The AI plans a heavy Attack. Play a Grab in Slot 1 and hit LOCK anyway. Trust me!", highlightIds: ["player-hand", "player-timeline", "btn-start-resolution"],
        setup: () => { hideNext(); forcePlanningPhase(); clearBoard();
            state.ai.timeline[0] = { id: 'p1', name: 'Smite', type: 'attack', cost: 0, moments: 1, dmg: 4 };
            state.player.hand = [{ id: 'r4', uniqueId: 'tut_4', name: 'Kidney Strike', type: 'grab', cost: 1, moments: 1, dmg: 3 }];
            state.player.stam = 2; updateUI(); }
    },
    { message: "WAIT! The Flash shows your Grab will lose! Click PIVOT to spend 1 Stamina and take your card back.", highlightIds: ["flash-modal", "btn-pivot"], setup: () => { hideNext(); } },
    { message: "Nice save! Now, instead of a card, click the 'Basic Block' BUTTON below your hand to place a block, then hit LOCK!", highlightIds: ["action-controls", "btn-start-resolution"],
        setup: () => { hideNext(); state.player.hand = []; updateUI(); } // Cleared hand so they HAVE to use the button
    },
    { message: "Your Block intercepts their Attack safely! Hit LOCK IN!", highlightIds: ["flash-modal", "btn-lock"], setup: () => { hideNext(); } },
    { message: "Notice how you took 1 damage? Their attack did 4 Damage, but your Rogue has 3 Armor! 4 - 3 = 1 Damage taken.", highlightIds: [], setup: () => { showNext(); } },
    
    // --- OUTRO ---
    { message: "You did it! In a real game, you automatically draw up to 2 cards every round. Good luck out there!", highlightIds: [], setup: () => { showNext(); } }
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
    overlay.style.background = 'transparent'; // Ensure the overlay itself isn't dimming the screen!
    
    runStep();
}

function runStep() {
    if (currentStep >= tutorialSteps.length) {
        endTutorial();
        return;
    }
    const step = tutorialSteps[currentStep];
    document.getElementById('tutorial-text').innerText = step.message;
    document.getElementById('tutorial-next-btn').style.display = 'inline-block';
    document.querySelectorAll('.tutorial-spotlight').forEach(el => el.classList.remove('tutorial-spotlight'));
    
    // Smart Dimming Logic!
    if (step.highlightIds && step.highlightIds.length > 0) {
        document.body.classList.add('tutorial-dimmed');
        step.highlightIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('tutorial-spotlight');
        });
    } else {
        document.body.classList.remove('tutorial-dimmed');
    }
    
    if (step.setup) step.setup();
    if (typeof updateUI === 'function') updateUI();
}

function advanceTutorial() {
    currentStep++;
    runStep();
}

function endTutorial() {
    isTutorialMode = false;
    document.body.classList.remove('tutorial-active');
    document.body.classList.remove('tutorial-dimmed');
    document.getElementById('tutorial-overlay').style.display = 'none';
    document.querySelectorAll('.tutorial-spotlight').forEach(el => el.classList.remove('tutorial-spotlight'));
    alert("Tutorial Complete! Returning to menu.");
    location.reload(); 
}