// character_lab.js
// Separate Character Lab: character stats + ability editing.

(function(){
  'use strict';

  const $ = (id) => document.getElementById(id);

  const UI = {
    overlay: () => $('character-lab-overlay'),
    close: () => $('ch-btn-close'),
    status: () => $('ch-status'),

    charSelect: () => $('ch-char-select'),
    displayName: () => $('ch-char-display-name'),
    maxHp: () => $('ch-char-max-hp'),
    maxStam: () => $('ch-char-max-stam'),
    armor: () => $('ch-char-armor'),
    ability1: () => $('ch-char-ability1'),
    ability2: () => $('ch-char-ability2'),
    saveChar: () => $('ch-char-save'),
    resetChar: () => $('ch-char-reset'),

    abilityList: () => $('ch-ability-list'),
    id: () => $('ch-id'),
    name: () => $('ch-name'),
    type: () => $('ch-type'),
    cost: () => $('ch-cost'),
    moments: () => $('ch-moments'),
    dmg: () => $('ch-dmg'),
    desc: () => $('ch-desc'),
    specialNotes: () => $('ch-special-notes'),

    effectTrigger: () => $('ch-effect-trigger'),
    effectType: () => $('ch-effect-type'),
    effectTarget: () => $('ch-effect-target'),
    effectValue: () => $('ch-effect-value'),
    addEffect: () => $('ch-add-effect'),
    effectsList: () => $('ch-effects-list'),

    saveAbility: () => $('ch-ability-save'),
    resetAbility: () => $('ch-ability-reset')
  };

  const st = {
    selectedAbilityId: '',
    effects: []
  };

  function setStatus(msg){ const el = UI.status(); if (el) el.textContent = msg || ''; }

  function normalizeTriggerName(t){
    const s = String(t || '').trim().toLowerCase();
    if (s === 'upon hit' || s === 'on hit' || s === 'hit' || s === 'on_hit') return 'on_hit';
    if (s === 'upon block' || s === 'on block' || s === 'block' || s === 'on_block') return 'on_block';
    if (s === 'upon parry' || s === 'on parry' || s === 'parry' || s === 'on_parry') return 'on_parry';
    if (s === 'turn end' || s === 'on turn end' || s === 'on_turn_end') return 'on_turn_end';
    if (s === 'on resolve' || s === 'resolve' || s === 'on_resolve') return 'on_resolve';
    if (s === 'on expire' || s === 'expire' || s === 'on_expire') return 'on_expire';
    if (s === 'on get blocked' || s === 'on_blocked' || s === 'upon being blocked') return 'on_blocked';
    if (s === 'on get parried' || s === 'on_parried' || s === 'upon being parried') return 'on_parried';
    return s.replace(/\s+/g, '_');
  }

  function normalizeEffectEntry(entry){
    if (!entry) return null;
    if (Array.isArray(entry)) {
      const [tr, a, b] = entry;
      const trigger = normalizeTriggerName(tr) || 'on_resolve';
      if (Array.isArray(a)) {
        const [type, value] = a;
        return { trigger, type: String(type || '').toLowerCase(), target: 'opponent', value: Math.max(1, Number(value) || 1) };
      }
      if (typeof a === 'string') return { trigger, type: a.toLowerCase(), target: 'opponent', value: Math.max(1, Number(b) || 1) };
      return null;
    }
    if (typeof entry === 'object') {
      const trigger = normalizeTriggerName(entry.trigger) || 'on_resolve';
      if (entry.type) return { trigger, type: String(entry.type || '').toLowerCase(), target: String(entry.target || 'opponent').toLowerCase(), value: Math.max(1, Number(entry.value) || 1) };
      if (entry.effect) {
        if (Array.isArray(entry.effect)) {
          const [type, value] = entry.effect;
          return { trigger, type: String(type || '').toLowerCase(), target: 'opponent', value: Math.max(1, Number(value) || 1) };
        }
      }
    }
    return null;
  }

  function effectLabel(key){
    const k = String(key || '').toLowerCase();
    const map = {
      draw_less: 'Draw 1 Less Next Turn',
      draw_cards: 'Draw Cards',
      gain_stam_1: 'Gain Stamina',
      gain_stam_2: 'Gain Stamina',
      freeze: 'Freeze',
      bleed: 'Bleed',
      poison: 'Poison',
      hypnotize: 'Hypnotize',
      hypnotized: 'Hypnotize',
      blood_for_blood: 'Blood for Blood',
      grabs_do_not_negate: 'Grabs Do Not Negate',
      armor_next_turn: 'Gain Armor Next Turn',
      both_players_lose_life: 'Both Players Lose Life',
      both_players_bleed: 'Both Players Gain Bleed',
      puppet_reflect_attacks: 'Reflect Enemy Attacks',
      protective_aura: 'Protective Aura (-DMG)'
    };
    return map[k] || String(key || '').toUpperCase();
  }

  function triggerLabel(key){
    const map = { on_hit:'On Hit', on_block:'On Block', on_parry:'On Parry', on_blocked:'On Blocked', on_parried:'On Parried', on_resolve:'On Resolve', on_expire:'On Expire', on_turn_end:'On Turn End' };
    return map[key] || key;
  }

  function targetLabel(key){
    const k = String(key || 'opponent').toLowerCase();
    return (k === 'self' || k === 'source') ? 'Self' : 'Opponent';
  }

  function getAbilityCards(){
    return Object.values(window.CardsDB || {})
      .filter(Boolean)
      .filter(c => c.isAbility)
      .sort((a,b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
  }

  function populateEffectTypes(){
    const el = UI.effectType();
    if (!el) return;
    const types = Object.keys(window.EffectTypeRegistry || {}).sort();
    const fallback = ['bleed', 'poison', 'freeze', 'hypnotized', 'hypnotize', 'exhausted', 'draw_less', 'draw_cards', 'blood_for_blood', 'grabs_do_not_negate', 'armor_next_turn', 'both_players_lose_life', 'both_players_bleed', 'discard_random', 'consume_bleed_damage', 'consume_hypnotized_burst', 'consume_hypnotized_burst_draw'];
    const merged = [...new Set([...(types.length ? types : fallback), ...fallback])].sort();
    const current = String(el.value || '').toLowerCase();
    el.innerHTML = merged.map((t) => `<option value="${t}">${effectLabel(t)}</option>`).join('');
    if (current && merged.includes(current)) el.value = current;
  }

  function renderEffects(){
    const el = UI.effectsList();
    if (!el) return;
    if (!st.effects.length) {
      el.innerHTML = '<div class="ce-empty">No triggered effects on this ability.</div>';
      return;
    }
    el.innerHTML = st.effects.map((fx, i) => `<div class="ce-effect-pill"><span><b>${triggerLabel(fx.trigger)}</b> -> ${targetLabel(fx.target)}: ${effectLabel(fx.type)} ${Number(fx.value || 0)}</span><button type="button" class="db-btn db-btn-danger" data-rm="${i}">x</button></div>`).join('');
    el.querySelectorAll('button[data-rm]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-rm'));
        if (!Number.isFinite(idx) || idx < 0 || idx >= st.effects.length) return;
        st.effects.splice(idx, 1);
        renderEffects();
      });
    });
  }

  function fillAbility(card){
    if (!card) return;
    st.selectedAbilityId = card.id;
    if (UI.id()) UI.id().value = card.id || '';
    if (UI.name()) UI.name().value = card.name || '';
    if (UI.type()) UI.type().value = card.type || 'utility';
    if (UI.cost()) UI.cost().value = Number(card.cost || 0);
    if (UI.moments()) UI.moments().value = Number(card.moments || 0);
    if (UI.dmg()) UI.dmg().value = Number(card.dmg || 0);
    if (UI.desc()) UI.desc().value = card.desc || '';
    if (UI.specialNotes()) UI.specialNotes().value = card.specialNotes || card.specialDesc || '';

    const source = [];
    if (Array.isArray(card.effects)) source.push(...card.effects);
    st.effects = source.map(normalizeEffectEntry).filter(Boolean);
    renderEffects();

    renderAbilityList();
    setStatus(window.isCustomCard && window.isCustomCard(card.id) ? 'Custom ability override: ON' : 'Built-in ability');
  }

  function readAbility(){
    const id = String(UI.id()?.value || '').trim();
    if (!id) return null;
    const out = {
      id,
      name: String(UI.name()?.value || id).trim(),
      type: String(UI.type()?.value || 'utility'),
      cost: Math.max(0, Number(UI.cost()?.value) || 0),
      moments: Math.max(0, Number(UI.moments()?.value) || 0),
      dmg: Math.max(0, Number(UI.dmg()?.value) || 0),
      desc: String(UI.desc()?.value || '').trim(),
      isBasic: true,
      isAbility: true
    };
    const notes = String(UI.specialNotes()?.value || '').trim();
    if (notes) out.specialNotes = notes;
    if (st.effects.length) {
      out.effects = st.effects.map((fx) => ({
        trigger: normalizeTriggerName(fx.trigger),
        type: String(fx.type || '').toLowerCase(),
        target: String(fx.target || 'opponent').toLowerCase(),
        value: Math.max(1, Number(fx.value || 1))
      }));
    }
    return out;
  }

  function renderAbilityList(){
    const wrap = UI.abilityList();
    if (!wrap) return;
    const abilities = getAbilityCards();
    wrap.innerHTML = '';
    abilities.forEach((c) => {
      const row = document.createElement('button');
      row.className = 'db-card-row';
      row.style.width = '100%';
      row.style.textAlign = 'left';
      row.style.cursor = 'pointer';
      row.style.background = (st.selectedAbilityId === c.id) ? 'rgba(79,172,254,0.18)' : 'rgba(255,255,255,0.03)';
      const isCustom = window.isCustomCard && window.isCustomCard(c.id);
      row.innerHTML = `<div class="db-card-info"><div class="db-card-title">${c.name} ${isCustom ? '<span style="color:#4facfe;">(Custom)</span>' : ''}</div><div class="db-card-meta">${c.id} | ${typeof window.getActionTypeLabel === 'function' ? window.getActionTypeLabel(c.type || '') : String(c.type || '').toUpperCase()} | ${c.cost || 0} ST | ${c.moments || 0} MOM | ${c.dmg || 0} DMG</div></div>`;
      row.onclick = () => fillAbility(c);
      wrap.appendChild(row);
    });
    if (!abilities.length) wrap.innerHTML = '<div class="db-empty">No ability cards found.</div>';
  }

  function loadCharacter(){
    const name = String(UI.charSelect()?.value || '').trim();
    const c = (window.CharactersDB || {})[name] || {};
    if (UI.displayName()) UI.displayName().value = String(c.displayName || name || '');
    if (UI.maxHp()) UI.maxHp().value = Number(c.maxHp || 40);
    if (UI.maxStam()) UI.maxStam().value = Number(c.maxStam || 6);
    if (UI.armor()) UI.armor().value = Number(c.armor || 0);
    if (UI.ability1()) UI.ability1().value = String(c?.abilityIds?.[1] || c?.abilityIds?.['1'] || '');
    if (UI.ability2()) UI.ability2().value = String(c?.abilityIds?.[2] || c?.abilityIds?.['2'] || '');
  }

  function populateCharacterControls(){
    const chars = Object.keys(window.CharactersDB || {}).sort((a,b)=>a.localeCompare(b));
    if (UI.charSelect()) UI.charSelect().innerHTML = chars.map((n) => `<option value="${n}">${n}</option>`).join('');

    const abilities = getAbilityCards();
    const options = abilities.map((ab) => `<option value="${ab.id}">${ab.name} (${ab.id})</option>`).join('');
    if (UI.ability1()) UI.ability1().innerHTML = options;
    if (UI.ability2()) UI.ability2().innerHTML = options;

    if (UI.charSelect() && !UI.charSelect().value && chars.length) UI.charSelect().value = chars[0];
    loadCharacter();
  }

  function saveCharacter(){
    const charName = String(UI.charSelect()?.value || '').trim();
    if (!charName || typeof window.upsertCustomCharacter !== 'function') return;
    const patch = {
      displayName: String(UI.displayName()?.value || charName).trim(),
      maxHp: Math.max(1, Number(UI.maxHp()?.value) || 40),
      maxStam: Math.max(1, Number(UI.maxStam()?.value) || 6),
      armor: Math.max(0, Number(UI.armor()?.value) || 0),
      abilityIds: {
        1: String(UI.ability1()?.value || '').trim(),
        2: String(UI.ability2()?.value || '').trim()
      }
    };
    window.upsertCustomCharacter(charName, patch);
    if (typeof window.buildTCGRosters === 'function') window.buildTCGRosters();
    if (typeof window.syncSelectionAcrossViews === 'function') window.syncSelectionAcrossViews();
    setStatus(`Character saved: ${charName}`);
  }

  function resetCharacter(){
    const charName = String(UI.charSelect()?.value || '').trim();
    if (!charName || typeof window.deleteCustomCharacter !== 'function') return;
    const ok = window.deleteCustomCharacter(charName);
    if (!ok) return alert('No custom override found for this character.');
    loadCharacter();
    if (typeof window.buildTCGRosters === 'function') window.buildTCGRosters();
    if (typeof window.syncSelectionAcrossViews === 'function') window.syncSelectionAcrossViews();
    setStatus(`Character override removed: ${charName}`);
  }

  function saveAbility(){
    const card = readAbility();
    if (!card) return alert('Ability id is missing.');
    if (typeof window.upsertCustomCard !== 'function') return alert('Card editing APIs are missing.');
    window.upsertCustomCard(card);
    fillAbility(window.CardsDB?.[card.id] || card);
    populateCharacterControls();
    setStatus('Ability saved.');
  }

  function resetAbility(){
    const id = String(UI.id()?.value || '').trim();
    if (!id || typeof window.deleteCustomCard !== 'function') return;
    const ok = window.deleteCustomCard(id);
    if (!ok) return alert('No custom override found for this ability.');
    fillAbility(window.CardsDB?.[id]);
    populateCharacterControls();
    setStatus('Ability override removed.');
  }

  function addEffect(){
    const trigger = normalizeTriggerName(UI.effectTrigger()?.value || 'on_hit');
    const type = String(UI.effectType()?.value || '').trim().toLowerCase();
    const target = String(UI.effectTarget()?.value || 'opponent').trim().toLowerCase();
    const value = Math.max(1, Number(UI.effectValue()?.value) || 1);
    if (!trigger || !type) return;
    st.effects.push({ trigger, type, target, value });
    renderEffects();
  }

  function bind(){
    const overlay = UI.overlay();
    if (!overlay || overlay.dataset.bound === '1') return;
    overlay.dataset.bound = '1';

    UI.close()?.addEventListener('click', closeCharacterLab);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeCharacterLab(); });

    UI.charSelect()?.addEventListener('change', loadCharacter);
    UI.saveChar()?.addEventListener('click', saveCharacter);
    UI.resetChar()?.addEventListener('click', resetCharacter);

    UI.addEffect()?.addEventListener('click', addEffect);
    UI.saveAbility()?.addEventListener('click', saveAbility);
    UI.resetAbility()?.addEventListener('click', resetAbility);
  }

  function openCharacterLab(){
    bind();
    populateEffectTypes();
    populateCharacterControls();
    renderAbilityList();
    const first = getAbilityCards()[0];
    if (first) fillAbility(first);
    if (UI.overlay()) UI.overlay().style.display = 'flex';
  }

  function closeCharacterLab(){
    if (UI.overlay()) UI.overlay().style.display = 'none';
  }

  window.openCharacterLab = openCharacterLab;
  window.closeCharacterLab = closeCharacterLab;
})();

