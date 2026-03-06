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
    effect: () => $('ce-effect'),
    desc: () => $('ce-desc'),
    enhDmg: () => $('ce-enhance-dmg'),
    status: () => $('ce-status'),

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
    }
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

  function fillForm(card){
    if (!card) return;
    UI.id().value = card.id || '';
    UI.name().value = card.name || '';
    UI.type().value = card.type || 'attack';
    UI.cost().value = Number(card.cost || 0);
    UI.moments().value = Number(card.moments || 0);
    UI.dmg().value = Number(card.dmg || 0);
    UI.effect().value = card.effect || '';
    UI.desc().value = card.desc || '';
    UI.enhDmg().value = Number(card?.enhance?.dmg || 0);
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
      desc: String(UI.desc().value || '').trim()
    };

    const effect = String(UI.effect().value || '').trim();
    if (effect) out.effect = effect;

    if (type === 'enhancer') {
      out.moments = 0;
      const enhDmg = Math.max(0, Number(UI.enhDmg().value) || 0);
      out.enhance = { dmg: enhDmg };
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
    const hay = `${card.id || ''} ${card.name || ''} ${card.type || ''} ${card.desc || ''} ${card.effect || ''}`.toLowerCase();
    return hay.includes(q);
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
        const text = `${card.desc || ''} ${card.effect || ''} ${card.name || ''}`.toLowerCase();
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
    const text = `${card.desc || ''} ${card.effect || ''}`;

    const hardKeywords = ['EXHAUSTED','FREEZE','BLEED','POISON','HYPNOTIZED','PARRY','BLOCK','GRAB','ATTACK'];
    for (const kw of hardKeywords) {
      if (new RegExp(`\\b${kw}\\b`, 'i').test(text)) out.push(kw);
    }

    const fx = String(card.effect || '').trim().toLowerCase();
    if (fx) {
      const parts = fx.split('_').filter(x => x && !/^\d+$/.test(x));
      for (const p of parts) out.push(`fx:${p}`);
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
      fillForm({ id, name: 'New Card', type: 'attack', cost: 1, moments: 1, dmg: 1, desc: '' });
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







