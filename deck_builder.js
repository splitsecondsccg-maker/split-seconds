// deck_builder.js
//
// Lightweight in-browser Deck Builder.
// - Custom decks are stored in localStorage via data.js helpers.
// - Designed to be non-invasive: only available on character select screen.

(function(){
  'use strict';

  const $ = (id) => document.getElementById(id);

  const UI = {
    overlay: () => $('deck-builder-overlay'),
    charSel:  () => $('db-character'),
    loadSel:  () => $('db-load-deck'),
    nameIn:   () => $('db-deck-name'),
    searchIn: () => $('db-search'),
    typeSel:  () => $('db-type-filter'),
    cardList: () => $('db-card-list'),
    deckList: () => $('db-deck-list'),
    total:    () => $('db-total'),
    meta:     () => $('db-summary-meta'),
    saveBtn:  () => $('db-save'),
    delBtn:   () => $('db-delete'),
    dupBtn:   () => $('db-duplicate'),
  };

  const DEFAULT_DECK_SIZE_HINT = 20; // soft hint only

  /** @type {{open:boolean, charName:string|null, loadedDeckId:string|null, workingName:string, workingDesc:string, cardCounts:Record<string, number>, search:string, typeFilter:string}} */
  let st = {
    open: false,
    charName: null,
    loadedDeckId: null,
    workingName: '',
    workingDesc: '',
    cardCounts: {},
    search: '',
    typeFilter: ''
  };

  function safeCharacterList(){
    if (typeof window.getCharacterList === 'function') return window.getCharacterList();
    return Object.keys(window.classData || window.CharactersDB || {});
  }

  function safeDeckDefsForCharacter(charName){
    if (typeof window.getDecksForCharacter === 'function') return window.getDecksForCharacter(charName) || [];
    // fallback: use built-in deckIds
    const ids = window.classData?.[charName]?.deckIds || [];
    return ids.map(id => window.DecksDB?.[id]).filter(Boolean);
  }

  function isCustom(deckId){
    return typeof window.isCustomDeckId === 'function' ? window.isCustomDeckId(deckId) : (String(deckId||'').startsWith('custom_'));
  }

  function buildCountsFromDeckDef(def){
    const counts = {};
    for(const e of (def?.cards || [])){
      const cid = String(e.cardId || '');
      const n = Math.max(0, Number(e.copies) || 0);
      if(!cid || n <= 0) continue;
      counts[cid] = (counts[cid] || 0) + n;
    }
    return counts;
  }

  function toDeckEntriesFromCounts(counts){
    const entries = [];
    for(const [cardId, copies] of Object.entries(counts || {})){
      const n = Math.max(0, Number(copies) || 0);
      if(n <= 0) continue;
      entries.push({ cardId, copies: n });
    }
    // stable ordering: by card name
    entries.sort((a,b) => {
      const an = window.CardsDB?.[a.cardId]?.name || a.cardId;
      const bn = window.CardsDB?.[b.cardId]?.name || b.cardId;
      return String(an).localeCompare(String(bn));
    });
    return entries;
  }

  function totalCards(counts){
    let t = 0;
    for(const v of Object.values(counts||{})) t += Math.max(0, Number(v) || 0);
    return t;
  }

  function ensureUIBound(){
    const overlay = UI.overlay();
    if(!overlay) return;

    // only bind once
    if(overlay.dataset.bound === '1') return;
    overlay.dataset.bound = '1';

    UI.charSel()?.addEventListener('change', () => {
      st.charName = UI.charSel().value;
      loadDeckOptions();
      loadDeckIntoBuilder(getDefaultDeckIdForChar(st.charName));
      renderAll();
    });

    UI.loadSel()?.addEventListener('change', () => {
      const id = UI.loadSel().value || '';
      loadDeckIntoBuilder(id);
      renderAll();
    });

    UI.nameIn()?.addEventListener('input', () => {
      st.workingName = UI.nameIn().value;
      renderSummary();
    });

    UI.searchIn()?.addEventListener('input', () => {
      st.search = UI.searchIn().value || '';
      renderCardList();
    });

    UI.typeSel()?.addEventListener('change', () => {
      st.typeFilter = UI.typeSel().value || '';
      renderCardList();
    });

    UI.saveBtn()?.addEventListener('click', () => onSave());
    UI.delBtn()?.addEventListener('click', () => onDelete());
    UI.dupBtn()?.addEventListener('click', () => onDuplicate());

    // click outside to close
    overlay.addEventListener('click', (e) => {
      if(e.target === overlay) closeDeckBuilder();
    });

    // esc to close
    window.addEventListener('keydown', (e) => {
      if(!st.open) return;
      if(e.key === 'Escape') closeDeckBuilder();
    });
  }

  function getDefaultDeckIdForChar(charName){
    if(typeof window.getDefaultDeckIdForCharacter === 'function') return window.getDefaultDeckIdForCharacter(charName);
    return window.classData?.[charName]?.deckIds?.[0] || null;
  }

  function loadCharacterOptions(){
    const sel = UI.charSel();
    if(!sel) return;
    sel.innerHTML = '';
    for(const name of safeCharacterList()){
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    }
  }

  function loadDeckOptions(){
    const sel = UI.loadSel();
    if(!sel) return;
    sel.innerHTML = '';

    const decks = safeDeckDefsForCharacter(st.charName);

    // A blank option is useful when creating from scratch
    const optBlank = document.createElement('option');
    optBlank.value = '';
    optBlank.textContent = '— New deck (empty) —';
    sel.appendChild(optBlank);

    for(const d of decks){
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.name + (isCustom(d.id) ? ' (Custom)' : '');
      sel.appendChild(opt);
    }

    // Keep selection if possible
    const want = st.loadedDeckId;
    if(want && [...sel.options].some(o => o.value === want)) sel.value = want;
    else sel.value = '';
  }

  function loadDeckIntoBuilder(deckId){
    st.loadedDeckId = deckId || '';

    if(!deckId){
      st.cardCounts = {};
      st.workingName = '';
      st.workingDesc = '';
      if(UI.nameIn()) UI.nameIn().value = st.workingName;
      return;
    }

    const def = (typeof window.getDeckDef === 'function') ? window.getDeckDef(deckId) : (window.DecksDB?.[deckId] || null);
    if(!def){
      st.cardCounts = {};
      st.workingName = '';
      st.workingDesc = '';
      if(UI.nameIn()) UI.nameIn().value = st.workingName;
      return;
    }

    st.charName = def.character || st.charName;
    st.cardCounts = buildCountsFromDeckDef(def);
    st.workingName = String(def.name || '');
    st.workingDesc = String(def.description || '');

    if(UI.nameIn()) UI.nameIn().value = st.workingName;
  }

  function allBuildableCards(){
    const db = window.CardsDB || {};
    const cards = Object.values(db).filter(Boolean);
    // hide abilities and internal cards
    return cards.filter(c => !c.isAbility);
  }

  function matchesFilter(card){
    if(st.typeFilter && String(card.type||'').toLowerCase() != st.typeFilter) return false;
    return true;
  }

  function cardMatches(card, q){
    if(!q) return true;
    const hay = (
      String(card.name || '') + ' ' +
      String(card.type || '') + ' ' +
      String(card.desc || '') + ' ' +
      String(card.effect || '')
    ).toLowerCase();
    return hay.includes(q);
  }

  function renderCardList(){
    const wrap = UI.cardList();
    if(!wrap) return;
    const q = (st.search || '').trim().toLowerCase();
    const type = (st.typeFilter || '').trim().toLowerCase();

    const cards = allBuildableCards()
      .filter(c => !type || String(c.type||'').toLowerCase() === type)
      .filter(c => cardMatches(c, q))
      .sort((a,b) => String(a.name||'').localeCompare(String(b.name||'')));

    wrap.innerHTML = '';

    for(const c of cards){
      const row = document.createElement('div');
      row.className = 'db-card-row';

      const left = document.createElement('div');
      left.className = 'db-card-info';
      const title = document.createElement('div');
      title.className = 'db-card-title';
      title.textContent = c.name;
      const meta = document.createElement('div');
      meta.className = 'db-card-meta';
      meta.textContent = `${String(c.type||'').toUpperCase()} · Cost ${c.cost ?? 0}⚡ · Time ${c.moments ?? 1}⏳` + (c.dmg ? ` · DMG ${c.dmg}⚔️` : '');
      const desc = document.createElement('div');
      desc.className = 'db-card-desc';
      desc.textContent = c.desc || '';
      left.appendChild(title);
      left.appendChild(meta);
      left.appendChild(desc);

      // Requirement chips (proficiencies)
      const reqWrap = document.createElement('div');
      reqWrap.className = 'db-req-chips';

      const icons = window.ProficiencyIcons || window.PROFICIENCY_ICONS || {};
      const req = c.requirements || null;

      function addChip(text, icon, state){
        const chip = document.createElement('span');
        chip.className = 'db-chip' + (state ? (' ' + state) : '');
        chip.textContent = (icon ? (icon + ' ') : '') + text;
        reqWrap.appendChild(chip);
        return chip;
      }

      // Compute legality + missing proficiencies
      const char = window.CharactersDB?.[st.charName] || window.classData?.[st.charName] || null;
      const have = new Set();
      if(char){
        if(char.class) have.add(String(char.class).toLowerCase());
        if(Array.isArray(char.talents)) for(const t of char.talents) have.add(String(t).toLowerCase());
      }

      function fmtAll(arr){
        return (arr||[]).map(x => String(x).toLowerCase());
      }

      let isLegal = true;
      let tooltip = '';
      let missing = new Set();

      if(req){
        const all = req.all ? fmtAll(req.all) : null;
        const any = Array.isArray(req.any) ? req.any : null;

        if(all){
          for(const p of all){ if(!have.has(p)) missing.add(p); }
          isLegal = missing.size === 0;
          tooltip = 'ALL: ' + all.join(' + ');
        } else if(any){
          // any is list of {all:[...]}
          let anyOk = false;
          const groups = any.map(g => fmtAll(g?.all||[]));
          for(const g of groups){
            const missG = g.filter(p => !have.has(p));
            if(missG.length === 0){ anyOk = true; break; }
          }
          isLegal = anyOk;
          tooltip = 'ANY: ' + groups.map(g => '(' + g.join(' + ') + ')').join(' OR ');
          if(!anyOk){
            // union missing from all groups (best-effort)
            for(const g of groups){ for(const p of g){ if(!have.has(p)) missing.add(p); } }
          }
        }

        // Render chips
        if(all){
          for(const p of all){
            const icon = icons[p] || '';
            addChip(p, icon, have.has(p) ? 'ok' : 'missing');
          }
        } else if(any){
          const groups = any.map(g => fmtAll(g?.all||[]));
          // show as chips: ice + (wizard OR sorcerer) etc.
          // We'll just render each group separated by OR.
          groups.forEach((g, gi) => {
            g.forEach((p, pi) => {
              const icon = icons[p] || '';
              addChip(p, icon, have.has(p) ? 'ok' : 'missing');
              if(pi < g.length-1){
                const plusTxt = document.createElement('span');
                plusTxt.className = 'db-chip-sep';
                plusTxt.textContent = '+';
                reqWrap.appendChild(plusTxt);
              }
            });
            if(gi < groups.length-1){
              const orTxt = document.createElement('span');
              orTxt.className = 'db-chip-sep';
              orTxt.textContent = 'OR';
              reqWrap.appendChild(orTxt);
            }
          });
        }

        if(reqWrap.childNodes.length){
          reqWrap.title = tooltip + (missing.size ? ('\nMissing: ' + Array.from(missing).join(', ')) : '');
        }
      }

      if(reqWrap.childNodes.length){
        left.appendChild(reqWrap);
      }

      const controls = document.createElement('div');
      controls.className = 'db-card-controls';

      const minus = document.createElement('button');
      minus.className = 'db-mini';
      minus.textContent = '−';
      minus.onclick = () => {
        const cur = st.cardCounts[c.id] || 0;
        st.cardCounts[c.id] = Math.max(0, cur - 1);
        if(st.cardCounts[c.id] === 0) delete st.cardCounts[c.id];
        renderAll();
      };

      const count = document.createElement('div');
      count.className = 'db-count';
      count.textContent = String(st.cardCounts[c.id] || 0);

      const plus = document.createElement('button');
      plus.className = 'db-mini';
      plus.textContent = '+';
      plus.onclick = () => {
        const cur = st.cardCounts[c.id] || 0;
        st.cardCounts[c.id] = cur + 1;
        renderAll();
      };

      // legality enforcement
      if(req && !isLegal){
        row.classList.add('db-illegal');
        plus.disabled = true;
        plus.title = (reqWrap?.title || 'Illegal');
      }


      controls.appendChild(minus);
      controls.appendChild(count);
      controls.appendChild(plus);

      row.appendChild(left);
      row.appendChild(controls);

      wrap.appendChild(row);
    }
  }

  function renderDeckList(){
    const wrap = UI.deckList();
    if(!wrap) return;
    const entries = toDeckEntriesFromCounts(st.cardCounts);

    wrap.innerHTML = '';

    if(entries.length === 0){
      const empty = document.createElement('div');
      empty.className = 'db-empty';
      empty.textContent = 'No cards yet — add cards from the left.';
      wrap.appendChild(empty);
      return;
    }

    for(const e of entries){
      const card = window.CardsDB?.[e.cardId];
      const row = document.createElement('div');
      row.className = 'db-deck-row';

      const name = document.createElement('div');
      name.className = 'db-deck-name';
      name.textContent = card?.name || e.cardId;

      const count = document.createElement('div');
      count.className = 'db-deck-count';
      count.textContent = `x${e.copies}`;

      row.appendChild(name);
      row.appendChild(count);
      wrap.appendChild(row);
    }
  }

  function renderSummary(){
    const t = totalCards(st.cardCounts);
    if(UI.total()){
      UI.total().innerHTML = `<b>${t}</b> cards` + (t ? ` <span style="opacity:.75;">(hint: ~${DEFAULT_DECK_SIZE_HINT})</span>` : '');
    }

    const meta = UI.meta();
    if(meta){
      const deckLabel = st.loadedDeckId ? (isCustom(st.loadedDeckId) ? 'Custom' : 'Built-in') : 'New';
      const c = st.charName || '';
      meta.textContent = `${c} · ${deckLabel}`;
    }

    if(UI.delBtn()){
      UI.delBtn().disabled = !st.loadedDeckId || !isCustom(st.loadedDeckId);
    }
  }

  function renderAll(){
    renderSummary();
    renderCardList();
    renderDeckList();
  }

  function onSave(){
    if(!st.charName){
      alert('Choose a character first.');
      return;
    }

    const name = (UI.nameIn()?.value || '').trim();
    if(!name){
      alert('Please give your deck a name.');
      return;
    }

    const entries = toDeckEntriesFromCounts(st.cardCounts);
    if(entries.length === 0){
      alert('Deck is empty. Add at least one card.');
      return;
    }

    // determine save id
    let id = st.loadedDeckId;
    if(!id || !isCustom(id)){
      id = `custom_${Date.now()}_${Math.floor(Math.random()*1e6)}`;
    }

    const deckDef = {
      id,
      name,
      character: st.charName,
      description: st.workingDesc || '',
      cards: entries
    };

    if(typeof window.upsertCustomDeck === 'function'){
      window.upsertCustomDeck(deckDef);
    }else{
      alert('Custom deck saving is not available (missing data.js helpers).');
      return;
    }

    st.loadedDeckId = id;
    loadDeckOptions();
    if(UI.loadSel()) UI.loadSel().value = id;

    // Refresh pickers in the main UI
    if(typeof window.renderDeckPickers === 'function') window.renderDeckPickers();

    alert('Deck saved!');
  }

  function onDelete(){
    if(!st.loadedDeckId || !isCustom(st.loadedDeckId)) return;
    if(!confirm('Delete this custom deck?')) return;

    if(typeof window.deleteCustomDeck === 'function'){
      window.deleteCustomDeck(st.loadedDeckId);
    }

    st.loadedDeckId = '';
    st.cardCounts = {};
    st.workingName = '';
    if(UI.nameIn()) UI.nameIn().value = '';

    loadDeckOptions();
    renderAll();

    if(typeof window.renderDeckPickers === 'function') window.renderDeckPickers();
  }

  function onDuplicate(){
    if(!st.charName){
      alert('Choose a character first.');
      return;
    }

    // Duplicating always creates a new custom id and switches to it.
    const baseName = (UI.nameIn()?.value || st.workingName || '').trim() || 'Deck';
    const newName = baseName + ' (Copy)';
    const id = `custom_${Date.now()}_${Math.floor(Math.random()*1e6)}`;

    st.loadedDeckId = id;
    st.workingName = newName;
    if(UI.nameIn()) UI.nameIn().value = newName;

    loadDeckOptions();
    if(UI.loadSel()) UI.loadSel().value = id;

    renderAll();
  }

  function openDeckBuilder(initialChar){
    ensureUIBound();

    st.open = true;
    const overlay = UI.overlay();
    if(overlay) overlay.style.display = 'flex';

    loadCharacterOptions();

    // Default character is selected player if available
    const defaultChar = initialChar || (typeof window.getSelectedChar === 'function' ? window.getSelectedChar('player') : null) || safeCharacterList()[0];
    st.charName = defaultChar;
    if(UI.charSel()) UI.charSel().value = defaultChar;

    loadDeckOptions();

    // Load the default deck for that character (or empty)
    const defId = getDefaultDeckIdForChar(defaultChar);
    loadDeckIntoBuilder(defId || '');
    if(UI.loadSel()) UI.loadSel().value = defId || '';

    // Reset filters
    st.search = '';
    st.typeFilter = '';
    if(UI.searchIn()) UI.searchIn().value = '';
    if(UI.typeSel()) UI.typeSel().value = '';

    renderAll();
  }

  function closeDeckBuilder(){
    st.open = false;
    const overlay = UI.overlay();
    if(overlay) overlay.style.display = 'none';
  }

  // Expose for inline HTML onclick
  window.openDeckBuilder = openDeckBuilder;
  window.closeDeckBuilder = closeDeckBuilder;

})();
