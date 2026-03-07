// netplay.js
// LAN PvP host/guest runtime for Split Seconds.

(function () {
  'use strict';

  const API_BASE = '/api/room';
  const LAN_HOST_LABEL_KEY = 'ss_lan_host_label';
  const LAN_UNAVAILABLE_MSG = 'LAN PvP requires http:// or https://. Run: node lan_server.js and open the LAN URL.';

  const net = {
    mode: 'offline', // offline | lan-host | lan-guest
    role: null,      // host | guest
    roomCode: '',
    token: '',
    since: 0,
    pollTimer: null,
    pollInFlight: false,
    inMatch: false,

    guestConnected: false,
    guestSelection: { char: null, deckId: null },

    hostPlanningLocked: false,
    guestPlanningLocked: false,
    hostExertConfirmed: false,
    guestExertConfirmed: false,
    hostFlashSubmitted: false,
    guestFlashSubmitted: false,
    hostFlashDecision: null,
    guestFlashDecision: null,
    hostPivotLocked: false,
    guestPivotLocked: false,
    ui: {
      panel: null,
      panelToggle: null,
      roomInput: null,
      hostLabelInput: null,
      hostBtn: null,
      joinBtn: null,
      leaveBtn: null,
      refreshBtn: null,
      roomList: null,
      status: null
    },

    original: {
      dispatch: null,
      startGame: null,
      backToMenu: null,
      updateUI: null,
      selectChar: null,
      selectDeck: null,
      selectFightChar: null,
      fightLockIn: null
    }
  };

  let snapshotScheduled = false;
  let lastUiSnapshotAt = 0;
  let roomListTimer = null;

  function isHost() { return net.mode === 'lan-host'; }
  function isGuest() { return net.mode === 'lan-guest'; }
  function isActive() { return isHost() || isGuest(); }
  function canUseLanApi() {
    return typeof location !== 'undefined' && (location.protocol === 'http:' || location.protocol === 'https:');
  }

  function setStatus(msg) {
    if (net.ui.status) net.ui.status.textContent = msg || '';
  }
  function setBattleWaitMessage(msg) {
    const text = String(msg || '');
    window.__ssLanWaitMessage = text;
    const el = document.getElementById('net-wait-indicator');
    if (!el) return;
    if (text) { el.style.display = 'block'; el.innerText = text; }
    else { el.style.display = 'none'; el.innerText = ''; }
  }


  function safeJsonClone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function nextHostRandFloat() {
    const s = window.state;
    if (!s || !s.useDeterministicRng) return Math.random();
    if (typeof s.rngSeed !== 'number') s.rngSeed = (Date.now() & 0xffffffff) >>> 0;
    let t = (s.rngSeed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const out = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    s.rngSeed >>>= 0;
    return out;
  }

  function hostRandInt(maxExclusive) {
    const m = Number(maxExclusive);
    if (!Number.isFinite(m) || m <= 1) return 0;
    return Math.floor(nextHostRandFloat() * m);
  }

  async function fetchJson(url, options) {
    if (!canUseLanApi()) {
      throw new Error(LAN_UNAVAILABLE_MSG);
    }
    const res = await fetch(url, {
      method: options?.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: options?.body ? JSON.stringify(options.body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  }

  async function apiHostRoom(roomCode, hostLabel) {
    const data = await fetchJson(`${API_BASE}/host`, {
      method: 'POST',
      body: { roomCode: roomCode || '', hostLabel: (hostLabel || '').trim() }
    });
    net.mode = 'lan-host';
    net.role = 'host';
    net.roomCode = data.roomCode;
    net.token = data.token;
    net.since = 0;
    net.guestConnected = false;
    net.inMatch = false;
    setStatus(`Hosting room ${net.roomCode}. Waiting for guest...`);
    startPolling();
    refreshRoomList().catch(() => {});
  }

  async function apiJoinRoom(roomCode) {
    const code = String(roomCode || '').trim().toUpperCase();
    if (!code) throw new Error('Enter a room code first.');

    const data = await fetchJson(`${API_BASE}/join`, {
      method: 'POST',
      body: { roomCode: code }
    });

    net.mode = 'lan-guest';
    net.role = 'guest';
    net.roomCode = data.roomCode;
    net.token = data.token;
    net.since = 0;
    net.inMatch = false;
    setStatus(`Joined room ${net.roomCode}. Waiting for host to start.`);
    startPolling();
    refreshRoomList().catch(() => {});
    sendLocalSelectionToHost();
  }

  async function apiListRooms() {
    return fetchJson(`${API_BASE}/list`, { method: 'GET' });
  }

  function formatRoomAge(ts) {
    const d = Math.max(0, Math.floor((Date.now() - Number(ts || 0)) / 1000));
    if (d < 60) return `${d}s ago`;
    const m = Math.floor(d / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return `${h}h ago`;
  }

  function renderRoomList(rooms) {
    const el = net.ui.roomList;
    if (!el) return;
    const list = Array.isArray(rooms) ? rooms : [];
    if (!list.length) {
      el.innerHTML = '<div class="lan-room-empty">No rooms found. Host one and it will appear here.</div>';
      return;
    }

    el.innerHTML = list.map((r) => {
      const code = String(r.roomCode || '');
      const host = String(r.hostLabel || 'Host');
      const canJoin = !!r.canJoin;
      const cls = canJoin ? 'lan-room-item waiting' : 'lan-room-item';
      const state = canJoin ? 'Waiting for guest' : 'In match';
      const joinLabel = canJoin ? 'Join' : 'Full';
      const disabled = canJoin ? '' : 'disabled';
      return `
        <div class="${cls}">
          <div class="lan-room-meta">
            <div class="lan-room-code">${code}</div>
            <div>${host} - ${state} - ${formatRoomAge(r.updatedAt)}</div>
          </div>
          <button class="lan-btn" data-room-code="${code}" ${disabled}>${joinLabel}</button>
        </div>
      `;
    }).join('');
  }

  async function refreshRoomList() {
    if (!net.ui.roomList) return;
    if (!canUseLanApi()) {
      renderRoomList([]);
      return;
    }
    try {
      const data = await apiListRooms();
      renderRoomList(data.rooms || []);
    } catch {
      renderRoomList([]);
    }
  }

  function startRoomListPolling() {
    if (!canUseLanApi()) {
      renderRoomList([]);
      setStatus(LAN_UNAVAILABLE_MSG);
      return;
    }
    if (roomListTimer) clearInterval(roomListTimer);
    refreshRoomList().catch(() => {});
    roomListTimer = setInterval(() => {
      refreshRoomList().catch(() => {});
    }, 2500);
  }
  function stopPolling() {
    if (net.pollTimer) clearInterval(net.pollTimer);
    net.pollTimer = null;
    net.pollInFlight = false;
  }

  function resetNetState() {
    stopPolling();
    net.mode = 'offline';
    net.role = null;
    net.roomCode = '';
    net.token = '';
    net.since = 0;
    net.inMatch = false;
    net.guestConnected = false;
    net.hostPlanningLocked = false;
    net.guestPlanningLocked = false;
    net.hostExertConfirmed = false;
    net.guestExertConfirmed = false;
    net.hostFlashSubmitted = false;
    net.guestFlashSubmitted = false;
    net.hostFlashDecision = null;
    net.guestFlashDecision = null;
    net.hostPivotLocked = false;
    net.guestPivotLocked = false;
    net.guestSelection = { char: null, deckId: null };
    window.__ssLanPvpMode = { enabled: false, role: null };
    setStatus('LAN mode disconnected.');
  }

  async function sendEvent(type, payload) {
    if (!isActive()) return;
    await fetchJson(`${API_BASE}/send`, {
      method: 'POST',
      body: {
        roomCode: net.roomCode,
        token: net.token,
        type,
        payload: payload || {}
      }
    });
  }

  async function pollOnce() {
    if (!isActive() || net.pollInFlight) return;
    net.pollInFlight = true;
    try {
      const query = `roomCode=${encodeURIComponent(net.roomCode)}&token=${encodeURIComponent(net.token)}&since=${encodeURIComponent(net.since)}`;
      const data = await fetchJson(`${API_BASE}/poll?${query}`, { method: 'GET' });
      if (Array.isArray(data.events)) {
        for (const evt of data.events) handleInboundEvent(evt);
      }
      net.since = Number(data.latestEventId || net.since || 0);
    } catch (err) {
      setStatus(`Network issue: ${err.message}`);
    } finally {
      net.pollInFlight = false;
    }
  }

  function startPolling() {
    stopPolling();
    pollOnce();
    net.pollTimer = setInterval(pollOnce, 160);
  }

  
  function toggleLanPanel() {
    const panel = net.ui.panel || document.getElementById('lan-pvp-panel');
    const toggle = net.ui.panelToggle || document.getElementById('lan-panel-toggle');
    if (!panel) return false;
    net.ui.panel = panel;
    if (toggle) net.ui.panelToggle = toggle;
    const open = panel.classList.toggle('open');
    if (toggle) toggle.textContent = open ? '\u25B6' : '\u25C0';
    return open;
  }
  function bindUi() {
    net.ui.panel = document.getElementById('lan-pvp-panel');
    net.ui.panelToggle = document.getElementById('lan-panel-toggle');
    net.ui.roomInput = document.getElementById('lan-room-code');
    net.ui.hostLabelInput = document.getElementById('lan-host-label');
    net.ui.hostBtn = document.getElementById('lan-host-btn');
    net.ui.joinBtn = document.getElementById('lan-join-btn');
    net.ui.leaveBtn = document.getElementById('lan-leave-btn');
    net.ui.refreshBtn = document.getElementById('lan-refresh-btn');
    net.ui.roomList = document.getElementById('lan-room-list');
    net.ui.status = document.getElementById('lan-status');

    if (!net.ui.hostBtn || !net.ui.joinBtn || !net.ui.leaveBtn) return;
    if (!canUseLanApi()) {
      net.ui.hostBtn.disabled = true;
      net.ui.joinBtn.disabled = true;
      net.ui.leaveBtn.disabled = true;
      if (net.ui.refreshBtn) net.ui.refreshBtn.disabled = true;
    }
    if (net.ui.panelToggle && net.ui.panelToggle.dataset.bound !== '1') {
      net.ui.panelToggle.dataset.bound = '1';
      net.ui.panelToggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleLanPanel();
      });
    }

    if (net.ui.roomInput) {
      net.ui.roomInput.addEventListener('input', () => {
        net.ui.roomInput.value = String(net.ui.roomInput.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      });
    }
    if (net.ui.hostLabelInput) {
      try {
        const saved = localStorage.getItem(LAN_HOST_LABEL_KEY);
        if (saved) net.ui.hostLabelInput.value = String(saved).slice(0, 18);
      } catch {}
      net.ui.hostLabelInput.addEventListener('input', () => {
        const v = String(net.ui.hostLabelInput.value || '').replace(/\s+/g, ' ').slice(0, 18);
        net.ui.hostLabelInput.value = v;
        try { localStorage.setItem(LAN_HOST_LABEL_KEY, v.trim()); } catch {}
      });
    }

    net.ui.hostBtn.addEventListener('click', async () => {
      if (isActive()) {
        setStatus('Leave the current room first.');
        return;
      }
      try {
        await apiHostRoom(net.ui.roomInput?.value || '', net.ui.hostLabelInput?.value || '');
        if (net.ui.roomInput) net.ui.roomInput.value = net.roomCode;
      } catch (err) {
        setStatus(`Host failed: ${err.message}`);
      }
    });

    net.ui.joinBtn.addEventListener('click', async () => {
      if (isActive()) {
        setStatus('Leave the current room first.');
        return;
      }
      try {
        await apiJoinRoom(net.ui.roomInput?.value || '');
      } catch (err) {
        setStatus(`Join failed: ${err.message}`);
      }
    });

    net.ui.leaveBtn.addEventListener('click', () => {
      resetNetState();
      refreshRoomList().catch(() => {});
    });

    if (net.ui.refreshBtn) {
      net.ui.refreshBtn.addEventListener('click', () => {
        refreshRoomList().catch(() => {});
      });
    }

    if (net.ui.roomList) {
      net.ui.roomList.addEventListener('click', async (e) => {
        const btn = e.target?.closest?.('button[data-room-code]');
        if (!btn || btn.disabled) return;
        const code = String(btn.getAttribute('data-room-code') || '').trim().toUpperCase();
        if (!code) return;
        if (isActive()) {
          setStatus('Leave the current room first.');
          return;
        }

        if (net.ui.roomInput) net.ui.roomInput.value = code;
        try {
          await apiJoinRoom(code);
        } catch (err) {
          setStatus(`Join failed: ${err.message}`);
          refreshRoomList().catch(() => {});
        }
      });
    }

    startRoomListPolling();
  }
  function getSelectedForLocalPlayer() {
    const char = (typeof window.getSelectedChar === 'function') ? window.getSelectedChar('player') : null;
    const deckId = (typeof window.getSelectedDeckId === 'function') ? window.getSelectedDeckId('player') : null;
    return { char, deckId };
  }

  function sendLocalSelectionToHost() {
    if (!isGuest()) return;
    const sel = getSelectedForLocalPlayer();
    sendEvent('selection_update', sel).catch(() => {});
  }

  function sendHostSelectionToGuest() {
    if (!isHost() || !net.guestConnected) return;
    const sel = getSelectedForLocalPlayer();
    sendEvent('host_selection_update', sel).catch(() => {});
  }

  function applyGuestSelectionOnHost(sel) {
    if (!isHost() || !sel) return;
    const nextChar = String(sel.char || '').trim();
    const nextDeck = String(sel.deckId || '').trim();
    if (!nextChar) return;

    net.guestSelection = { char: nextChar, deckId: nextDeck || null };

    if (typeof window.setFightOpponentPreview === 'function') {
      try { window.setFightOpponentPreview(nextChar, nextDeck || null); } catch (e) {}
    }

    const selectCharFn = net.original.selectChar || window.selectChar;
    const selectDeckFn = net.original.selectDeck || window.selectDeck;
    if (typeof selectCharFn === 'function') {
      try { selectCharFn('ai', nextChar); } catch (e) {}
    }
    if (nextDeck && typeof selectDeckFn === 'function') {
      try { selectDeckFn('ai', nextDeck); } catch (e) {}
    }
  }


  function applyHostSelectionOnGuest(sel) {
    if (!isGuest() || !sel) return;
    const nextChar = String(sel.char || '').trim();
    const nextDeck = String(sel.deckId || '').trim();
    if (!nextChar) return;

    if (typeof window.setFightOpponentPreview === 'function') {
      try { window.setFightOpponentPreview(nextChar, nextDeck || null); } catch (e) {}
    }

    const selectCharFn = net.original.selectChar || window.selectChar;
    const selectDeckFn = net.original.selectDeck || window.selectDeck;
    if (typeof selectCharFn === 'function') {
      try { selectCharFn('ai', nextChar); } catch (e) {}
    }
    if (nextDeck && typeof selectDeckFn === 'function') {
      try { selectDeckFn('ai', nextDeck); } catch (e) {}
    }
  }

  function redactedOpponentForGuest(opponentSide, phase) {
    const out = safeJsonClone(opponentSide || {});
    const handCount = Array.isArray(opponentSide?.hand) ? opponentSide.hand.length : 0;
    const deckCount = Array.isArray(opponentSide?.deck) ? opponentSide.deck.length : 0;

    out.hand = Array.from({ length: handCount }, (_, i) => ({ hidden: true, uniqueId: `hidden_hand_${i}` }));
    out.deck = Array.from({ length: deckCount }, (_, i) => ({ hidden: true, uniqueId: `hidden_deck_${i}` }));

    const hideTimeline = (
      phase === 'exert' ||
      phase === 'planning' ||
      phase === 'pivot_wait' ||
      phase === 'flash' ||
      phase === 'net_wait_lock' ||
      phase === 'net_wait_exert' ||
      phase === 'net_wait_flash' ||
      phase === 'net_wait_pivot_lock'
    );

    if (hideTimeline) out.timeline = [null, null, null, null, null];
    return out;
  }

  function buildGuestSnapshotState() {
    const s = window.state;
    const clone = safeJsonClone(s);
    const guestPivotSlots = Array.isArray(s.aiPivotSlots) ? safeJsonClone(s.aiPivotSlots) : null;

    const projected = {
      ...clone,
      player: safeJsonClone(s.ai),
      ai: redactedOpponentForGuest(s.player, s.phase),
      pivotSlots: guestPivotSlots,
      aiPivotSlots: null
    };

    if (!Array.isArray(projected.pivotSlots) || projected.pivotSlots.length === 0) {
      projected.pivotSlots = null;
    }

    // Never leak host-internal flash AI bookkeeping fields to guest snapshots.
    projected.originalPCard = null;
    projected.originalAICard = null;
    projected.aiFlashDecision = null;

    // Do not expose RNG internals to guest clients.
    projected.rngSeed = undefined;
    projected.useDeterministicRng = undefined;

    return projected;
  }

  function replaceStateInPlace(nextState) {
    if (!window.state || !nextState) return;
    const target = window.state;
    const incoming = safeJsonClone(nextState);

    for (const k of Object.keys(target)) delete target[k];
    for (const [k, v] of Object.entries(incoming)) target[k] = v;
  }

  function guestPhaseOverride(basePhase, meta) {
    if (!meta) return basePhase;
    if (basePhase === 'planning' && meta.guestPlanningLocked && !meta.hostPlanningLocked) {
      return 'net_wait_lock';
    }
    if (basePhase === 'exert' && meta.guestExertConfirmed && !meta.hostExertConfirmed) {
      return 'net_wait_exert';
    }
    if (basePhase === 'net_wait_exert' && !meta.guestExertConfirmed) {
      return 'exert';
    }
    if (basePhase === 'flash' && meta.guestFlashSubmitted && !meta.hostFlashSubmitted) {
      return 'net_wait_flash';
    }
    if (basePhase === 'pivot_wait' && meta.guestPivotLocked && !meta.hostPivotLocked) {
      return 'net_wait_pivot_lock';
    }
    return basePhase;
  }

  function cloneFlashRevealCard(card) {
    if (!card || card === 'occupied') return null;
    return {
      name: card.name || '',
      type: card.type || 'utility',
      dmg: Number(card.dmg || 0),
      moments: Math.max(1, Number(card.moments || 1)),
      cost: Number(card.cost || 0),
      desc: card.desc || '',
      effect: card.effect || ''
    };
  }

  function clearFlashHighlights() {
    document.querySelectorAll('.slot').forEach((s) => s.classList.remove('flash-highlight'));
  }

  function applyFlashHighlights(momentIndex) {
    const idx = Number(momentIndex);
    if (!Number.isFinite(idx) || idx < 0 || idx > 4) return;
    clearFlashHighlights();
    const pSlot = document.querySelector(`#player-timeline .slot:nth-child(${idx + 1})`);
    const aiSlot = document.querySelector(`#ai-timeline .slot:nth-child(${idx + 1})`);
    if (pSlot) pSlot.classList.add('flash-highlight');
    if (aiSlot) aiSlot.classList.add('flash-highlight');
  }

  function hideFlashModal() {
    const modal = document.getElementById('flash-modal');
    if (modal) modal.style.display = 'none';
  }

  function renderFlashModal(ownCard, enemyCard, flashMoment, interactive) {
    const modal = document.getElementById('flash-modal');
    const pCardEl = document.getElementById('flash-p-card');
    const aiCardEl = document.getElementById('flash-ai-card');
    const titleEl = document.getElementById('flash-moment-title');
    if (!modal || !pCardEl || !aiCardEl || !titleEl) return;

    const render = (card) => {
      if (!card) return '<div class="empty-flash">EMPTY SLOT</div>';
      if (typeof window.generateCardHTML === 'function') {
        return window.generateCardHTML(card);
      }
      return '<div class="empty-flash">REVEALED</div>';
    };

    pCardEl.innerHTML = render(ownCard);
    aiCardEl.innerHTML = render(enemyCard);
    titleEl.innerText = `FLASH: MOMENT ${Number(flashMoment) + 1}`;

    modal.style.display = 'flex';
    document.querySelectorAll('#flash-modal button').forEach((b) => {
      b.disabled = !interactive;
    });
  }

  function clearLocalPivotGlow() {
    const slots = document.querySelectorAll('#player-timeline .slot');
    slots.forEach((slot) => {
      slot.style.boxShadow = 'none';
    });
  }

  function clearGuestResolutionVisuals() {
    document.querySelectorAll('.slot, .card').forEach((el) => {
      el.style.boxShadow = 'none';
      el.style.filter = 'none';
    });
    document.querySelectorAll('.resolving').forEach((el) => el.classList.remove('resolving'));
  }

  function applyGuestResolutionVisuals() {
    clearGuestResolutionVisuals();
    const idx = Number(window.state?.currentMoment);
    if (!Number.isFinite(idx) || idx < 0 || idx > 4) return;

    const pSlot = document.querySelector(`#player-timeline .slot:nth-child(${idx + 1})`);
    const aiSlot = document.querySelector(`#ai-timeline .slot:nth-child(${idx + 1})`);
    const pCard = document.getElementById(`p-card-mom-${idx + 1}`);
    const aiCard = document.getElementById(`ai-card-mom-${idx + 1}`);

    const glowTarget = (slot, card) => {
      const t = card || slot;
      if (!t) return;
      t.style.boxShadow = '0 0 20px 8px rgba(255, 255, 255, 0.7)';
      if (card) {
        card.style.filter = 'brightness(1.2)';
      }
    };

    glowTarget(pSlot, pCard);
    glowTarget(aiSlot, aiCard);
    if (pCard) pCard.classList.add('resolving');
    if (aiCard) aiCard.classList.add('resolving');
  }

  function paintLocalPivotGlow() {
    clearLocalPivotGlow();
    const slots = Array.isArray(window.state?.pivotSlots) ? window.state.pivotSlots : [];
    for (const slotIdx of slots) {
      const slotEl = document.querySelector(`#player-timeline .slot:nth-child(${Number(slotIdx) + 1})`);
      if (slotEl) slotEl.style.boxShadow = '0 0 15px 5px #f1c40f';
    }
  }

  function applyGuestSnapshot(payload) {
    const nextState = payload?.state;
    if (!nextState) return;

    const hostPhase = nextState.phase;
    const phase = guestPhaseOverride(hostPhase, payload.meta || {});
    nextState.phase = phase;

    replaceStateInPlace(nextState);
    if (typeof window.applyBattleMetaFromState === 'function') {
      window.applyBattleMetaFromState();
    }
    if (typeof window.renderPlayerTimeline === 'function') window.renderPlayerTimeline();
    if (typeof window.renderAITimeline === 'function') window.renderAITimeline();
    if (typeof window.updateUI === 'function') window.updateUI();

    if (phase === 'resolution') applyGuestResolutionVisuals();
    else clearGuestResolutionVisuals();

    if (phase === 'flash') {
      const f = payload?.meta?.flash || {};
      applyFlashHighlights(f.moment);
      renderFlashModal(f.playerCard || null, f.aiCard || null, f.moment, true);
      clearLocalPivotGlow();
    } else if (phase === 'net_wait_flash') {
      clearFlashHighlights();
      hideFlashModal();
      clearLocalPivotGlow();
    } else {
      if (phase === 'net_wait_exert') setBattleWaitMessage('Waiting for opponent to confirm exert...');
      else if (phase === 'net_wait_lock') setBattleWaitMessage('Waiting for opponent to lock planning...');
      else if (phase === 'net_wait_flash') setBattleWaitMessage('Waiting for opponent flash decision...');
      else if (phase !== 'pivot_wait') setBattleWaitMessage('');
      clearFlashHighlights();
      hideFlashModal();
      if (phase !== 'pivot_wait' && phase !== 'net_wait_pivot_lock') clearLocalPivotGlow();
    }

    if (phase === 'pivot_wait' || phase === 'net_wait_pivot_lock') {
      if (phase === 'net_wait_pivot_lock') setBattleWaitMessage('Waiting for opponent to lock pivot...');
      paintLocalPivotGlow();
    }
  }

  function scheduleHostSnapshot(reason) {
    if (!isHost() || !net.inMatch) return;
    if (snapshotScheduled) return;
    snapshotScheduled = true;
    setTimeout(() => {
      snapshotScheduled = false;
      hostPushSnapshot(reason || 'tick');
    }, 50);
  }

  function buildGuestFlashMeta() {
    if (window.state.phase !== 'flash') return null;
    const moment = Number(window.state.flashMoment);
    if (!Number.isFinite(moment) || moment < 0 || moment > 4) return null;

    const hostCard = getCardDataForSide('player', moment)?.card || null;
    const guestCard = getCardDataForSide('ai', moment)?.card || null;

    return {
      moment,
      playerCard: cloneFlashRevealCard(guestCard),
      aiCard: cloneFlashRevealCard(hostCard)
    };
  }

  async function hostPushSnapshot(reason) {
    if (!isHost() || !net.inMatch) return;
    const payload = {
      reason: reason || '',
      state: buildGuestSnapshotState(),
      meta: {
        hostPlanningLocked: !!net.hostPlanningLocked,
        guestPlanningLocked: !!net.guestPlanningLocked,
        hostExertConfirmed: !!net.hostExertConfirmed,
        guestExertConfirmed: !!net.guestExertConfirmed,
        hostFlashSubmitted: !!net.hostFlashSubmitted,
        guestFlashSubmitted: !!net.guestFlashSubmitted,
        hostPivotLocked: !!net.hostPivotLocked,
        guestPivotLocked: !!net.guestPivotLocked,
        flash: buildGuestFlashMeta(),
        roomCode: net.roomCode
      }
    };
    try {
      await sendEvent('snapshot', payload);
    } catch (err) {
      setStatus(`Snapshot send failed: ${err.message}`);
    }
  }

  function sidePivotSlots(side) {
    if (side === 'player') {
      return Array.isArray(window.state.pivotSlots) ? window.state.pivotSlots : null;
    }
    return Array.isArray(window.state.aiPivotSlots) ? window.state.aiPivotSlots : null;
  }

  function sideIsLockedForPhase(side, phase) {
    if (phase === 'planning') {
      return side === 'player' ? net.hostPlanningLocked : net.guestPlanningLocked;
    }
    if (phase === 'pivot_wait') {
      return side === 'player' ? net.hostPivotLocked : net.guestPivotLocked;
    }
    return true;
  }

  function canApplyPlanningActionForSide(side) {
    const phase = window.state.phase;
    if (phase !== 'planning' && phase !== 'pivot_wait') return false;
    if (sideIsLockedForPhase(side, phase)) return false;
    if (phase === 'pivot_wait') {
      const slots = sidePivotSlots(side);
      if (!Array.isArray(slots) || slots.length === 0) return false;
    }
    return true;
  }

  function getMoveCostForSide(side, card) {
    if (typeof window.getMoveCost === 'function') return window.getMoveCost(side, card);
    return Number(card?.cost || 0);
  }

  function getCardDataForSide(side, momentIndex) {
    if (typeof window.getCardData === 'function') return window.getCardData(side, momentIndex);
    return { card: null, startIndex: -1 };
  }

  function applyPlaceFromHandForSide(side, payload) {
    if (!canApplyPlanningActionForSide(side)) return false;

    const st = window.state[side];
    const phase = window.state.phase;
    const pivotSlots = sidePivotSlots(side);
    const handIndex = Number(payload?.handIndex);
    const startMoment = Number(payload?.startMoment);
    const targetTimelineIndex = Number(payload?.targetTimelineIndex);

    if (!Number.isFinite(handIndex) || handIndex < 0 || handIndex >= st.hand.length) return false;
    const card = st.hand[handIndex];
    if (!card) return false;

    const effectiveCost = getMoveCostForSide(side, card);
    if (st.stam < effectiveCost) return false;

    if (card.type === 'enhancer') {
      let targetIdx = Number.isFinite(targetTimelineIndex) ? targetTimelineIndex : startMoment;
      if (!Number.isFinite(targetIdx)) return false;
      if (phase === 'pivot_wait' && (!Array.isArray(pivotSlots) || !pivotSlots.includes(targetIdx))) return false;
      const data = getCardDataForSide(side, targetIdx);
      const targetCard = data?.card;
      if (!targetCard || targetCard === 'occupied') return false;
      if (!Array.isArray(targetCard.enhancers)) targetCard.enhancers = [];

      st.stam -= effectiveCost;
      card.paidCost = effectiveCost;
      card.paidUpfront = true;
      card.enhancedTargetId = targetCard.uniqueId || targetCard.id || null;
      targetCard.enhancers.push(card);
      st.hand.splice(handIndex, 1);

      if (typeof window.playPlaceSound === 'function') window.playPlaceSound(1);
      return true;
    }

    if (!Number.isFinite(startMoment) || startMoment < 0 || startMoment > 4) return false;
    if (startMoment + card.moments > 5) return false;
    if (phase === 'pivot_wait') {
      if (!Array.isArray(pivotSlots) || pivotSlots.length === 0) return false;
      for (let i = 0; i < card.moments; i++) {
        if (!pivotSlots.includes(startMoment + i)) return false;
      }
    }
    for (let i = 0; i < card.moments; i++) {
      if (st.timeline[startMoment + i] !== null) return false;
    }

    st.stam -= effectiveCost;
    card.paidCost = effectiveCost;
    card.paidUpfront = true;

    for (let i = 0; i < card.moments; i++) {
      st.timeline[startMoment + i] = (i === card.moments - 1) ? card : 'occupied';
    }

    st.hand.splice(handIndex, 1);
    if (typeof window.playPlaceSound === 'function') window.playPlaceSound(card.moments || 1);
    return true;
  }

  function applyReturnToHandForSide(side, payload) {
    if (!canApplyPlanningActionForSide(side)) return false;
    const st = window.state[side];
    const idx = Number(payload?.timelineIndex);
    if (!Number.isFinite(idx) || idx < 0 || idx > 4) return false;
    if (window.state.phase === 'pivot_wait') {
      const slots = sidePivotSlots(side);
      if (!Array.isArray(slots) || !slots.includes(idx)) return false;
    }

    const card = st.timeline[idx];
    if (!card || card === 'occupied') return false;

    const refund = (card.paidCost ?? card.cost ?? 0);
    st.stam = Math.min(st.maxStam, st.stam + refund);
    const startIdx = idx - (card.moments - 1);
    for (let i = 0; i < card.moments; i++) st.timeline[startIdx + i] = null;

    if (Array.isArray(card.enhancers) && card.enhancers.length > 0) {
      for (const enh of card.enhancers) {
        const enhRefund = (enh?.paidCost ?? enh?.cost ?? 0);
        st.stam = Math.min(st.maxStam, st.stam + enhRefund);
        if (enh) {
          delete enh.enhancedTargetId;
          st.hand.push(enh);
        }
      }
      card.enhancers = [];
    }

    if (card.id) st.hand.push(card);
    return true;
  }

  function applyAddBasicForSide(side, payload) {
    if (!canApplyPlanningActionForSide(side)) return false;
    const st = window.state[side];
    const name = String(payload?.name || 'Action');
    const cost = Number(payload?.cost || 0);
    const moments = Math.max(1, Number(payload?.moments || 1));
    const dmg = Number(payload?.dmg || 0);
    const type = String(payload?.type || 'utility');

    const actionObj = {
      name,
      cost,
      moments,
      dmg,
      type,
      isBasic: true,
      uniqueId: 'basic_' + Math.random()
    };

    const effectiveCost = getMoveCostForSide(side, actionObj);
    if (st.stam < effectiveCost) return false;

    let slot = -1;
    if (window.state.phase === 'pivot_wait') {
      const slots = sidePivotSlots(side);
      if (!Array.isArray(slots) || slots.length === 0) return false;
      for (let i = 0; i < slots.length; i++) {
        const possibleSlot = slots[i];
        let fits = true;
        for (let j = 0; j < moments; j++) {
          if (!slots.includes(possibleSlot + j) || st.timeline[possibleSlot + j] !== null) {
            fits = false;
            break;
          }
        }
        if (fits) { slot = possibleSlot; break; }
      }
    } else {
      for (let i = 0; i <= 5 - moments; i++) {
        let fits = true;
        for (let j = 0; j < moments; j++) {
          if (st.timeline[i + j] !== null) {
            fits = false;
            break;
          }
        }
        if (fits) { slot = i; break; }
      }
    }
    if (slot === -1) return false;

    st.stam -= effectiveCost;
    actionObj.paidCost = effectiveCost;
    actionObj.paidUpfront = true;

    for (let i = 0; i < moments; i++) {
      st.timeline[slot + i] = (i === moments - 1) ? actionObj : 'occupied';
    }

    if (typeof window.playPlaceSound === 'function') window.playPlaceSound(moments);
    return true;
  }

  function applyUseAbilityForSide(side, payload) {
    if (!canApplyPlanningActionForSide(side)) return false;
    if (typeof window.getAbilityCard !== 'function') return false;

    const st = window.state[side];
    const index = Number(payload?.index);
    if (!Number.isFinite(index)) return false;

    const abilityCard = window.getAbilityCard(st.class, index);
    if (!abilityCard) return false;

    const alreadyUsed = st.timeline.some((c) => c && c.name === abilityCard.name);
    if (alreadyUsed) return false;

    const effectiveCost = getMoveCostForSide(side, abilityCard);
    if (st.stam < effectiveCost) return false;

    let slot = -1;
    if (window.state.phase === 'pivot_wait') {
      const slots = sidePivotSlots(side);
      if (!Array.isArray(slots) || slots.length === 0) return false;
      for (let i = 0; i < slots.length; i++) {
        const possibleSlot = slots[i];
        let fits = true;
        for (let j = 0; j < abilityCard.moments; j++) {
          if (!slots.includes(possibleSlot + j) || st.timeline[possibleSlot + j] !== null) {
            fits = false;
            break;
          }
        }
        if (fits) { slot = possibleSlot; break; }
      }
    } else {
      for (let i = 0; i <= 5 - abilityCard.moments; i++) {
        let fits = true;
        for (let j = 0; j < abilityCard.moments; j++) {
          if (st.timeline[i + j] !== null) {
            fits = false;
            break;
          }
        }
        if (fits) { slot = i; break; }
      }
    }
    if (slot === -1) return false;

    st.stam -= effectiveCost;
    const placed = { ...abilityCard, uniqueId: 'basic_' + Math.random(), paidCost: effectiveCost, paidUpfront: true };
    for (let i = 0; i < abilityCard.moments; i++) {
      st.timeline[slot + i] = (i === abilityCard.moments - 1) ? placed : 'occupied';
    }

    if (typeof window.playPlaceSound === 'function') window.playPlaceSound(abilityCard.moments || 1);
    return true;
  }

  function applyGuestEngineAction(action) {
    if (!isHost() || !net.inMatch || !action) return;

    const t = action.type;
    const p = action.payload || {};

    let ok = false;
    if (t === window.EngineRuntime?.ActionTypes?.PLACE_CARD_FROM_HAND) ok = applyPlaceFromHandForSide('ai', p);
    else if (t === window.EngineRuntime?.ActionTypes?.RETURN_CARD_TO_HAND) ok = applyReturnToHandForSide('ai', p);
    else if (t === window.EngineRuntime?.ActionTypes?.ADD_BASIC_ACTION) ok = applyAddBasicForSide('ai', p);
    else if (t === window.EngineRuntime?.ActionTypes?.USE_ABILITY) ok = applyUseAbilityForSide('ai', p);
    else if (t === window.EngineRuntime?.ActionTypes?.TOGGLE_EXERT_CARD) {
      if (window.state.phase === 'exert' && !net.guestExertConfirmed) {
        const idx = Number(p.handIndex);
        if (Number.isFinite(idx) && idx >= 0 && idx < window.state.ai.hand.length) {
          const c = window.state.ai.hand[idx];
          c.selectedForExert = !c.selectedForExert;
          ok = true;
        }
      }
    }

    if (ok) {
      if (typeof window.renderAITimeline === 'function') window.renderAITimeline();
      if (typeof window.updateUI === 'function') window.updateUI();
      scheduleHostSnapshot('guest_engine_action');
    }
  }

  function burnSelectedForSide(side) {
    const st = window.state[side];
    const keep = [];
    let burned = 0;

    for (const c of (st.hand || [])) {
      if (c.selectedForExert) burned += 1;
      else keep.push(c);
      delete c.selectedForExert;
    }

    st.hand = keep;
    const gain = Math.min(Math.max(0, st.maxStam - st.stam), burned);
    st.stam += gain;
    return { burned, gain };
  }

  function applyBothExertAndEnterPlanning() {
    const p = burnSelectedForSide('player');
    const a = burnSelectedForSide('ai');

    if (typeof window.log === 'function') {
      window.log(`Host exerted ${p.burned} card(s), gained ${p.gain} stamina.`);
      window.log(`Guest exerted ${a.burned} card(s), gained ${a.gain} stamina.`);
    }

    const pDraw = Math.max(0, 2 - (window.state.player.statuses.drawLess || 0));
    const aDraw = Math.max(0, 2 - (window.state.ai.statuses.drawLess || 0));

    if (typeof window.drawCards === 'function') {
      if (pDraw > 0) window.drawCards(pDraw, 'player');
      if (aDraw > 0) window.drawCards(aDraw, 'ai');
    }

    window.state.player.statuses.drawLess = 0;
    window.state.ai.statuses.drawLess = 0;

    window.state.phase = 'planning';
    setBattleWaitMessage('');
    net.hostExertConfirmed = false;
    net.guestExertConfirmed = false;
    net.hostPlanningLocked = false;
    net.guestPlanningLocked = false;
    net.hostFlashSubmitted = false;
    net.guestFlashSubmitted = false;
    net.hostFlashDecision = null;
    net.guestFlashDecision = null;
    net.hostPivotLocked = false;
    net.guestPivotLocked = false;
    window.state.pivotSlots = null;
    window.state.aiPivotSlots = null;
    clearFlashHighlights();
    hideFlashModal();
    clearLocalPivotGlow();

    if (typeof window.updateUI === 'function') window.updateUI();
    scheduleHostSnapshot('exert_complete');
  }

  function onHostLocalConfirmExert() {
    if (!isHost() || !net.inMatch) return;
    if (window.state.phase !== 'exert') return;
    if (net.hostExertConfirmed) return;

    net.hostExertConfirmed = true;
    if (net.guestExertConfirmed) applyBothExertAndEnterPlanning();
    else {
      window.state.phase = 'net_wait_exert';
      setBattleWaitMessage('Waiting for opponent to confirm exert...');
      if (typeof window.updateUI === 'function') window.updateUI();
      scheduleHostSnapshot('host_exert_confirm');
    }
  }

  function applyPivotForSide(side) {
    const st = window.state?.[side];
    if (!st) return null;
    if ((st.stam || 0) < 1) return null;

    const flashMoment = Number(window.state.flashMoment);
    if (!Number.isFinite(flashMoment) || flashMoment < 0 || flashMoment > 4) return null;

    st.stam -= 1; // Pivot tax
    const data = getCardDataForSide(side, flashMoment);

    let startIndex = flashMoment;
    let momentsFreed = 1;

    if (data?.card) {
      const c = data.card;
      startIndex = data.startIndex;
      momentsFreed = c.moments || 1;

      st.stam = Math.min(st.maxStam, st.stam + (c.paidCost ?? c.cost ?? 0));

      if (Array.isArray(c.enhancers) && c.enhancers.length > 0) {
        c.enhancers.forEach((enh) => {
          st.stam = Math.min(st.maxStam, st.stam + (enh?.paidCost ?? enh?.cost ?? 0));
          if (enh) {
            delete enh.enhancedTargetId;
            st.hand.push(enh);
          }
        });
        c.enhancers = [];
      }

      if (!c.isBasic) st.hand.push(c);
      for (let i = 0; i < momentsFreed; i++) {
        st.timeline[startIndex + i] = null;
      }
    } else {
      st.timeline[flashMoment] = null;
    }

    const slots = [];
    for (let i = 0; i < momentsFreed; i++) slots.push(startIndex + i);
    return slots;
  }

  function finalizeHostFlashDecisions() {
    clearFlashHighlights();
    hideFlashModal();

    const hostWantsPivot = net.hostFlashDecision === 'pivot';
    const guestWantsPivot = net.guestFlashDecision === 'pivot';

    const hostSlots = hostWantsPivot ? applyPivotForSide('player') : null;
    const guestSlots = guestWantsPivot ? applyPivotForSide('ai') : null;

    if (hostWantsPivot && !hostSlots && typeof window.log === 'function') {
      window.log('[LAN] Host attempted Pivot but could not (insufficient stamina or invalid flash moment).');
    }
    if (guestWantsPivot && !guestSlots && typeof window.log === 'function') {
      window.log('[LAN] Guest attempted Pivot but could not (insufficient stamina or invalid flash moment).');
    }

    window.state.pivotSlots = (hostSlots && hostSlots.length) ? hostSlots : null;
    window.state.aiPivotSlots = (guestSlots && guestSlots.length) ? guestSlots : null;

    const hostDidPivot = !!(window.state.pivotSlots && window.state.pivotSlots.length);
    const guestDidPivot = !!(window.state.aiPivotSlots && window.state.aiPivotSlots.length);

    if (hostDidPivot || guestDidPivot) {
      window.state.phase = 'pivot_wait';
      net.hostPivotLocked = !hostDidPivot;
      net.guestPivotLocked = !guestDidPivot;

      if (typeof window.log === 'function') {
        if (hostDidPivot) window.log('[LAN] Host pivoted. Rebuild your highlighted slots, then lock.');
        if (guestDidPivot) window.log('[LAN] Guest pivoted and is replanning.');
      }

      if (typeof window.renderPlayerTimeline === 'function') window.renderPlayerTimeline();
      if (typeof window.renderAITimeline === 'function') window.renderAITimeline();
      if (typeof window.updateUI === 'function') window.updateUI();
      paintLocalPivotGlow();
      scheduleHostSnapshot('pivot_wait_start');

      if (net.hostPivotLocked && net.guestPivotLocked) {
        hostBeginResolutionNow();
      }
      return;
    }

    hostBeginResolutionNow();
  }

  function onHostLocalFlashDecision(decision) {
    if (!isHost() || !net.inMatch) return;
    if (window.state.phase !== 'flash') return;
    if (net.hostFlashSubmitted) return;

    net.hostFlashSubmitted = true;
    net.hostFlashDecision = (decision === 'pivot') ? 'pivot' : 'lock';

    hideFlashModal();
    clearFlashHighlights();

    if (net.guestFlashSubmitted) {
      finalizeHostFlashDecisions();
    } else {
      if (typeof window.log === 'function') window.log('[LAN] Host chose. Waiting for guest Flash decision...');
      setBattleWaitMessage('Waiting for opponent flash decision...');
      if (typeof window.updateUI === 'function') window.updateUI();
      scheduleHostSnapshot('host_flash_decision');
    }
  }

  function onHostLocalPivotLock() {
    if (!isHost() || !net.inMatch) return;
    if (window.state.phase !== 'pivot_wait') return;
    if (net.hostPivotLocked) return;

    net.hostPivotLocked = true;
    clearLocalPivotGlow();

    if (net.guestPivotLocked) {
      hostBeginResolutionNow();
    } else {
      if (typeof window.log === 'function') window.log('[LAN] Host pivot locked. Waiting for guest...');
      setBattleWaitMessage('Waiting for opponent to lock pivot...');
      if (typeof window.updateUI === 'function') window.updateUI();
      scheduleHostSnapshot('host_pivot_lock');
    }
  }

  function onHostLocalPlanningLock() {
    if (!isHost() || !net.inMatch) return;
    if (window.state.phase !== 'planning') return;
    if (net.hostPlanningLocked) return;

    net.hostPlanningLocked = true;
    if (net.guestPlanningLocked) {
      hostBeginFlashPhase();
    } else {
      if (typeof window.log === 'function') window.log('[LAN] Host locked. Waiting for guest...');
      setBattleWaitMessage('Waiting for opponent to lock planning...');
      if (typeof window.updateUI === 'function') window.updateUI();
      scheduleHostSnapshot('host_planning_lock');
    }
  }

  function hostBeginFlashPhase() {
    net.hostPlanningLocked = false;
    net.guestPlanningLocked = false;
    net.hostFlashSubmitted = false;
    net.guestFlashSubmitted = false;
    net.hostFlashDecision = null;
    net.guestFlashDecision = null;
    net.hostPivotLocked = false;
    net.guestPivotLocked = false;

    window.state.phase = 'flash';
    setBattleWaitMessage('');
    window.state.pivotSlots = null;
    window.state.aiPivotSlots = null;
    window.state.flashMoment = hostRandInt(5);

    const pData = getCardDataForSide('player', window.state.flashMoment);
    const aData = getCardDataForSide('ai', window.state.flashMoment);

    window.state.originalPCard = cloneFlashRevealCard(pData?.card || null);
    window.state.originalAICard = cloneFlashRevealCard(aData?.card || null);

    applyFlashHighlights(window.state.flashMoment);
    renderFlashModal(window.state.originalPCard, window.state.originalAICard, window.state.flashMoment, true);

    if (typeof window.log === 'function') {
      window.log(`[LAN][PRECOGNITION FLASH] Moment ${window.state.flashMoment + 1} revealed.`);
    }

    if (typeof window.renderPlayerTimeline === 'function') window.renderPlayerTimeline();
    if (typeof window.renderAITimeline === 'function') window.renderAITimeline();
    if (typeof window.updateUI === 'function') window.updateUI();

    scheduleHostSnapshot('flash_start');
  }

  function hostBeginResolutionNow() {
    net.hostPlanningLocked = false;
    net.guestPlanningLocked = false;
    net.hostFlashSubmitted = false;
    net.guestFlashSubmitted = false;
    net.hostFlashDecision = null;
    net.guestFlashDecision = null;
    net.hostPivotLocked = false;
    net.guestPivotLocked = false;

    clearFlashHighlights();
    hideFlashModal();
    clearLocalPivotGlow();

    window.state.pivotSlots = null;
    window.state.aiPivotSlots = null;
    window.state.phase = 'resolution';
    setBattleWaitMessage('');

    if (typeof window.log === 'function') window.log('[LAN] Both players locked. Resolving timeline.');
    document.querySelectorAll('button').forEach((b) => { b.disabled = true; });

    if (typeof window.renderAITimeline === 'function') window.renderAITimeline();
    if (typeof window.updateUI === 'function') window.updateUI();

    scheduleHostSnapshot('resolution_start');

    setTimeout(() => {
      window.state.currentMoment = 0;
      if (typeof window.resolveMoment === 'function') window.resolveMoment();
      scheduleHostSnapshot('resolution_tick_start');
    }, 550);
  }

  function enterGuestMatch(payload) {
    net.inMatch = true;
    net.hostPlanningLocked = false;
    net.guestPlanningLocked = false;
    net.hostExertConfirmed = false;
    net.guestExertConfirmed = false;
    net.hostFlashSubmitted = false;
    net.guestFlashSubmitted = false;
    net.hostFlashDecision = null;
    net.guestFlashDecision = null;
    net.hostPivotLocked = false;
    net.guestPivotLocked = false;
    window.__ssLanPvpMode = { enabled: true, role: 'guest' };

    const cs = document.getElementById('char-select-screen');
    const gs = document.getElementById('game-screen');
    if (cs) cs.style.display = 'none';
    if (gs) gs.style.display = 'flex';

    if (typeof window.setBattleLogDefaultCollapsed === 'function') window.setBattleLogDefaultCollapsed();

    if (typeof window.log === 'function') {
      window.log('[LAN] Match started. Waiting for host snapshot...');
    }

    setStatus(`Connected as guest in room ${net.roomCode}.`);
  }

  function handleInboundEvent(evt) {
    const type = String(evt?.type || '');
    const payload = evt?.payload || {};

    if (isHost()) {
      if (type === 'guest_joined') {
        net.guestConnected = true;
        setStatus(`Guest joined room ${net.roomCode}.`);
        sendEvent('room_state', { roomCode: net.roomCode, guestConnected: true }).catch(() => {});
        sendHostSelectionToGuest();
        return;
      }

      if (type === 'selection_update') {
        applyGuestSelectionOnHost(payload);
        scheduleHostSnapshot('guest_selection_update');
        return;
      }

      if (type === 'guest_action') {
        applyGuestEngineAction(payload.action);
        return;
      }

      if (type === 'exert_confirm') {
        if ((window.state.phase === 'exert' || window.state.phase === 'net_wait_exert') && !net.guestExertConfirmed) {
          net.guestExertConfirmed = true;
          if (net.hostExertConfirmed) applyBothExertAndEnterPlanning();
          else scheduleHostSnapshot('guest_exert_confirm');
        }
        return;
      }

      if (type === 'planning_lock') {
        if (window.state.phase === 'planning' && !net.guestPlanningLocked) {
          net.guestPlanningLocked = true;
          if (net.hostPlanningLocked) hostBeginFlashPhase();
          else scheduleHostSnapshot('guest_planning_lock');
        }
        return;
      }

      if (type === 'flash_decision') {
        if (window.state.phase === 'flash' && !net.guestFlashSubmitted) {
          const decision = (String(payload?.decision || '').toLowerCase() === 'pivot') ? 'pivot' : 'lock';
          net.guestFlashSubmitted = true;
          net.guestFlashDecision = decision;
          if (net.hostFlashSubmitted) finalizeHostFlashDecisions();
          else scheduleHostSnapshot('guest_flash_decision');
        }
        return;
      }

      if (type === 'pivot_lock') {
        if (window.state.phase === 'pivot_wait' && !net.guestPivotLocked) {
          net.guestPivotLocked = true;
          if (net.hostPivotLocked) hostBeginResolutionNow();
          else scheduleHostSnapshot('guest_pivot_lock');
        }
        return;
      }

      return;
    }

    if (isGuest()) {
      if (type === 'room_state') {
        setStatus(`Connected as guest in room ${net.roomCode}. Waiting for host start.`);
        return;
      }

      if (type === 'match_started') {
        enterGuestMatch(payload);
        return;
      }

      if (type === 'snapshot') {
        applyGuestSnapshot(payload);
        return;
      }

      if (type === 'host_selection_update') {
        applyHostSelectionOnGuest(payload);
        return;
      }
    }
  }

  function installHooks() {
    if (!window.EngineRuntime || typeof window.EngineRuntime.dispatch !== 'function') return;
    if (!net.original.dispatch) net.original.dispatch = window.EngineRuntime.dispatch.bind(window.EngineRuntime);
    if (!net.original.startGame && typeof window.startGame === 'function') net.original.startGame = window.startGame;
    if (!net.original.backToMenu && typeof window.backToMenu === 'function') net.original.backToMenu = window.backToMenu;
    if (!net.original.updateUI && typeof window.updateUI === 'function') net.original.updateUI = window.updateUI;
    if (!net.original.selectChar && typeof window.selectChar === 'function') net.original.selectChar = window.selectChar;
    if (!net.original.selectDeck && typeof window.selectDeck === 'function') net.original.selectDeck = window.selectDeck;
    if (!net.original.selectFightChar && typeof window.selectFightChar === 'function') net.original.selectFightChar = window.selectFightChar;
    if (!net.original.fightLockIn && typeof window.fightLockIn === 'function') net.original.fightLockIn = window.fightLockIn;

    window.EngineRuntime.dispatch = function wrappedDispatch(action) {
      const at = window.EngineRuntime.ActionTypes;
      const t = action?.type;

      if (!isActive() || !net.inMatch) {
        return net.original.dispatch(action);
      }

      if (isGuest()) {
        if (t === at.START_RESOLUTION) {
          if (window.state.phase === 'planning') {
            sendEvent('planning_lock', {}).catch(() => {});
          } else if (window.state.phase === 'pivot_wait') {
            sendEvent('pivot_lock', {}).catch(() => {});
          }
          return { ok: true, skipUIRefresh: true };
        }
        if (t === at.LOCK_IN) {
          if (window.state.phase === 'flash') {
            sendEvent('flash_decision', { decision: 'lock' }).catch(() => {});
          }
          return { ok: true, skipUIRefresh: true };
        }
        if (t === at.PIVOT) {
          if (window.state.phase === 'flash') {
            sendEvent('flash_decision', { decision: 'pivot' }).catch(() => {});
          }
          return { ok: true, skipUIRefresh: true };
        }
        if (t === at.CONFIRM_EXERT) {
          net.guestExertConfirmed = true;
          if (window.state.phase === 'exert') window.state.phase = 'net_wait_exert';
          setBattleWaitMessage('Waiting for opponent to confirm exert...');
          if (typeof window.updateUI === 'function') window.updateUI();

          const sendConfirm = () => sendEvent('exert_confirm', {}).catch(() => {});
          sendConfirm();
          // Reliability resend: if one packet is dropped, host still receives confirm.
          setTimeout(() => {
            if (!isGuest() || !net.inMatch) return;
            const ph = window.state?.phase;
            if (ph === 'exert' || ph === 'net_wait_exert') sendConfirm();
          }, 900);
          return { ok: true, skipUIRefresh: true };
        }
        if (t === at.PLACE_CARD_FROM_HAND || t === at.RETURN_CARD_TO_HAND || t === at.ADD_BASIC_ACTION || t === at.USE_ABILITY || t === at.TOGGLE_EXERT_CARD) {
          sendEvent('guest_action', { action: safeJsonClone(action) }).catch(() => {});
          return { ok: true, skipUIRefresh: true };
        }
        return { ok: true, skipUIRefresh: true };
      }

      if (isHost()) {
        if (t === at.START_RESOLUTION) {
          if (window.state.phase === 'planning') onHostLocalPlanningLock();
          else if (window.state.phase === 'pivot_wait') onHostLocalPivotLock();
          return { ok: true, skipUIRefresh: true };
        }
        if (t === at.LOCK_IN) {
          if (window.state.phase === 'flash') onHostLocalFlashDecision('lock');
          return { ok: true, skipUIRefresh: true };
        }
        if (t === at.PIVOT) {
          if (window.state.phase === 'flash') onHostLocalFlashDecision('pivot');
          return { ok: true, skipUIRefresh: true };
        }
        if (t === at.CONFIRM_EXERT) {
          onHostLocalConfirmExert();
          return { ok: true, skipUIRefresh: true };
        }
        if (t === at.TOGGLE_EXERT_CARD && net.hostExertConfirmed) {
          return { ok: true, skipUIRefresh: true };
        }

        const planningLocked = (window.state.phase === 'planning' && net.hostPlanningLocked);
        const pivotLocked = (window.state.phase === 'pivot_wait' && net.hostPivotLocked);
        if ((t === at.PLACE_CARD_FROM_HAND || t === at.RETURN_CARD_TO_HAND || t === at.ADD_BASIC_ACTION || t === at.USE_ABILITY) && (planningLocked || pivotLocked)) {
          return { ok: true, skipUIRefresh: true };
        }

        const res = net.original.dispatch(action);
        scheduleHostSnapshot('host_local_dispatch');
        return res;
      }

      return net.original.dispatch(action);
    };

    window.startGame = function wrappedStartGame() {
      if (!isActive()) return net.original.startGame();
      if (isGuest()) {
        setStatus('Guest cannot start the match. Wait for host.');
        return;
      }

      if (!net.guestConnected) {
        setStatus('Cannot start: no guest joined yet.');
        return;
      }

      const hostSel = getSelectedForLocalPlayer();
      const guestSel = {
        char: net.guestSelection.char || ((typeof window.getSelectedChar === 'function') ? window.getSelectedChar('ai') : null),
        deckId: net.guestSelection.deckId || ((typeof window.getSelectedDeckId === 'function') ? window.getSelectedDeckId('ai') : null)
      };
      if (!guestSel.char) {
        setStatus('Waiting for guest to choose a fighter.');
        return;
      }

      const applyAiChar = net.original.selectChar || window.selectChar;
      const applyAiDeck = net.original.selectDeck || window.selectDeck;
      if (guestSel.char && typeof applyAiChar === 'function') {
        try { applyAiChar('ai', guestSel.char); } catch (e) {}
      }
      if (guestSel.deckId && typeof applyAiDeck === 'function') {
        try { applyAiDeck('ai', guestSel.deckId); } catch (e) {}
      }

      net.inMatch = true;
      window.__ssLanPvpMode = { enabled: true, role: 'host' };
      net.hostPlanningLocked = false;
      net.guestPlanningLocked = false;
      net.hostExertConfirmed = false;
      net.guestExertConfirmed = false;
      net.hostFlashSubmitted = false;
      net.guestFlashSubmitted = false;
      net.hostFlashDecision = null;
      net.guestFlashDecision = null;
      net.hostPivotLocked = false;
      net.guestPivotLocked = false;

      if (window.state) {
        window.state.useDeterministicRng = true;
        if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
          const seedArr = new Uint32Array(1);
          window.crypto.getRandomValues(seedArr);
          window.state.rngSeed = seedArr[0] >>> 0;
        } else {
          window.state.rngSeed = (Date.now() & 0xffffffff) >>> 0;
        }
      }

      net.original.startGame();

      sendEvent('match_started', {
        roomCode: net.roomCode,
        hostSelection: hostSel,
        guestSelection: guestSel
      }).catch(() => {});

      scheduleHostSnapshot('match_started');
      setStatus(`LAN match live in room ${net.roomCode}.`);
    };

    window.backToMenu = function wrappedBackToMenu() {
      if (isActive()) {
        net.inMatch = false;
        net.hostPlanningLocked = false;
        net.guestPlanningLocked = false;
        net.hostExertConfirmed = false;
        net.guestExertConfirmed = false;
        net.hostFlashSubmitted = false;
        net.guestFlashSubmitted = false;
        net.hostFlashDecision = null;
        net.guestFlashDecision = null;
        net.hostPivotLocked = false;
        net.guestPivotLocked = false;
        clearFlashHighlights();
        hideFlashModal();
        clearLocalPivotGlow();
        if (window.state) {
          window.state.pivotSlots = null;
          window.state.aiPivotSlots = null;
        }
        scheduleHostSnapshot('back_to_menu');
      }
      return net.original.backToMenu();
    };

    window.updateUI = function wrappedUpdateUi() {
      const out = net.original.updateUI.apply(this, arguments);
      if (isHost() && net.inMatch) {
        const ph = window.state?.phase;
        if (ph === 'resolution' || ph === 'flash' || ph === 'pivot_wait') {
          const now = Date.now();
          if (now - lastUiSnapshotAt >= 120) {
            lastUiSnapshotAt = now;
            scheduleHostSnapshot('ui_tick');
          }
        }
      }
      return out;
    };

    if (net.original.selectChar) {
      window.selectChar = function wrappedSelectChar() {
        const target = arguments[0];
        if (isActive() && !net.inMatch && target === 'ai') {
          if (isHost()) {
            setStatus('In LAN PvP, opponent selection comes from the guest device.');
          }
          return;
        }
        const out = net.original.selectChar.apply(this, arguments);
        if (isGuest() && !net.inMatch) sendLocalSelectionToHost();
        if (isHost() && !net.inMatch && target === 'player') sendHostSelectionToGuest();
        return out;
      };
    }
    if (net.original.selectDeck) {
      window.selectDeck = function wrappedSelectDeck() {
        const target = arguments[0];
        if (isActive() && !net.inMatch && target === 'ai') {
          if (isHost()) {
            setStatus('In LAN PvP, opponent deck comes from the guest device.');
          }
          return;
        }
        const out = net.original.selectDeck.apply(this, arguments);
        if (isGuest() && !net.inMatch) sendLocalSelectionToHost();
        if (isHost() && !net.inMatch && target === 'player') sendHostSelectionToGuest();
        return out;
      };
    }
    if (net.original.selectFightChar) {
      window.selectFightChar = function wrappedSelectFightChar() {
        const out = net.original.selectFightChar.apply(this, arguments);
        if (isGuest() && !net.inMatch) sendLocalSelectionToHost();
        if (isHost() && !net.inMatch) sendHostSelectionToGuest();
        return out;
      };
    }
    if (net.original.fightLockIn) {
      window.fightLockIn = function wrappedFightLockIn() {
        if (isGuest() && !net.inMatch) {
          setStatus('In LAN PvP, just choose your fighter. Host handles match start.');
          return;
        }
        return net.original.fightLockIn.apply(this, arguments);
      };
    }
  }

  function init() {
    bindUi();
    installHooks();
    window.__ssLanPvpMode = { enabled: false, role: null };

    window.Netplay = {
      toggleLanPanel,
      isActive,
      isHost,
      isGuest,
      getMode: () => net.mode,
      getRole: () => net.role,
      getRoomCode: () => net.roomCode,
      isInMatch: () => !!net.inMatch,
      reset: resetNetState,
      debugState: () => safeJsonClone({
        mode: net.mode,
        role: net.role,
        roomCode: net.roomCode,
        inMatch: net.inMatch,
        hostPlanningLocked: net.hostPlanningLocked,
        guestPlanningLocked: net.guestPlanningLocked,
        hostExertConfirmed: net.hostExertConfirmed,
        guestExertConfirmed: net.guestExertConfirmed,
        hostFlashSubmitted: net.hostFlashSubmitted,
        guestFlashSubmitted: net.guestFlashSubmitted,
        hostFlashDecision: net.hostFlashDecision,
        guestFlashDecision: net.guestFlashDecision,
        hostPivotLocked: net.hostPivotLocked,
        guestPivotLocked: net.guestPivotLocked,
        guestConnected: net.guestConnected
      })
    };
  }

  window.addEventListener('load', init);
})();






























