const fs = require('fs');
const vm = require('vm');

function loadCards() {
  const code = fs.readFileSync('data/cards.data.js', 'utf8');
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx.window.SS_CARDS_DATA || {};
}

function main() {
  const cards = loadCards();
  const resolution = fs.readFileSync('resolution.js', 'utf8');
  const registry = fs.readFileSync('effects_registry.js', 'utf8');

  const switchCases = [...resolution.matchAll(/case\s+'([^']+)'\s*:/g)].map((m) => m[1].toLowerCase());
  const registryCases = [...registry.matchAll(/\n\s*([a-zA-Z0-9_]+)\s*:\s*\(\{/g)].map((m) => m[1].toLowerCase());
  const handled = new Set([...switchCases, ...registryCases]);

  const used = [];
  for (const [id, card] of Object.entries(cards)) {
    if (!Array.isArray(card.effects)) continue;
    for (const fx of card.effects) {
      used.push({
        id,
        cardType: String(card.type || '').toLowerCase(),
        trigger: String(fx.trigger || '').toLowerCase(),
        effect: String(fx.type || '').toLowerCase(),
      });
    }
  }

  const missing = used.filter((u) => u.effect && !handled.has(u.effect));

  // Heuristic: grab on_hit effects should usually allow grabHit in applyEffect fallback.
  const grabOnHitEffects = [...new Set(used.filter((u) => u.cardType === 'grab' && u.trigger === 'on_hit').map((u) => u.effect))];
  const suspiciousGrabFallbacks = [];
  for (const effect of grabOnHitEffects) {
    if (registryCases.includes(effect)) continue; // registry handlers may not use context strings.
    const blockRe = new RegExp(`case\\s+'${effect}'\\s*:[\\s\\S]*?break;`, 'i');
    const block = resolution.match(blockRe)?.[0] || '';
    if (!block) continue;
    const mentionsGrabHit = /grabHit/.test(block);
    if (!mentionsGrabHit) suspiciousGrabFallbacks.push(effect);
  }

  console.log('=== Effect Audit ===');
  console.log(`Cards with effects: ${used.length}`);
  console.log(`Unique effect types: ${new Set(used.map((u) => u.effect)).size}`);
  console.log(`Missing handlers: ${missing.length}`);
  if (missing.length) {
    for (const m of missing) console.log(`  - ${m.id}: ${m.effect} (${m.trigger}, ${m.cardType})`);
  }
  console.log(`Potential grab on_hit fallback mismatches: ${suspiciousGrabFallbacks.length}`);
  if (suspiciousGrabFallbacks.length) {
    for (const e of suspiciousGrabFallbacks) console.log(`  - ${e}`);
  }

  if (missing.length || suspiciousGrabFallbacks.length) process.exitCode = 1;
}

main();
