// effects_registry.js
//
// Goal: Replace the giant applyEffect switch over time with a clean registry.
// This first pass moves a few effects into a data-driven map, while keeping the
// rest of the switch as a fallback so gameplay/UX remain unchanged.

(function () {
  "use strict";

  /**
   * @param {{state:any, sourceKey:'player'|'ai', targetKey:'player'|'ai', context:any, api:any}} args
   */
  const EffectsRegistry = {
    heal_1_on_hit: ({ state, sourceKey, context, api }) => {
      if (context.hitLanded || context.grabHit) {
        const source = state[sourceKey];
        source.hp = Math.min(source.maxHp, source.hp + 1);
        api.log(`${sourceKey} heals 1!`);
        api.float(sourceKey, "+1", "float-heal");
        api.sound("heal");
      }
    },

    freeze_1_on_hit: ({ sourceKey, targetKey, context }) => {
      if (context.hitLanded) {
        if (typeof window.applyFreezeCounters === "function") {
          window.applyFreezeCounters(sourceKey, targetKey, 1);
        }
      }
    },

    sunder: ({ state, sourceKey, targetKey, api }) => {
      const target = state[targetKey];
      target.statuses.armorDebuff += 2;
      api.log(`${targetKey}'s armor is SUNDERED!`);
      state[sourceKey].roundData.appliedStatus = true;
    }
  };

  // New (decoupled) effect-type registry:
  // Used by card.effects = [{ trigger, type, value }]
  const EffectTypeRegistry = {
    bleed: ({ sourceKey, targetKey, value }) => {
      if (typeof window.applyBleedCounters === "function") {
        window.applyBleedCounters(sourceKey, targetKey, value);
      }
    },
    poison: ({ sourceKey, targetKey, value }) => {
      if (typeof window.applyPoisonCounters === "function") {
        window.applyPoisonCounters(sourceKey, targetKey, value);
      }
    },
    freeze: ({ sourceKey, targetKey, value }) => {
      if (typeof window.applyFreezeCounters === "function") {
        window.applyFreezeCounters(sourceKey, targetKey, value);
      }
    },
    exhausted: ({ sourceKey, targetKey, context }) => {
      // Non-stackable. Intended to be applied on hit or on block (NOT on parry).
      if (context && context.parried) return;
      if (typeof window.applyExhaustedStatus === "function") {
        window.applyExhaustedStatus(sourceKey, targetKey);
      }
    },
    hypnotized: ({ sourceKey, targetKey }) => {
      if (typeof window.applyHypnotizedStatus === "function") {
        window.applyHypnotizedStatus(sourceKey, targetKey);
      }
    },
    hypnotize: ({ sourceKey, targetKey }) => {
      if (typeof window.applyHypnotizedStatus === "function") {
        window.applyHypnotizedStatus(sourceKey, targetKey);
      }
    },
    draw_less: ({ targetKey, value }) => {
      if (!window.state || !window.state[targetKey]) return;
      const target = window.state[targetKey];
      target.statuses.drawLess = Math.max(target.statuses.drawLess || 0, Number(value) || 1);
    },
    draw_cards: ({ sourceKey, value }) => {
      const amount = Math.max(1, Number(value) || 1);
      if (typeof window.drawCards === "function") {
        window.drawCards(amount, sourceKey);
      }
    },
    puppet_reflect_attacks: () => {
      // Resolved by resolveMoment() while the utility action is active.
    },
    blood_frenzy_draw: ({ sourceKey, targetKey, value }) => {
      const source = window.state?.[sourceKey];
      const target = window.state?.[targetKey];
      if (!source || !target) return;
      const bleed = Math.max(0, Number(target.statuses?.bleed || 0));
      if (bleed <= 0) return;
      const amount = Math.max(1, Number(value) || 1);
      if (typeof window.drawCards === "function") {
        window.drawCards(amount, sourceKey);
      }
      if (typeof window.log === "function") {
        window.log(`${sourceKey === "player" ? "Player" : "AI"} Blood Frenzy draws ${amount}.`);
      }
    },
    mind_meltdown: ({ sourceKey, targetKey, value }) => {
      if (typeof window.consumeHypnotized !== "function") return;
      const consumed = window.consumeHypnotized(targetKey, sourceKey, "Mind Meltdown");
      if (!consumed) return;

      const bonus = Math.max(1, Number(value) || 1);
      const target = window.state?.[targetKey];
      if (!target) return;
      target.hp -= bonus;
      target.roundData.lostLife = true;
      target.statuses.drawLess = Math.max(target.statuses.drawLess || 0, 1);

      if (typeof window.clearHypnotizedOnLifeLoss === "function") {
        window.clearHypnotizedOnLifeLoss(targetKey, "life loss");
      }
      if (typeof window.spawnFloatingText === "function") {
        window.spawnFloatingText(targetKey, `-${bonus}`, "float-dmg");
        window.spawnFloatingText(targetKey, "DRAW -1", "float-block");
      }
      if (typeof window.log === "function") {
        window.log(`${sourceKey === "player" ? "Player" : "AI"} Mind Meltdown deals ${bonus} and applies draw -1 next turn.`);
      }
    },
    discard_random: ({ targetKey, value, context }) => {
      if (!(context && (context.hitLanded || context.grabHit))) return;
      const n = Math.max(1, Number(value) || 1);
      const target = window.state?.[targetKey];
      if (!target || !Array.isArray(target.hand) || !target.hand.length) return;
      let removed = 0;
      for (let i = 0; i < n && target.hand.length > 0; i++) {
        const idx = Math.floor(Math.random() * target.hand.length);
        target.hand.splice(idx, 1);
        removed += 1;
      }
      if (removed > 0 && typeof window.log === "function") {
        const side = targetKey === "player" ? "Player" : "AI";
        window.log(`${side} discards ${removed} card${removed > 1 ? "s" : ""} at random.`);
      }
    },
    consume_bleed_damage: ({ sourceKey, targetKey, value, context }) => {
      if (!(context && (context.hitLanded || context.grabHit))) return;
      const target = window.state?.[targetKey];
      if (!target) return;
      const stacks = Math.max(0, Number(target.statuses?.bleed || 0));
      if (stacks <= 0) return;
      const bonus = stacks * Math.max(1, Number(value) || 1);
      target.statuses.bleed = 0;
      target.hp -= bonus;
      target.roundData.lostLife = true;
      if (typeof window.clearHypnotizedOnLifeLoss === "function") {
        window.clearHypnotizedOnLifeLoss(targetKey, "life loss");
      }
      if (typeof window.spawnFloatingText === "function") {
        window.spawnFloatingText(targetKey, `-${bonus}`, "float-dmg");
      }
      if (typeof window.log === "function") {
        window.log(`${sourceKey} cashes out BLEED for ${bonus} extra DMG.`);
      }
    },
    consume_hypnotized_burst: ({ sourceKey, targetKey, value, context }) => {
      if (!(context && (context.hitLanded || context.grabHit))) return;
      if (typeof window.consumeHypnotized !== "function") return;
      const consumed = window.consumeHypnotized(targetKey, sourceKey, "burst", { allowPostHitConsume: true });
      if (!consumed) return;
      const bonus = Math.max(1, Number(value) || 1);
      const target = window.state?.[targetKey];
      if (!target) return;
      target.hp -= bonus;
      target.roundData.lostLife = true;
      if (typeof window.clearHypnotizedOnLifeLoss === "function") {
        window.clearHypnotizedOnLifeLoss(targetKey, "life loss");
      }
      if (typeof window.spawnFloatingText === "function") {
        window.spawnFloatingText(targetKey, `-${bonus}`, "float-dmg");
      }
      if (typeof window.log === "function") {
        window.log(`${sourceKey} consumes HYPNOTIZED for +${bonus} DMG.`);
      }
    },
    consume_hypnotized_burst_draw: ({ sourceKey, targetKey, value, context }) => {
      if (!(context && (context.hitLanded || context.grabHit))) return;
      if (typeof window.consumeHypnotized !== "function") return;
      const consumed = window.consumeHypnotized(targetKey, sourceKey, "burst draw", { allowPostHitConsume: true });
      if (!consumed) return;
      const bonus = Math.max(1, Number(value) || 1);
      const target = window.state?.[targetKey];
      if (!target) return;
      target.hp -= bonus;
      target.roundData.lostLife = true;
      if (typeof window.clearHypnotizedOnLifeLoss === "function") {
        window.clearHypnotizedOnLifeLoss(targetKey, "life loss");
      }
      if (typeof window.spawnFloatingText === "function") {
        window.spawnFloatingText(targetKey, `-${bonus}`, "float-dmg");
      }
      if (typeof window.drawCards === "function") {
        window.drawCards(1, sourceKey);
      }
      if (typeof window.log === "function") {
        window.log(`${sourceKey} consumes HYPNOTIZED for +${bonus} DMG and draws 1.`);
      }
    }
  };

  function tryRunEffectType(typeKey, args) {
    const fn = EffectTypeRegistry[typeKey];
    if (!fn) return false;
    fn(args);
    return true;
  }

  function tryRunRegisteredEffect(effectKey, args) {
    const fn = EffectsRegistry[effectKey];
    if (!fn) return false;
    fn(args);
    return true;
  }

  window.EffectsRegistry = EffectsRegistry;
  window.tryRunRegisteredEffect = tryRunRegisteredEffect;
  window.EffectTypeRegistry = EffectTypeRegistry;
  window.tryRunEffectType = tryRunEffectType;
})();
