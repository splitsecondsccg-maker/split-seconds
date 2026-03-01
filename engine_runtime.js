// engine_runtime.js
// A small runtime layer that introduces:
// - A synchronous Action Queue (so UI inputs are processed deterministically)
// - A pure-ish step() for a subset of player-facing actions (planning + exert)
// - An Event Log (for debugging + future multiplayer determinism)
//
// IMPORTANT: This file is intentionally framework-less and uses globals so the
// project can stay as plain JS+HTML with no build step.

(function () {
  "use strict";

  /** @typedef {{type:string, payload?:any, meta?:any}} GameAction */
  /** @typedef {{type:string, payload?:any, ts:number}} GameEvent */

  const ActionTypes = Object.freeze({
    PLACE_CARD_FROM_HAND: "PLACE_CARD_FROM_HAND",
    RETURN_CARD_TO_HAND: "RETURN_CARD_TO_HAND",
    ADD_BASIC_ACTION: "ADD_BASIC_ACTION",
    USE_ABILITY: "USE_ABILITY",
    TOGGLE_EXERT_CARD: "TOGGLE_EXERT_CARD",
    CONFIRM_EXERT: "CONFIRM_EXERT",

    // Legacy actions (queued, but still call existing imperative functions).
    // These will be migrated into pure step() over time.
    START_RESOLUTION: "START_RESOLUTION",
    LOCK_IN: "LOCK_IN",
    PIVOT: "PIVOT",
  });

  const eventLog = [];
  const handlers = new Map(); // eventType -> Set(fn)

  function on(eventType, fn) {
    if (!handlers.has(eventType)) handlers.set(eventType, new Set());
    handlers.get(eventType).add(fn);
    return () => handlers.get(eventType)?.delete(fn);
  }

  function emit(evt) {
    const e = { ts: Date.now(), ...evt };
    eventLog.push(e);
    const set = handlers.get(e.type);
    if (set) {
      for (const fn of set) {
        try {
          fn(e);
        } catch (err) {
          console.error("Event handler error", e, err);
        }
      }
    }
  }

  // --- Action Queue ---
  const queue = [];
  let processing = false;

  /**
   * Dispatch an action into the queue. Returns the last processed result
   * for this specific action (synchronous).
   */
  function dispatch(action) {
    queue.push(action);
    if (!processing) {
      processing = true;
      try {
        while (queue.length) {
          const a = queue.shift();
          // Record actions as events too (useful for debugging + future replays)
          emit({ type: "ACTION", payload: { action: a } });
          const res = step(window.state, a);

          if (res?.events?.length) {
            for (const evt of res.events) emit(evt);
          }

          // Default UX: alert on errors (unless explicitly disabled)
          if (res && res.ok === false && a?.meta?.alertOnError !== false) {
            if (typeof window.alert === "function") window.alert(res.error);
          }

          // After every successful mutation, refresh UI once.
          if (res && res.ok !== false && !res.skipUIRefresh && typeof window.updateUI === "function") {
            if (typeof window.renderPlayerTimeline === "function") window.renderPlayerTimeline();
            if (typeof window.renderAITimeline === "function") window.renderAITimeline();
            window.updateUI();
          }

          window.EngineRuntime._lastResult = res;
        }
      } finally {
        processing = false;
      }
    }
    return window.EngineRuntime._lastResult;
  }

  // --- Deterministic RNG helper (seed lives in state.rngSeed) ---
  // Mulberry32-ish one-step PRNG; returns float in [0,1)
  function nextRandFloat(s) {
    // Preserve existing gameplay randomness by default.
    // Flip `state.useDeterministicRng = true` (future online mode) to get
    // fully deterministic draws and uniqueId generation.
    if (!s.useDeterministicRng) return Math.random();
    if (typeof s.rngSeed !== "number") s.rngSeed = (Date.now() & 0xffffffff) >>> 0;
    let t = (s.rngSeed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const out = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    s.rngSeed >>>= 0;
    return out;
  }

  function drawCardsPure(s, amount, targetKey) {
    const charState = s[targetKey];
    for (let i = 0; i < amount; i++) {
      if (charState.hand.length >= 7) {
        if (targetKey === "player") {
          emit({ type: "LOG", payload: { message: "Hand full! Discarded drawn card." } });
        }
        break;
      }
      const idx = Math.floor(nextRandFloat(s) * charState.deck.length);
      const base = charState.deck[idx];
      const card = { ...base, uniqueId: "uid_" + nextRandFloat(s) };
      charState.hand.push(card);
    }
  }

  // --- Step (no DOM side-effects; emits events instead) ---
  function step(s, action) {
    if (!s || !action || !action.type) return { ok: false, error: "Invalid action" };

    switch (action.type) {
      case ActionTypes.PLACE_CARD_FROM_HAND: {
        const { handIndex, startMoment } = action.payload || {};
        if (s.phase !== "planning" && s.phase !== "pivot_wait") {
          return { ok: false, error: "You can only place cards during Planning." };
        }
        const card = s.player.hand?.[handIndex];
        if (!card) return { ok: false, error: "Card not found in hand." };
        const sm = Number(startMoment);
        if (!Number.isFinite(sm) || sm < 0 || sm > 4) return { ok: false, error: "Invalid slot." };

        if (s.phase === "pivot_wait") {
          let valid = true;
          for (let i = 0; i < card.moments; i++) {
            if (!s.pivotSlots?.includes(sm + i)) valid = false;
          }
          if (!valid) return { ok: false, error: "During a Pivot, you can only place cards in the highlighted slots!" };
        }

        if (sm + card.moments > 5) return { ok: false, error: "Not enough space!" };
        for (let i = 0; i < card.moments; i++) {
          if (s.player.timeline[sm + i] !== null) return { ok: false, error: "Slot occupied!" };
        }

        const effectiveCost = (typeof window.getMoveCost === "function") ? window.getMoveCost("player", card) : (card.cost || 0);
        if (s.player.stam < effectiveCost) return { ok: false, error: "Not enough stamina!" };

        s.player.stam -= effectiveCost;
        card.paidCost = effectiveCost;
        card.paidUpfront = true;

        for (let i = 0; i < card.moments; i++) {
          s.player.timeline[sm + i] = (i === card.moments - 1) ? card : "occupied";
        }

        s.player.hand.splice(handIndex, 1);

        return {
          ok: true,
          events: [{ type: "PLACE_SOUND", payload: { moments: card.moments } }],
        };
      }

      case ActionTypes.RETURN_CARD_TO_HAND: {
        const { timelineIndex } = action.payload || {};
        if (s.phase !== "planning" && s.phase !== "pivot_wait") {
          return { ok: false, error: "You can only modify the timeline during Planning." };
        }
        const idx = Number(timelineIndex);
        if (!Number.isFinite(idx) || idx < 0 || idx > 4) return { ok: false, error: "Invalid slot." };

        if (s.phase === "pivot_wait" && (!s.pivotSlots || !s.pivotSlots.includes(idx))) {
          return { ok: false, error: "You can only modify the highlighted slots during a Pivot!" };
        }

        const card = s.player.timeline[idx];
        if (!card || card === "occupied") return { ok: false, error: "No card in that slot." };

        const refund = (card.paidCost ?? card.cost ?? 0);
        s.player.stam = Math.min(s.player.maxStam, s.player.stam + refund);
        const startIdx = idx - (card.moments - 1);
        for (let i = 0; i < card.moments; i++) s.player.timeline[startIdx + i] = null;
        if (card.id) s.player.hand.push(card);

        return { ok: true };
      }

      case ActionTypes.ADD_BASIC_ACTION: {
        const { name, cost, moments, dmg, type } = action.payload || {};
        if (s.phase !== "planning" && s.phase !== "pivot_wait") {
          return { ok: false, error: "You can only add actions during Planning." };
        }
        const actionObj = {
          name,
          cost,
          moments,
          dmg,
          type,
          isBasic: true,
          uniqueId: "basic_" + nextRandFloat(s),
        };
        const effectiveCost = (typeof window.getMoveCost === "function") ? window.getMoveCost("player", actionObj) : (cost || 0);
        if (s.player.stam < effectiveCost) return { ok: false, error: "Not enough stamina!" };

        let slot = -1;
        if (s.phase === "pivot_wait") {
          for (let i = 0; i < s.pivotSlots.length; i++) {
            const possibleSlot = s.pivotSlots[i];
            let fits = true;
            for (let j = 0; j < moments; j++) {
              if (!s.pivotSlots.includes(possibleSlot + j) || s.player.timeline[possibleSlot + j] !== null) {
                fits = false;
                break;
              }
            }
            if (fits) {
              slot = possibleSlot;
              break;
            }
          }
          if (slot === -1) return { ok: false, error: "Not enough space in the glowing pivot slots!" };
        } else {
          for (let i = 0; i <= 5 - moments; i++) {
            let spaceFree = true;
            for (let j = 0; j < moments; j++) {
              if (s.player.timeline[i + j] !== null) spaceFree = false;
            }
            if (spaceFree) {
              slot = i;
              break;
            }
          }
          if (slot === -1) return { ok: false, error: "Not enough timeline space!" };
        }

        s.player.stam -= effectiveCost;
        actionObj.paidCost = effectiveCost;
        actionObj.paidUpfront = true;
        for (let i = 0; i < moments; i++) {
          s.player.timeline[slot + i] = (i === moments - 1) ? actionObj : "occupied";
        }

        return { ok: true, events: [{ type: "PLACE_SOUND", payload: { moments } }] };
      }

      case ActionTypes.USE_ABILITY: {
        const { index } = action.payload || {};
        if (s.phase !== "planning" && s.phase !== "pivot_wait") {
          return { ok: false, error: "Abilities can only be used during Planning." };
        }
        if (typeof window.getAbilityCard !== "function") return { ok: false, error: "Ability system not loaded." };
        const abilityCard = window.getAbilityCard(s.player.class, index);
        if (!abilityCard) return { ok: false, error: "Ability not found." };

        const alreadyUsed = s.player.timeline.some((c) => c && c.name === abilityCard.name);
        if (alreadyUsed) return { ok: false, error: "This ability can only be used once per turn!" };
        const effectiveCost = (typeof window.getMoveCost === "function") ? window.getMoveCost("player", abilityCard) : (abilityCard.cost || 0);
        if (s.player.stam < effectiveCost) return { ok: false, error: "Not enough stamina!" };

        let slot = -1;
        if (s.phase === "pivot_wait") {
          for (let i = 0; i < s.pivotSlots.length; i++) {
            const possibleSlot = s.pivotSlots[i];
            let fits = true;
            for (let j = 0; j < abilityCard.moments; j++) {
              if (!s.pivotSlots.includes(possibleSlot + j) || s.player.timeline[possibleSlot + j] !== null) {
                fits = false;
                break;
              }
            }
            if (fits) {
              slot = possibleSlot;
              break;
            }
          }
          if (slot === -1) return { ok: false, error: "Not enough space in the glowing pivot slots!" };
        } else {
          for (let i = 0; i <= 5 - abilityCard.moments; i++) {
            let spaceFree = true;
            for (let j = 0; j < abilityCard.moments; j++) {
              if (s.player.timeline[i + j] !== null) spaceFree = false;
            }
            if (spaceFree) {
              slot = i;
              break;
            }
          }
          if (slot === -1) return { ok: false, error: "Not enough timeline space!" };
        }

        s.player.stam -= effectiveCost;
        for (let i = 0; i < abilityCard.moments; i++) {
          s.player.timeline[slot + i] =
            i === abilityCard.moments - 1
              ? { ...abilityCard, uniqueId: "basic_" + nextRandFloat(s), paidCost: effectiveCost, paidUpfront: true }
              : "occupied";
        }

        return { ok: true, events: [{ type: "PLACE_SOUND", payload: { moments: abilityCard.moments } }] };
      }

      case ActionTypes.TOGGLE_EXERT_CARD: {
        const { handIndex } = action.payload || {};
        if (s.phase !== "exert") return { ok: false, error: "Not in Exert phase." };
        const card = s.player.hand?.[handIndex];
        if (!card) return { ok: false, error: "Card not found." };
        card.selectedForExert = !card.selectedForExert;
        const selectedCount = s.player.hand.filter((c) => c.selectedForExert).length;
        return {
          ok: true,
          events: [
            { type: "EXERT_SELECTION_CHANGED", payload: { selectedCount } },
            { type: "SOUND", payload: { name: "draw" } },
          ],
        };
      }

      case ActionTypes.CONFIRM_EXERT: {
        if (s.phase !== "exert") return { ok: false, error: "Not in Exert phase." };

        const kept = [];
        let burnedCount = 0;
        for (const c of s.player.hand) {
          if (c.selectedForExert) burnedCount++;
          else kept.push(c);
          delete c.selectedForExert;
        }
        s.player.hand = kept;
        const actualStamGained = Math.min(s.player.maxStam - s.player.stam, burnedCount);
        s.player.stam += actualStamGained;

        const events = [];
        if (burnedCount > 0) {
          events.push({ type: "LOG", payload: { message: `Player burned ${burnedCount} card(s) for ${actualStamGained} Stamina.` } });
          events.push({ type: "FLOAT_TEXT", payload: { target: "player", text: `+${actualStamGained} ⚡`, cssClass: "float-heal" } });
        }

        let aiBurned = 0;
        while (s.ai.stam < 2 && s.ai.hand.length > 1 && s.ai.stam < s.ai.maxStam) {
          s.ai.hand.sort((a, b) => (b.cost || 0) - (a.cost || 0));
          s.ai.hand.shift();
          s.ai.stam += 1;
          aiBurned++;
        }
        if (aiBurned > 0) {
          events.push({ type: "LOG", payload: { message: `AI burned ${aiBurned} card(s) for Stamina.` } });
          events.push({ type: "FLOAT_TEXT", payload: { target: "ai", text: `+${aiBurned} ⚡`, cssClass: "float-heal" } });
        }

        const pDraw = Math.max(0, 2 - (s.player.statuses.drawLess || 0));
        if (pDraw > 0) {
          drawCardsPure(s, pDraw, "player");
          events.push({ type: "SOUND", payload: { name: "draw" } });
        } else if ((s.player.statuses.drawLess || 0) > 0) {
          events.push({ type: "LOG", payload: { message: "Player draws 0 cards due to being parried!" } });
        }

        const aiDraw = Math.max(0, 2 - (s.ai.statuses.drawLess || 0));
        if (aiDraw > 0) drawCardsPure(s, aiDraw, "ai");

        s.player.statuses.drawLess = 0;
        s.ai.statuses.drawLess = 0;

        s.phase = "planning";
        events.push({ type: "EXERT_CONFIRMED", payload: {} });
        events.push({ type: "AI_PLAN", payload: {} });
        return { ok: true, events };
      }

      // --- Legacy queued actions ---
      case ActionTypes.START_RESOLUTION: {
        if (typeof window._startResolutionImpl === "function") window._startResolutionImpl();
        else if (typeof window.startResolution === "function") window.startResolution();
        return { ok: true, skipUIRefresh: true };
      }
      case ActionTypes.LOCK_IN: {
        if (typeof window._lockInImpl === "function") window._lockInImpl();
        else if (typeof window.lockIn === "function") window.lockIn();
        return { ok: true, skipUIRefresh: true };
      }
      case ActionTypes.PIVOT: {
        if (typeof window._pivotImpl === "function") window._pivotImpl();
        else if (typeof window.pivot === "function") window.pivot();
        return { ok: true, skipUIRefresh: true };
      }

      default:
        return { ok: true };
    }
  }

  function installDefaultHandlers() {
    on("LOG", (e) => {
      if (typeof window.log === "function") window.log(e.payload.message);
    });
    on("SOUND", (e) => {
      if (typeof window.playSound === "function") window.playSound(e.payload.name);
    });
    on("PLACE_SOUND", (e) => {
      if (typeof window.playPlaceSound === "function") window.playPlaceSound(e.payload.moments);
    });
    on("FLOAT_TEXT", (e) => {
      if (typeof window.spawnFloatingText === "function") window.spawnFloatingText(e.payload.target, e.payload.text, e.payload.cssClass);
    });
    on("EXERT_SELECTION_CHANGED", (e) => {
      const btn = document.getElementById("btn-confirm-exert");
      if (btn) btn.innerText = `Confirm Exert (+${e.payload.selectedCount}⚡)`;
    });
    on("EXERT_CONFIRMED", () => {
      document.body.classList.remove("exert-mode");
      const exertUI = document.getElementById("exert-controls");
      if (exertUI) exertUI.style.display = "none";
      const actionUI = document.getElementById("action-controls");
      if (actionUI) actionUI.style.display = "flex";
      document.querySelectorAll("button").forEach((b) => (b.disabled = false));
    });
    on("AI_PLAN", () => {
      if (typeof window.planAI === "function") window.planAI();
      document.querySelectorAll("button").forEach((b) => (b.disabled = false));
    });
  }

  window.EngineRuntime = {
    ActionTypes,
    dispatch,
    step,
    emit,
    on,
    getEventLog: () => eventLog.slice(),
    clearEventLog: () => {
      eventLog.length = 0;
    },
    installDefaultHandlers,
    _lastResult: null,
  };
})();
