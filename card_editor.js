// card_editor.js
// In-browser Card Lab for editing/adding cards without touching source code.

(function(){
  'use strict';

  const $ = (id) => document.getElementById(id);

    const UI = {
    overlay: () => $('card-editor-overlay'),
    list: () => $('ce-card-list'),
    search: () => $('ce-search'),
    id: () => $('ce-id'),
    name: () => $('ce-name'),
    type: () => $('ce-type'),
    cost: () => $('ce-cost'),
    moments: () => $('ce-moments'),
    dmg: () => $('ce-dmg'),
    effectTrigger: () => $('ce-effect-trigger'),
    effectType: () => $('ce-effect-type'),
    effectTarget: () => $('ce-effect-target'),
    effectValue: () => $('ce-effect-value'),
    addEffectBtn: () => $('ce-add-effect'),
    effectsList: () => $('ce-effects-list'),
    desc: () => $('ce-desc'),
    specialNotes: () => $('ce-special-notes'),
    enhDmg: () => $('ce-enhance-dmg'),
    enhTargets: () => $('ce-enhance-targets'),
    reqToken: () => $('ce-req-token'),
    reqAddAll: () => $('ce-req-add-all'),
    reqNewOr: () => $('ce-req-new-or'),
    reqOrGroup: () => $('ce-req-or-group'),
    reqAddOr: () => $('ce-req-add-or'),
    reqPreview: () => $('ce-req-preview'),
    reqAll: () => $('ce-req-all'),
    reqAny: () => $('ce-req-any'),
    status: () => $('ce-status'),
    charSelect: () => $('ce-char-select'),
    charDisplayName: () => $('ce-char-display-name'),
    charMaxHp: () => $('ce-char-max-hp'),
    charMaxStam: () => $('ce-char-max-stam'),
    charArmor: () => $('ce-char-armor'),
    charAbility1: () => $('ce-char-ability1'),
    charAbility2: () => $('ce-char-ability2'),

    filterType: () => $('ce-filter-type'),
    filterCostMin: () => $('ce-filter-cost-min'),
    filterCostMax: () => $('ce-filter-cost-max'),
    filterMomMin: () => $('ce-filter-mom-min'),
    filterMomMax: () => $('ce-filter-mom-max'),
    filterDmgMin: () => $('ce-filter-dmg-min'),
    filterDmgMax: () => $('ce-filter-dmg-max'),
    filterKeyword: () => $('ce-filter-keyword'),
    filterProf: () => $('ce-filter-prof'),
    filterCount: () => $('ce-filter-count'),

    statsSummary: () => $('ce-stats-summary'),
    statsKeywords: () => $('ce-stats-keywords'),
    graphDmg: () => $('ce-graph-dmg'),
    graphCost: () => $('ce-graph-cost'),
    graphMom: () => $('ce-graph-mom'),
    graphType: () => $('ce-graph-type')
  };

  let st = {
    open: false,
    selectedId: '',
    search: '',
    filters: {
      type: '',
      costMin: '',
      costMax: '',
      momMin: '',
      momMax: '',
      dmgMin: '',
      dmgMax: '',
      keyword: '',
      prof: ''
    },
    formEffects: [],
    reqBuilder: { all: [], any: [] }
  };

  function allEditableCards(){
    const db = window.CardsDB || {};
    return Object.values(db)
      .filter(Boolean)
      .filter(c => !c.isAbility)
      .sort((a,b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
  }

  function setStatus(msg){
    const el = UI.status();
    if (!el) return;
    el.textContent = msg || '';
  }

  
  function normalizeTriggerName(t){
    const s = String(t || '').trim().toLowerCase();
    if (s === 'upon hit' || s === 'on hit' || s === 'hit' || s === 'on_hit') return 'on_hit';
    if (s === 'upon block' || s === 'on block' || s === 'block' || s === 'on_block') return 'on_block';
    if (s === 'upon parry' || s === 'on parry' || s === 'parry' || s === 'on_parry') return 'on_parry';
    if (s === 'turn end' || s === 'on turn end' || s === 'on_turn_end') return 'on_turn_end';
    if (s === 'on resolve' || s === 'resolve' || s === 'on_resolve') return 'on_resolve';
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
      if (typeof a === 'string') {
        return { trigger, type: a.toLowerCase(), target: 'opponent', value: Math.max(1, Number(b) || 1) };
      }
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
        if (typeof entry.effect === 'object' && entry.effect.type) {
          return { trigger, type: String(entry.effect.type || '').toLowerCase(), target: String(entry.effect.target || 'opponent').toLowerCase(), value: Math.max(1, Number(entry.effect.value) || 1) };
        }
      }
    }
    return null;
  }

  function triggerLabel(key){
    const map = {
      on_hit: 'On Hit',
      on_block: 'On Block',
      on_parry: 'On Parry',
      on_blocked: 'On Blocked',
      on_parried: 'On Parried',
      on_resolve: 'On Resolve',
      on_turn_end: 'On Turn End'
    };
    return map[key] || key;
  }

  function targetLabel(key){
    const k = String(key || 'opponent').toLowerCase();
    if (k === 'self' || k === 'source') return 'Self';
    return 'Opponent';
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
      spirit_guard: 'Spirit Guard (Negate Attack/Grab in Window)'
    };
    return map[k] || String(key || '').toUpperCase();
  }

  function renderEffectsEditor(){
    const el = UI.effectsList();
    if (!el) return;
    if (!Array.isArray(st.formEffects) || !st.formEffects.length) {
      el.innerHTML = '<div class="ce-empty">No triggered effects on this card.</div>';
      return;
    }
    el.innerHTML = st.formEffects.map((fx, idx) => `
      <div class="ce-effect-pill">
        <span><b>${triggerLabel(fx.trigger)}</b> -> ${targetLabel(fx.target)}: ${effectLabel(fx.type)} ${Number(fx.value || 0)}</span>
        <button type="button" class="db-btn db-btn-danger" data-remove-effect="${idx}">x</button>
      </div>
    `).join('');

    el.querySelectorAll('button[data-remove-effect]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-remove-effect'));
        if (!Number.isFinite(idx) || idx < 0 || idx >= st.formEffects.length) return;
        st.formEffects.splice(idx, 1);
        renderEffectsEditor();
      });
    });
  }

  function populateEffectTypeOptions(){
    const el = UI.effectType();
    if (!el) return;
    const types = Object.keys(window.EffectTypeRegistry || {}).sort();
    const fallback = ['bleed', 'poison', 'freeze', 'hypnotized', 'hypnotize', 'exhausted', 'draw_less', 'draw_cards', 'spirit_guard', 'discard_random', 'consume_bleed_damage', 'consume_hypnotized_burst', 'consume_hypnotized_burst_draw'];
    const merged = [...new Set([...(types.length ? types : fallback), ...fallback])].sort();
    const current = String(el.value || '').toLowerCase();
    el.innerHTML = merged.map((t) => `<option value=\"${t}\">${effectLabel(t)}</option>`).join('');
    if (current && merged.includes(current)) el.value = current;
  }

  function loadFormEffectsFromCard(card){
    const out = [];
    const fxSource = [];
    if (Array.isArray(card?.effects)) fxSource.push(...card.effects);
    if (Array.isArray(card?.enhance?.effects)) fxSource.push(...card.enhance.effects);

    if (fxSource.length) {
      for (const rawFx of fxSource) {
        const fx = normalizeEffectEntry(rawFx);
        if (!fx || !fx.trigger || !fx.type) continue;
        out.push(fx);
      }
    }
    // Backward compatibility: if a legacy single effect exists, expose it as On Resolve.
    if (!out.length && card?.effect) {
      out.push({
        trigger: 'on_resolve',
        type: String(card.effect).toLowerCase(),
        target: 'opponent',
        value: 1
      });
    }
    st.formEffects = out;
    renderEffectsEditor();
  }
  function addCurrentEffectFromBuilder(){
    const trigger = normalizeTriggerName(UI.effectTrigger()?.value || 'on_hit');
    const type = String(UI.effectType()?.value || '').trim().toLowerCase();
    const target = String(UI.effectTarget()?.value || 'opponent').trim().toLowerCase();
    const value = Math.max(1, Number(UI.effectValue()?.value) || 1);

    if (!trigger || !type) {
      setStatus('Choose trigger and effect type before adding.');
      return;
    }

    st.formEffects.push({ trigger, type, target, value });
    renderEffectsEditor();
    setStatus('Effect added. Save card to apply.');
  }
  function parseReqList(raw){
    return String(raw || '')
      .split(',')
      .map(x => x.trim().toLowerCase())
      .filter(Boolean);
  }

  function reqTokenize(raw){
    const s = String(raw || '').toLowerCase();
    const out = [];
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (/\s/.test(ch)) { i += 1; continue; }
      if (ch === '"' || ch === "'") {
        const quote = ch;
        i += 1;
        const start = i;
        while (i < s.length && s[i] !== quote) i += 1;
        const word = s.slice(start, i).trim();
        if (word) out.push({ t: 'word', v: word });
        if (i < s.length) i += 1;
        continue;
      }
      if (ch === '(' || ch === ')') {
        out.push({ t: ch, v: ch });
        i += 1;
        continue;
      }
      if (ch === ',') {
        out.push({ t: 'and', v: 'and' });
        i += 1;
        continue;
      }
      if (ch === '|') {
        if (s[i + 1] === '|') i += 1;
        out.push({ t: 'or', v: 'or' });
        i += 1;
        continue;
      }
      if (ch === '&') {
        if (s[i + 1] === '&') i += 1;
        out.push({ t: 'and', v: 'and' });
        i += 1;
        continue;
      }
      const m = s.slice(i).match(/^[a-z0-9_-]+/);
      if (m) {
        const word = m[0];
        if (word === 'and') out.push({ t: 'and', v: 'and' });
        else if (word === 'or') out.push({ t: 'or', v: 'or' });
        else out.push({ t: 'word', v: word });
        i += word.length;
        continue;
      }
      i += 1;
    }
    return out;
  }

  function parseReqExprToDnf(raw){
    const tokens = reqTokenize(raw);
    if (!tokens.length) return [];
    let p = 0;
    const peek = () => tokens[p] || null;
    const take = (t) => {
      const tk = peek();
      if (tk && tk.t === t) { p += 1; return tk; }
      return null;
    };
    const dnfWord = (w) => [[w]];
    const dnfOr = (a, b) => [...a, ...b];
    const dnfAnd = (a, b) => {
      const out = [];
      for (const ca of a) {
        for (const cb of b) out.push([...ca, ...cb]);
      }
      return out;
    };

    function parseFactor(){
      const tk = peek();
      if (!tk) return [];
      if (take('(')) {
        const inner = parseExpr();
        take(')');
        return inner;
      }
      if (tk.t === 'word') {
        p += 1;
        return dnfWord(tk.v);
      }
      return [];
    }

    function parseTerm(){
      let left = parseFactor();
      if (!left.length) return left;
      while (true) {
        if (!take('and')) break;
        const right = parseFactor();
        if (!right.length) break;
        left = dnfAnd(left, right);
      }
      return left;
    }

    function parseExpr(){
      let left = parseTerm();
      if (!left.length) return left;
      while (true) {
        if (!take('or')) break;
        const right = parseTerm();
        if (!right.length) break;
        left = dnfOr(left, right);
      }
      return left;
    }

    const dnf = parseExpr();
    return dnf
      .map(clause => [...new Set(clause.map(x => String(x || '').trim().toLowerCase()).filter(Boolean))])
      .filter(clause => clause.length);
  }

  function reqObjectToDnf(req){
    if (!req || typeof req !== 'object') return [];
    const all = Array.isArray(req.all)
      ? [...new Set(req.all.map(x => String(x || '').toLowerCase()).filter(Boolean))]
      : [];
    const any = Array.isArray(req.any)
      ? req.any
          .map(g => Array.isArray(g?.all) ? [...new Set(g.all.map(x => String(x || '').toLowerCase()).filter(Boolean))] : [])
          .filter(g => g.length)
      : [];
    if (!all.length && !any.length) return [];
    if (!any.length) return [all];
    return any.map(g => [...new Set([...all, ...g])]);
  }

  function dnfToReqObject(dnf){
    const clauses = (dnf || [])
      .map(c => [...new Set((c || []).map(x => String(x || '').toLowerCase()).filter(Boolean))])
      .filter(c => c.length);
    if (!clauses.length) return null;
    if (clauses.length === 1) return { all: clauses[0] };

    let common = [...clauses[0]];
    for (let i = 1; i < clauses.length; i += 1) {
      const set = new Set(clauses[i]);
      common = common.filter(x => set.has(x));
      if (!common.length) break;
    }

    const reduced = clauses.map(c => c.filter(x => !common.includes(x)));
    if (reduced.some(c => c.length === 0)) {
      return common.length ? { all: common } : null;
    }

    const out = {};
    if (common.length) out.all = common;
    out.any = reduced.map(c => ({ all: c }));
    return out;
  }

  function combineReqWithAnd(aReq, bReq){
    const a = reqObjectToDnf(aReq);
    const b = reqObjectToDnf(bReq);
    if (!a.length) return dnfToReqObject(b);
    if (!b.length) return dnfToReqObject(a);
    const out = [];
    for (const ca of a) {
      for (const cb of b) out.push([...ca, ...cb]);
    }
    return dnfToReqObject(out);
  }

  function requirementsToForm(req){
    if (!req || typeof req !== 'object') return { all: '', any: '' };
    const all = Array.isArray(req.all)
      ? req.all.map(x => String(x || '').toLowerCase()).filter(Boolean).join(', ')
      : '';
    const any = Array.isArray(req.any)
      ? req.any
          .map(group => {
            const parts = Array.isArray(group?.all)
              ? group.all.map(x => String(x || '').toLowerCase()).filter(Boolean)
              : [];
            if (!parts.length) return '';
            return parts.length > 1 ? `(${parts.join(' and ')})` : parts[0];
          })
          .filter(Boolean)
          .join(' or ')
      : '';
    return { all, any };
  }

  function getRequirementUniverse(){
    const out = new Set();
    const icons = window.ProficiencyIcons || {};
    Object.keys(icons).forEach((k) => out.add(String(k).toLowerCase()));
    const cards = Object.values(window.CardsDB || {});
    for (const card of cards) {
      const req = card?.requirements;
      if (Array.isArray(req?.all)) req.all.forEach((k) => out.add(String(k).toLowerCase()));
      if (Array.isArray(req?.any)) {
        req.any.forEach((g) => {
          if (Array.isArray(g?.all)) g.all.forEach((k) => out.add(String(k).toLowerCase()));
        });
      }
    }
    return [...out].filter(Boolean).sort((a,b)=>a.localeCompare(b));
  }

  function setReqBuilderFromRequirements(req){
    const all = Array.isArray(req?.all)
      ? [...new Set(req.all.map((k) => String(k || '').toLowerCase()).filter(Boolean))]
      : [];
    const any = Array.isArray(req?.any)
      ? req.any
          .map((g) => Array.isArray(g?.all) ? [...new Set(g.all.map((k) => String(k || '').toLowerCase()).filter(Boolean))] : [])
          .filter((g) => g.length)
      : [];
    st.reqBuilder = { all, any };
  }

  function reqBuilderToRequirements(){
    const all = [...new Set((st.reqBuilder?.all || []).map((k) => String(k || '').toLowerCase()).filter(Boolean))];
    const any = (st.reqBuilder?.any || [])
      .map((g) => [...new Set((g || []).map((k) => String(k || '').toLowerCase()).filter(Boolean))])
      .filter((g) => g.length)
      .map((g) => ({ all: g }));
    if (!all.length && !any.length) return null;
    const out = {};
    if (all.length) out.all = all;
    if (any.length) out.any = any;
    return out;
  }

  function syncReqHiddenInputsFromBuilder(){
    if (UI.reqAll()) UI.reqAll().value = (st.reqBuilder?.all || []).join(', ');
    if (UI.reqAny()) {
      const groups = (st.reqBuilder?.any || []).map((g) => (g.length > 1 ? `(${g.join(' and ')})` : g[0] || '')).filter(Boolean);
      UI.reqAny().value = groups.join(' or ');
    }
  }

  function renderReqBuilder(){
    const tokenEl = UI.reqToken();
    const orGroupEl = UI.reqOrGroup();
    const previewEl = UI.reqPreview();
    if (!tokenEl || !orGroupEl || !previewEl) return;

    const tokens = getRequirementUniverse();
    const currentToken = String(tokenEl.value || '');
    tokenEl.innerHTML = tokens.map((t) => `<option value="${t}">${t}</option>`).join('');
    if (currentToken && tokens.includes(currentToken)) tokenEl.value = currentToken;

    const groups = st.reqBuilder?.any || [];
    orGroupEl.innerHTML = groups.map((_, idx) => `<option value="${idx}">OR Group ${idx + 1}</option>`).join('');
    if (!groups.length) orGroupEl.innerHTML = '<option value="">No OR groups</option>';

    const allChips = (st.reqBuilder?.all || []).map((k, idx) =>
      `<span class="ce-chip ce-req-chip">ALL: ${k} <button type="button" data-req-remove="all" data-idx="${idx}">x</button></span>`
    ).join('');

    const anyChips = groups.map((g, gi) => {
      const chips = g.map((k, ki) =>
        `<span class="ce-chip ce-req-chip">OR${gi + 1}: ${k} <button type="button" data-req-remove="or" data-group="${gi}" data-idx="${ki}">x</button></span>`
      ).join('');
      return chips;
    }).join('');

    previewEl.innerHTML = allChips + anyChips || '<div class="ce-empty">No requirements.</div>';

    previewEl.querySelectorAll('button[data-req-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = String(btn.getAttribute('data-req-remove') || '');
        const idx = Number(btn.getAttribute('data-idx'));
        if (mode === 'all') {
          if (Number.isFinite(idx) && idx >= 0 && idx < st.reqBuilder.all.length) st.reqBuilder.all.splice(idx, 1);
        } else if (mode === 'or') {
          const gi = Number(btn.getAttribute('data-group'));
          if (!Number.isFinite(gi) || gi < 0 || gi >= st.reqBuilder.any.length) return;
          if (Number.isFinite(idx) && idx >= 0 && idx < st.reqBuilder.any[gi].length) st.reqBuilder.any[gi].splice(idx, 1);
          st.reqBuilder.any = st.reqBuilder.any.filter((g) => g.length);
        }
        syncReqHiddenInputsFromBuilder();
        renderReqBuilder();
      });
    });
  }

  function requirementsFromForm(){
    const fromBuilder = reqBuilderToRequirements();
    if (fromBuilder) return fromBuilder;

    const allRaw = String(UI.reqAll()?.value || '').trim();
    const anyRaw = String(UI.reqAny()?.value || '').trim();

    let allReq = null;
    if (allRaw) {
      const hasLogicAll = /(\(|\)|\bor\b|\band\b|\|\||&&|\|)/i.test(allRaw);
      allReq = hasLogicAll ? dnfToReqObject(parseReqExprToDnf(allRaw)) : { all: parseReqList(allRaw) };
    }
    let anyReq = null;

    if (anyRaw) {
      const hasLogic = /(\(|\)|\bor\b|\band\b|\|\||&&|\|)/i.test(anyRaw);
      if (hasLogic) {
        anyReq = dnfToReqObject(parseReqExprToDnf(anyRaw));
      } else {
        const groups = anyRaw
          .split('|')
          .map(chunk => parseReqList(chunk))
          .filter(arr => arr.length)
          .map(arr => ({ all: arr }));
        if (groups.length) anyReq = { any: groups };
      }
    }

    return combineReqWithAnd(allReq, anyReq);
  }

  function fillForm(card){
    if (!card) return;
    UI.id().value = card.id || '';
    UI.name().value = card.name || '';
    UI.type().value = card.type || 'attack';
    UI.cost().value = Number(card.cost || 0);
    UI.moments().value = Number(card.moments || 0);
    UI.dmg().value = Number(card.dmg || 0);
    UI.desc().value = card.desc || '';
    if (UI.specialNotes()) UI.specialNotes().value = card.specialNotes || card.specialDesc || '';
    populateEffectTypeOptions();
    loadFormEffectsFromCard(card);
    UI.enhDmg().value = Number(card?.enhance?.dmg || 0);
    const firstTarget = Array.isArray(card?.enhance?.targets) && card.enhance.targets.length ? String(card.enhance.targets[0]).toLowerCase() : 'any';
    if (UI.enhTargets()) UI.enhTargets().value = firstTarget;
    setReqBuilderFromRequirements(card?.requirements);
    syncReqHiddenInputsFromBuilder();
    renderReqBuilder();
    setStatus(window.isCustomCard && window.isCustomCard(card.id) ? 'Custom override: ON' : 'Built-in card');
  }

  function readForm(){
    const id = String(UI.id().value || '').trim();
    if (!id) return null;

    const type = String(UI.type().value || 'attack');
    const out = {
      id,
      name: String(UI.name().value || id).trim(),
      type,
      cost: Math.max(0, Number(UI.cost().value) || 0),
      moments: Math.max(0, Number(UI.moments().value) || 0),
      dmg: Math.max(0, Number(UI.dmg().value) || 0),
      desc: String(UI.desc().value || '').trim(),
    };

    const specialNotes = String(UI.specialNotes()?.value || '').trim();
    if (specialNotes) out.specialNotes = specialNotes;

    const normalizedEffects = Array.isArray(st.formEffects) && st.formEffects.length
      ? st.formEffects.map((fx) => ({
          trigger: normalizeTriggerName(fx.trigger),
          type: String(fx.type || '').toLowerCase(),
          target: String(fx.target || 'opponent').toLowerCase(),
          value: Math.max(1, Number(fx.value) || 1)
        }))
      : [];

    if (normalizedEffects.length && type !== 'enhancer') out.effects = normalizedEffects;

    const req = requirementsFromForm();
    if (req) out.requirements = req;

    if (type === 'enhancer') {
      out.moments = 0;
      const enhDmg = Math.max(0, Number(UI.enhDmg().value) || 0);
      const enhTarget = String(UI.enhTargets()?.value || 'any').toLowerCase();
      out.enhance = { dmg: enhDmg };
      if (enhTarget && enhTarget !== 'any') out.enhance.targets = [enhTarget];
      if (normalizedEffects.length) out.enhance.effects = normalizedEffects;
      if (out.effects) delete out.effects;
      out.dmg = 0;
    }

    return out;
  }
  function getCustomCardsMap(){
    if (typeof window.loadCustomCardsMap === 'function') return window.loadCustomCardsMap() || {};
    return {};
  }

  function getCustomDecksMap(){
    // Mirrors data.js storage key; used only for local export convenience.
    try {
      const raw = localStorage.getItem('ss_custom_decks_v1');
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      return parsed;
    } catch (e) {
      return {};
    }
  }
  function downloadText(filename, text, mimeType){
    const blob = new Blob([text], { type: mimeType || 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  
  function getMergedCardsMap(){
    const db = window.CardsDB || {};
    const out = {};
    for (const id of Object.keys(db).sort()) out[id] = db[id];
    return out;
  }

  function getMergedDecksMap(){
    const out = {};
    const base = window.DecksDB || {};
    for (const id of Object.keys(base).sort()) out[id] = base[id];

    const custom = getCustomDecksMap();
    for (const id of Object.keys(custom).sort()) out[id] = custom[id];

    return out;
  }

  function getMergedCharactersBundle(){
    return {
      characters: window.CharactersDB || {},
      images: window.charImages || {},
      proficiencyIcons: window.ProficiencyIcons || {}
    };
  }
  function toCardsDataFileText(cardsMap){
    return [
      '// data/cards.data.js',
      '(function(){',
      '  window.SS_CARDS_DATA = ' + JSON.stringify(cardsMap, null, 2) + ';',
      '})();',
      ''
    ].join('\n');
  }
  function toDecksDataFileText(decksMap){
    return [
      '// data/decks.data.js',
      '(function(){',
      '  window.SS_DECKS_DATA = ' + JSON.stringify(decksMap, null, 2) + ';',
      '})();',
      ''
    ].join('\n');
  }

  function toCharactersDataFileText(charactersMap, imagesMap, proficiencyIconsMap){
    return [
      '// data/characters.data.js',
      '(function(){',
      '  window.SS_CHARACTERS_DATA = ' + JSON.stringify(charactersMap, null, 2) + ';',
      '',
      '  window.SS_CHAR_IMAGES = ' + JSON.stringify(imagesMap, null, 2) + ';',
      '',
      '  window.SS_PROFICIENCY_ICONS = ' + JSON.stringify(proficiencyIconsMap, null, 2) + ';',
      '})();',
      ''
    ].join('\n');
  }
  function toCardsSnippetText(customMap){
    const ids = Object.keys(customMap || {}).sort();
    if (!ids.length) return '// No custom cards to export.';

    const lines = [];
    lines.push('// Paste inside window.SS_CARDS_DATA in data/cards.data.js:');
    for (const id of ids) {
      lines.push(`    ${JSON.stringify(id)}: ${JSON.stringify(customMap[id])},`);
    }
    return lines.join('\n');
  }

  function getRequirementTokens(card){
    const req = card?.requirements;
    const tokens = [];
    if (!req) return tokens;

    if (Array.isArray(req.all)) {
      for (const p of req.all) tokens.push(String(p).toLowerCase());
    }
    if (Array.isArray(req.any)) {
      for (const group of req.any) {
        for (const p of (group?.all || [])) tokens.push(String(p).toLowerCase());
      }
    }
    return [...new Set(tokens)];
  }

  function parseProfFilter(raw){
    return String(raw || '')
      .split(',')
      .map(x => x.trim().toLowerCase())
      .filter(Boolean);
  }

  function numOrNull(v){
    const t = String(v ?? '').trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  function cardMatchesSearch(card, q){
    if (!q) return true;
    const fxText = Array.isArray(card.effects)
      ? card.effects
          .map((fx) =>
            String((fx && fx.trigger) || '') + ' ' +
            String((fx && fx.type) || '') + ' ' +
            String((fx && fx.target) || '') + ' ' +
            String((fx && fx.value) || '')
          )
          .join(' ')
      : '';
    const hay = (
      String(card.id || '') + ' ' +
      String(card.name || '') + ' ' +
      String(card.type || '') + ' ' +
      String(card.desc || '') + ' ' +
      fxText
    ).toLowerCase();
    return hay.includes(q);
  }

  function getCardEffectList(card){
    const out = [];
    if (Array.isArray(card?.effects)) out.push(...card.effects);
    if (Array.isArray(card?.enhance?.effects)) out.push(...card.enhance.effects);
    return out;
  }

  function filterCards(cards){
    const q = String(st.search || '').trim().toLowerCase();
    const f = st.filters;

    const type = String(f.type || '').trim().toLowerCase();
    const costMin = numOrNull(f.costMin);
    const costMax = numOrNull(f.costMax);
    const momMin = numOrNull(f.momMin);
    const momMax = numOrNull(f.momMax);
    const dmgMin = numOrNull(f.dmgMin);
    const dmgMax = numOrNull(f.dmgMax);
    const keyword = String(f.keyword || '').trim().toLowerCase();
    const profNeed = parseProfFilter(f.prof);

    return cards.filter(card => {
      if (!cardMatchesSearch(card, q)) return false;
      if (type && String(card.type || '').toLowerCase() !== type) return false;

      const cost = Number(card.cost || 0);
      const mom = Number(card.moments || 0);
      const dmg = Number(card.dmg || 0);

      if (costMin !== null && cost < costMin) return false;
      if (costMax !== null && cost > costMax) return false;
      if (momMin !== null && mom < momMin) return false;
      if (momMax !== null && mom > momMax) return false;
      if (dmgMin !== null && dmg < dmgMin) return false;
      if (dmgMax !== null && dmg > dmgMax) return false;
      if (keyword) {
        const allFx = getCardEffectList(card);
        const fxText = allFx.length ? allFx.map((fx) => String((fx && fx.trigger) || '') + ' ' + String((fx && fx.type) || '') + ' ' + String((fx && fx.target) || '') + ' ' + String((fx && fx.value) || '')).join(' ') : '';
        const text = (String(card.desc || '') + ' ' + fxText + ' ' + String(card.name || '')).toLowerCase();
        if (!text.includes(keyword)) return false;
      }

      if (profNeed.length) {
        const prof = getRequirementTokens(card);
        for (const p of profNeed) {
          if (!prof.includes(p)) return false;
        }
      }

      return true;
    });
  }

  function meanStd(values){
    if (!values.length) return { mean: 0, std: 0 };
    const mean = values.reduce((a,b)=>a+b,0) / values.length;
    const variance = values.reduce((a,b)=>a+((b-mean)*(b-mean)),0) / values.length;
    return { mean, std: Math.sqrt(variance) };
  }

  function median(values){
    if (!values.length) return 0;
    const s = [...values].sort((a,b)=>a-b);
    const mid = Math.floor(s.length / 2);
    if (s.length % 2 === 0) return (s[mid - 1] + s[mid]) / 2;
    return s[mid];
  }

  function freqMap(values){
    const map = new Map();
    for (const v of values) {
      const k = String(v);
      map.set(k, (map.get(k) || 0) + 1);
    }
    return map;
  }

  function extractKeywords(card){
    const out = [];
    const allFx = getCardEffectList(card);
    const fxText = allFx.length ? allFx.map((fx) => String((fx && fx.trigger) || '') + ' ' + String((fx && fx.type) || '')).join(' ') : '';
    const text = String(card.desc || '') + ' ' + fxText;

    const hardKeywords = ['EXHAUSTED','FREEZE','BLEED','POISON','HYPNOTIZED','PARRY','BLOCK','GRAB','ATTACK'];
    for (const kw of hardKeywords) {
      if (new RegExp(`\\b${kw}\\b`, 'i').test(text)) out.push(kw);
    }
    if (Array.isArray(card.effects)) {
      for (const e of card.effects) {
        const fx = String(e?.type || '').trim().toLowerCase();
        if (!fx) continue;
        const parts = fx.split('_').filter(x => x && !/^\d+$/.test(x));
        for (const p of parts) out.push(`fx:${p}`);
      }
    }
    return out;
  }

  function renderBars(el, map, color){
    if (!el) return;
    const entries = [...map.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }));
    const max = entries.length ? Math.max(...entries.map(e => e[1])) : 1;

    el.innerHTML = '';
    if (!entries.length) {
      el.innerHTML = '<div class="ce-empty">No data</div>';
      return;
    }

    for (const [label, count] of entries) {
      const row = document.createElement('div');
      row.className = 'ce-bar-row';
      const pct = Math.max(4, Math.round((count / max) * 100));
      row.innerHTML = `
        <div class="ce-bar-label">${label}</div>
        <div class="ce-bar-track"><div class="ce-bar-fill" style="width:${pct}%; background:${color};"></div></div>
        <div class="ce-bar-value">${count}</div>
      `;
      el.appendChild(row);
    }
  }

  function renderStats(filtered){
    const summary = UI.statsSummary();
    const keywordsEl = UI.statsKeywords();

    const costs = filtered.map(c => Number(c.cost || 0));
    const moms = filtered.map(c => Number(c.moments || 0));
    const dmgs = filtered.map(c => Number(c.dmg || 0));

    const sCost = meanStd(costs);
    const sMom = meanStd(moms);
    const sDmg = meanStd(dmgs);
    const mDmg = median(dmgs);
    const mCost = median(costs);
    const mMom = median(moms);

    if (summary) {
      summary.innerHTML = `
        <div class="ce-stat"><span>Cards</span><b>${filtered.length}</b></div>
        <div class="ce-stat"><span>DMG Mean</span><b>${sDmg.mean.toFixed(2)}</b></div>
        <div class="ce-stat"><span>DMG Std</span><b>${sDmg.std.toFixed(2)}</b></div>
        <div class="ce-stat"><span>DMG Median</span><b>${mDmg.toFixed(2)}</b></div>
        <div class="ce-stat"><span>Cost Mean</span><b>${sCost.mean.toFixed(2)}</b></div>
        <div class="ce-stat"><span>Cost Std</span><b>${sCost.std.toFixed(2)}</b></div>
        <div class="ce-stat"><span>Cost Median</span><b>${mCost.toFixed(2)}</b></div>
        <div class="ce-stat"><span>Mom Mean</span><b>${sMom.mean.toFixed(2)}</b></div>
        <div class="ce-stat"><span>Mom Std</span><b>${sMom.std.toFixed(2)}</b></div>
        <div class="ce-stat"><span>Mom Median</span><b>${mMom.toFixed(2)}</b></div>
      `;
    }

    const kw = [];
    for (const c of filtered) kw.push(...extractKeywords(c));
    const kwMap = [...freqMap(kw).entries()].sort((a,b)=>b[1]-a[1]).slice(0, 20);

    if (keywordsEl) {
      if (!kwMap.length) {
        keywordsEl.innerHTML = '<div class="ce-empty">No keyword signals in this filter.</div>';
      } else {
        keywordsEl.innerHTML = kwMap.map(([k,v]) => `<span class="ce-chip">${k} (${v})</span>`).join('');
      }
    }

    renderBars(UI.graphDmg(), freqMap(dmgs), 'linear-gradient(90deg,#ff7b7b,#ff4f6d)');
    renderBars(UI.graphCost(), freqMap(costs), 'linear-gradient(90deg,#6be59b,#2ecc71)');
    renderBars(UI.graphMom(), freqMap(moms), 'linear-gradient(90deg,#8cb9ff,#4facfe)');
    renderBars(UI.graphType(), freqMap(filtered.map(c => String(c.type || 'unknown').toLowerCase())), 'linear-gradient(90deg,#f6cf70,#f1c40f)');
  }

  function renderList(filtered){
    const wrap = UI.list();
    if (!wrap) return;

    wrap.innerHTML = '';
    for (const c of filtered) {
      const row = document.createElement('button');
      row.className = 'db-card-row';
      row.style.width = '100%';
      row.style.textAlign = 'left';
      row.style.cursor = 'pointer';
      row.style.background = (st.selectedId === c.id) ? 'rgba(79,172,254,0.18)' : 'rgba(255,255,255,0.03)';

      const isCustom = window.isCustomCard && window.isCustomCard(c.id);
      const req = getRequirementTokens(c).join(', ');
      row.innerHTML = `
        <div class="db-card-info">
          <div class="db-card-title">${c.name} ${isCustom ? '<span style="color:#4facfe;">(Custom)</span>' : ''}</div>
          <div class="db-card-meta">${c.id} | ${String(c.type || '').toUpperCase()} | ${c.cost || 0} ST | ${c.moments || 0} MOM | ${c.dmg || 0} DMG</div>
          ${req ? `<div class="db-card-desc">Req: ${req}</div>` : ''}
        </div>
      `;

      row.onclick = () => {
        st.selectedId = c.id;
        fillForm(c);
        renderAll();
      };

      wrap.appendChild(row);
    }

    if (!filtered.length) {
      wrap.innerHTML = '<div class="db-empty">No cards match your filters.</div>';
    }
  }

  function updateFilterStateFromUI(){
    st.search = UI.search()?.value || '';
    st.filters.type = UI.filterType()?.value || '';
    st.filters.costMin = UI.filterCostMin()?.value || '';
    st.filters.costMax = UI.filterCostMax()?.value || '';
    st.filters.momMin = UI.filterMomMin()?.value || '';
    st.filters.momMax = UI.filterMomMax()?.value || '';
    st.filters.dmgMin = UI.filterDmgMin()?.value || '';
    st.filters.dmgMax = UI.filterDmgMax()?.value || '';
    st.filters.keyword = UI.filterKeyword()?.value || '';
    st.filters.prof = UI.filterProf()?.value || '';
  }

  function clearFilters(){
    st.search = '';
    st.filters = { type:'', costMin:'', costMax:'', momMin:'', momMax:'', dmgMin:'', dmgMax:'', keyword:'', prof:'' };

    if (UI.search()) UI.search().value = '';
    if (UI.filterType()) UI.filterType().value = '';
    if (UI.filterCostMin()) UI.filterCostMin().value = '';
    if (UI.filterCostMax()) UI.filterCostMax().value = '';
    if (UI.filterMomMin()) UI.filterMomMin().value = '';
    if (UI.filterMomMax()) UI.filterMomMax().value = '';
    if (UI.filterDmgMin()) UI.filterDmgMin().value = '';
    if (UI.filterDmgMax()) UI.filterDmgMax().value = '';
    if (UI.filterKeyword()) UI.filterKeyword().value = '';
    if (UI.filterProf()) UI.filterProf().value = '';
  }

  function renderAll(){
    const all = allEditableCards();
    const filtered = filterCards(all);

    renderList(filtered);
    renderStats(filtered);

    const countEl = UI.filterCount();
    if (countEl) countEl.textContent = `${filtered.length} / ${all.length} cards`;
  }

  function getAbilityCardsForLab(){
    return Object.values(window.CardsDB || {})
      .filter(Boolean)
      .filter(c => c.isAbility)
      .sort((a,b)=> String(a.name || a.id).localeCompare(String(b.name || b.id)));
  }

  function renderCharacterLabOptions(){
    const sel = UI.charSelect();
    const a1 = UI.charAbility1();
    const a2 = UI.charAbility2();
    if (!sel || !a1 || !a2) return;

    const chars = Object.keys(window.CharactersDB || {}).sort((a,b)=>a.localeCompare(b));
    sel.innerHTML = chars.map((name) => `<option value="${name}">${name}</option>`).join('');

    const abilities = getAbilityCardsForLab();
    const abilityOptions = abilities.map((ab) => `<option value="${ab.id}">${ab.name} (${ab.id})</option>`).join('');
    a1.innerHTML = abilityOptions;
    a2.innerHTML = abilityOptions;

    if (!sel.value && chars.length) sel.value = chars[0];
    loadSelectedCharacterLab();
  }

  function loadSelectedCharacterLab(){
    const sel = UI.charSelect();
    if (!sel) return;
    const charName = String(sel.value || '').trim();
    const c = (window.CharactersDB || {})[charName] || {};
    const display = String(c.displayName || charName || '');
    const ab1 = String(c?.abilityIds?.[1] || c?.abilityIds?.['1'] || '');
    const ab2 = String(c?.abilityIds?.[2] || c?.abilityIds?.['2'] || '');
    if (UI.charDisplayName()) UI.charDisplayName().value = display;
    if (UI.charMaxHp()) UI.charMaxHp().value = Number(c.maxHp || 40);
    if (UI.charMaxStam()) UI.charMaxStam().value = Number(c.maxStam || 6);
    if (UI.charArmor()) UI.charArmor().value = Number(c.armor || 0);
    if (UI.charAbility1() && ab1) UI.charAbility1().value = ab1;
    if (UI.charAbility2() && ab2) UI.charAbility2().value = ab2;
  }

  function saveCharacterLab(){
    const sel = UI.charSelect();
    if (!sel) return;
    const charName = String(sel.value || '').trim();
    if (!charName) return;
    if (typeof window.upsertCustomCharacter !== 'function') return alert('Character editing APIs are missing.');

    const patch = {
      displayName: String(UI.charDisplayName()?.value || charName).trim(),
      maxHp: Math.max(1, Number(UI.charMaxHp()?.value) || 40),
      maxStam: Math.max(1, Number(UI.charMaxStam()?.value) || 6),
      armor: Math.max(0, Number(UI.charArmor()?.value) || 0),
      abilityIds: {
        1: String(UI.charAbility1()?.value || '').trim(),
        2: String(UI.charAbility2()?.value || '').trim()
      }
    };

    window.upsertCustomCharacter(charName, patch);
    if (typeof window.buildTCGRosters === 'function') window.buildTCGRosters();
    if (typeof window.syncSelectionAcrossViews === 'function') window.syncSelectionAcrossViews();
    setStatus(`Character saved: ${charName}`);
  }

  function resetCharacterLab(){
    const sel = UI.charSelect();
    if (!sel) return;
    const charName = String(sel.value || '').trim();
    if (!charName) return;
    if (typeof window.deleteCustomCharacter !== 'function') return;
    const ok = window.deleteCustomCharacter(charName);
    if (!ok) return alert('No custom override found for this character.');
    loadSelectedCharacterLab();
    if (typeof window.buildTCGRosters === 'function') window.buildTCGRosters();
    if (typeof window.syncSelectionAcrossViews === 'function') window.syncSelectionAcrossViews();
    setStatus(`Character override removed: ${charName}`);
  }
  function bind(){
    const overlay = UI.overlay();
    if (!overlay || overlay.dataset.bound === '1') return;
    overlay.dataset.bound = '1';

    const refresh = () => { updateFilterStateFromUI(); renderAll(); };

    UI.search()?.addEventListener('input', refresh);
    UI.filterType()?.addEventListener('change', refresh);
    UI.filterCostMin()?.addEventListener('input', refresh);
    UI.filterCostMax()?.addEventListener('input', refresh);
    UI.filterMomMin()?.addEventListener('input', refresh);
    UI.filterMomMax()?.addEventListener('input', refresh);
    UI.filterDmgMin()?.addEventListener('input', refresh);
    UI.filterDmgMax()?.addEventListener('input', refresh);
    UI.filterKeyword()?.addEventListener('input', refresh);
    UI.filterProf()?.addEventListener('input', refresh);
    UI.addEffectBtn()?.addEventListener('click', addCurrentEffectFromBuilder);
    UI.reqAddAll()?.addEventListener('click', () => {
      const token = String(UI.reqToken()?.value || '').trim().toLowerCase();
      if (!token) return;
      if (!st.reqBuilder.all.includes(token)) st.reqBuilder.all.push(token);
      syncReqHiddenInputsFromBuilder();
      renderReqBuilder();
    });
    UI.reqNewOr()?.addEventListener('click', () => {
      st.reqBuilder.any.push([]);
      syncReqHiddenInputsFromBuilder();
      renderReqBuilder();
      if (UI.reqOrGroup()) UI.reqOrGroup().value = String(Math.max(0, st.reqBuilder.any.length - 1));
    });
    UI.reqAddOr()?.addEventListener('click', () => {
      const token = String(UI.reqToken()?.value || '').trim().toLowerCase();
      if (!token) return;
      if (!st.reqBuilder.any.length) st.reqBuilder.any.push([]);
      let gi = Number(UI.reqOrGroup()?.value);
      if (!Number.isFinite(gi) || gi < 0 || gi >= st.reqBuilder.any.length) gi = 0;
      if (!st.reqBuilder.any[gi].includes(token)) st.reqBuilder.any[gi].push(token);
      syncReqHiddenInputsFromBuilder();
      renderReqBuilder();
      if (UI.reqOrGroup()) UI.reqOrGroup().value = String(gi);
    });
    UI.charSelect()?.addEventListener('change', loadSelectedCharacterLab);
    $("ce-char-save")?.addEventListener('click', saveCharacterLab);
    $("ce-char-reset")?.addEventListener('click', resetCharacterLab);

    const copyBtn = $("ce-btn-copy-snippet");
    if (copyBtn) copyBtn.textContent = 'Copy Cards Snippet';

    if (!$("ce-btn-export-cards-file")) {
      const exportJsonBtn = $("ce-btn-export-json");
      const row = exportJsonBtn?.parentElement;
      if (row) {
        const btn = document.createElement('button');
        btn.id = 'ce-btn-export-cards-file';
        btn.className = 'db-btn';
        btn.textContent = 'Export cards.data.js';
        row.appendChild(btn);
      }
    }

    if (!$('ce-btn-export-decks-file') || !$('ce-btn-export-characters-file')) {
      const exportJsonBtn = $('ce-btn-export-json');
      const row = exportJsonBtn?.parentElement;
      if (row) {
        const ensureButton = (id, label) => {
          if ($(id)) return;
          const btn = document.createElement('button');
          btn.id = id;
          btn.className = 'db-btn';
          btn.textContent = label;
          row.appendChild(btn);
        };
        ensureButton('ce-btn-export-decks-file', 'Export decks.data.js');
        ensureButton('ce-btn-export-characters-file', 'Export characters.data.js');
      }
    }
    $('ce-btn-clear-filters')?.addEventListener('click', () => {
      clearFilters();
      renderAll();
    });

    $('ce-btn-new')?.addEventListener('click', () => {
      const id = `custom_card_${Date.now()}`;
      st.selectedId = id;
      fillForm({ id, name: 'New Card', type: 'attack', cost: 1, moments: 1, dmg: 1, desc: '', effects: [] });
      setStatus('New card draft created. Save to apply.');
    });

    $('ce-btn-save')?.addEventListener('click', () => {
      const card = readForm();
      if (!card) return alert('Card id is required.');
      if (typeof window.upsertCustomCard !== 'function') return alert('Card editing APIs are missing.');
      window.upsertCustomCard(card);
      st.selectedId = card.id;
      renderAll();
      setStatus('Saved. This card now updates local gameplay data.');
    });

    $('ce-btn-delete')?.addEventListener('click', () => {
      const id = String(UI.id().value || '').trim();
      if (!id) return;
      if (typeof window.deleteCustomCard !== 'function') return;
      const ok = window.deleteCustomCard(id);
      if (!ok) return alert('No custom override found for this card.');
      const base = window.CardsDB?.[id] || null;
      if (base) fillForm(base);
      st.selectedId = id;
      renderAll();
      setStatus('Custom override removed (reverted to built-in if exists).');
    });

    $('ce-btn-export-json')?.addEventListener('click', () => {
      const custom = getCustomCardsMap();
      const ids = Object.keys(custom);
      if (!ids.length) return alert('No custom cards to export.');
      downloadText('card_lab_custom_cards.json', JSON.stringify(custom, null, 2));
      setStatus('Exported card_lab_custom_cards.json');
    });

    $('ce-btn-copy-snippet')?.addEventListener('click', async () => {
      const custom = getCustomCardsMap();
      const ids = Object.keys(custom);
      if (!ids.length) return alert('No custom cards to export.');
      const text = toCardsSnippetText(custom);
      try {
        await navigator.clipboard.writeText(text);
        setStatus('Cards snippet copied. Paste into data/cards.data.js and commit to GitHub.');
      } catch (e) {
        alert('Clipboard blocked. Use Export JSON or Export cards.data.js instead.');
      }
    });

    $("ce-btn-export-cards-file")?.addEventListener('click', () => {
      const merged = getMergedCardsMap();
      if (!Object.keys(merged).length) return alert('No cards found to export.');
      const text = toCardsDataFileText(merged);
      downloadText('cards.data.js', text, 'application/javascript');
      setStatus('Exported cards.data.js (ready for Git commit).');
    });

    $("ce-btn-export-decks-file")?.addEventListener('click', () => {
      const merged = getMergedDecksMap();
      if (!Object.keys(merged).length) return alert('No decks found to export.');
      const text = toDecksDataFileText(merged);
      downloadText('decks.data.js', text, 'application/javascript');
      setStatus('Exported decks.data.js (ready for Git commit).');
    });

    $("ce-btn-export-characters-file")?.addEventListener('click', () => {
      const bundle = getMergedCharactersBundle();
      if (!Object.keys(bundle.characters).length) return alert('No characters found to export.');
      const text = toCharactersDataFileText(bundle.characters, bundle.images, bundle.proficiencyIcons);
      downloadText('characters.data.js', text, 'application/javascript');
      setStatus('Exported characters.data.js (ready for Git commit).');
    });
    $("ce-btn-close")?.addEventListener('click', () => closeCardEditor());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeCardEditor(); });
  }

  function openCardEditor(){
    bind();
    populateEffectTypeOptions();
    
    st.open = true;
    clearFilters();
    UI.overlay().style.display = 'flex';

    const first = allEditableCards()[0] || null;
    if (first) {
      st.selectedId = first.id;
      fillForm(first);
    }
    renderAll();
  }

  function closeCardEditor(){
    st.open = false;
    if (UI.overlay()) UI.overlay().style.display = 'none';
  }

  window.openCardEditor = openCardEditor;
  window.closeCardEditor = closeCardEditor;
})();











