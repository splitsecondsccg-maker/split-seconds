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
    },
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
