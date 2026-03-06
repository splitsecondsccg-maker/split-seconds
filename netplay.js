// netplay.js
// LAN PvP host/guest runtime for Split Seconds.

(function () {
  'use strict';

  const API_BASE = '/api/room';

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

    ui: {
      roomInput: null,
      hostBtn: null,
      joinBtn: null,
      leaveBtn: null,
      status: null
    },

    original: {
      dispatch: null,
      startGame: null,
      backToMenu: null,
      updateUI: null,
      selectChar: null,
      selectDeck: null
    }
  };

  let snapshotScheduled = false;

  function isHost() { return net.mode === 'lan-host'; }
  function isGuest() { return net.mode === 'lan-guest'; }
  function isActive() { return isHost() || isGuest(); }

  function setStatus(msg) {
    if (net.ui.status) net.ui.status.textContent = msg || '';
  }

  function safeJsonClone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  async function fetchJson(url, options) {
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

  async function apiHostRoom(roomCode) {
    const data = await fetchJson(`${API_BASE}/host`, {
      method: 'POST',
      body: { roomCode: roomCode || '' }
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
    sendLocalSelectionToHost();
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
    net.pollTimer = setInterval(pollOnce, 420);
  }

  function bindUi() {
    net.ui.roomInput = document.getElementById('lan-room-code');
    net.ui.hostBtn = document.getElementById('lan-host-btn');
    net.ui.joinBtn = document.getElementById('lan-join-btn');
    net.ui.leaveBtn = document.getElementById('lan-leave-btn');
    net.ui.status = document.getElementById('lan-status');

    if (!net.ui.hostBtn || !net.ui.joinBtn || !net.ui.leaveBtn) return;

    net.ui.hostBtn.addEventListener('click', async () => {
      try {
        await apiHostRoom(net.ui.roomInput?.value || '');
        if (net.ui.roomInput) net.ui.roomInput.value = net.roomCode;
      } catch (err) {
        setStatus(`Host failed: ${err.message}`);
      }
    });

    net.ui.joinBtn.addEventListener('click', async () => {
      try {
        await apiJoinRoom(net.ui.roomInput?.value || '');
      } catch (err) {
        setStatus(`Join failed: ${err.message}`);
      }
    });

    net.ui.leaveBtn.addEventListener('click', () => {
      resetNetState();
    });
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

  function applyGuestSelectionOnHost(sel) {
    if (!isHost() || !sel) return;
    const nextChar = String(sel.char || '').trim();
    const nextDeck = String(sel.deckId || '').trim();
    if (!nextChar) return;

    net.guestSelection = { char: nextChar, deckId: nextDeck || null };

    if (typeof window.selectChar === 'function') {
      try { window.selectChar('ai', nextChar); } catch (e) {}
    }
    if (nextDeck && typeof window.selectDeck === 'function') {
      try { window.selectDeck('ai', nextDeck); } catch (e) {}
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
      phase === 'net_wait_exert'
    );

    if (hideTimeline) out.timeline = [null, null, null, null, null];
    return out;
  }

  function buildGuestSnapshotState() {
    const s = window.state;
    const clone = safeJsonClone(s);
    const projected = {
      ...clone,
      player: safeJsonClone(s.ai),
      ai: redactedOpponentForGuest(s.player, s.phase)
    };
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
    return basePhase;
  }

  function applyGuestSnapshot(payload) {
    const nextState = payload?.state;
    if (!nextState) return;

    const phase = guestPhaseOverride(nextState.phase, payload.meta || {});
    nextState.phase = phase;

    replaceStateInPlace(nextState);
    if (typeof window.applyBattleMetaFromState === 'function') {
      window.applyBattleMetaFromState();
    }
    if (typeof window.renderPlayerTimeline === 'function') window.renderPlayerTimeline();
    if (typeof window.renderAITimeline === 'function') window.renderAITimeline();
    if (typeof window.updateUI === 'function') window.updateUI();
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
        roomCode: net.roomCode
      }
    };
    try {
      await sendEvent('snapshot', payload);
    } catch (err) {
      setStatus(`Snapshot send failed: ${err.message}`);
    }
  }

  function canApplyPlanningActionForSide(side) {
    if (window.state.phase !== 'planning') return false;
    if (side === 'player' && net.hostPlanningLocked) return false;
    if (side === 'ai' && net.guestPlanningLocked) return false;
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
    net.hostExertConfirmed = false;
    net.guestExertConfirmed = false;
    net.hostPlanningLocked = false;
    net.guestPlanningLocked = false;

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
      if (typeof window.updateUI === 'function') window.updateUI();
      scheduleHostSnapshot('host_exert_confirm');
    }
  }

  function onHostLocalPlanningLock() {
    if (!isHost() || !net.inMatch) return;
    if (window.state.phase !== 'planning') return;
    if (net.hostPlanningLocked) return;

    net.hostPlanningLocked = true;
    if (net.guestPlanningLocked) {
      hostBeginResolutionNow();
    } else {
      if (typeof window.log === 'function') window.log('[LAN] Host locked. Waiting for guest...');
      if (typeof window.updateUI === 'function') window.updateUI();
      scheduleHostSnapshot('host_planning_lock');
    }
  }

  function hostBeginResolutionNow() {
    net.hostPlanningLocked = false;
    net.guestPlanningLocked = false;

    window.state.phase = 'resolution';
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
    window.__ssLanPvpMode = { enabled: true, role: 'guest' };

    const cs = document.getElementById('char-select-screen');
    const gs = document.getElementById('game-screen');
    if (cs) cs.style.display = 'none';
    if (gs) gs.style.display = 'flex';

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
        if (window.state.phase === 'exert' && !net.guestExertConfirmed) {
          net.guestExertConfirmed = true;
          if (net.hostExertConfirmed) applyBothExertAndEnterPlanning();
          else scheduleHostSnapshot('guest_exert_confirm');
        }
        return;
      }

      if (type === 'planning_lock') {
        if (window.state.phase === 'planning' && !net.guestPlanningLocked) {
          net.guestPlanningLocked = true;
          if (net.hostPlanningLocked) hostBeginResolutionNow();
          else scheduleHostSnapshot('guest_planning_lock');
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

    window.EngineRuntime.dispatch = function wrappedDispatch(action) {
      const at = window.EngineRuntime.ActionTypes;
      const t = action?.type;

      if (!isActive() || !net.inMatch) {
        return net.original.dispatch(action);
      }

      if (isGuest()) {
        if (t === at.START_RESOLUTION) {
          sendEvent('planning_lock', {}).catch(() => {});
          return { ok: true, skipUIRefresh: true };
        }
        if (t === at.CONFIRM_EXERT) {
          sendEvent('exert_confirm', {}).catch(() => {});
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
          onHostLocalPlanningLock();
          return { ok: true, skipUIRefresh: true };
        }
        if (t === at.CONFIRM_EXERT) {
          onHostLocalConfirmExert();
          return { ok: true, skipUIRefresh: true };
        }
        if (t === at.TOGGLE_EXERT_CARD && net.hostExertConfirmed) {
          return { ok: false, error: 'Already confirmed exert.', skipUIRefresh: true };
        }
        if ((t === at.PLACE_CARD_FROM_HAND || t === at.RETURN_CARD_TO_HAND || t === at.ADD_BASIC_ACTION || t === at.USE_ABILITY) && net.hostPlanningLocked) {
          return { ok: false, error: 'Already locked.', skipUIRefresh: true };
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

      if (guestSel.char && typeof window.selectChar === 'function') {
        try { window.selectChar('ai', guestSel.char); } catch (e) {}
      }
      if (guestSel.deckId && typeof window.selectDeck === 'function') {
        try { window.selectDeck('ai', guestSel.deckId); } catch (e) {}
      }

      net.inMatch = true;
      window.__ssLanPvpMode = { enabled: true, role: 'host' };
      net.hostPlanningLocked = false;
      net.guestPlanningLocked = false;
      net.hostExertConfirmed = false;
      net.guestExertConfirmed = false;

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
        scheduleHostSnapshot('back_to_menu');
      }
      return net.original.backToMenu();
    };

    window.updateUI = function wrappedUpdateUi() {
      const out = net.original.updateUI.apply(this, arguments);
      if (isHost() && net.inMatch) scheduleHostSnapshot('update_ui');
      return out;
    };

    if (net.original.selectChar) {
      window.selectChar = function wrappedSelectChar() {
        const out = net.original.selectChar.apply(this, arguments);
        if (isGuest() && !net.inMatch) sendLocalSelectionToHost();
        return out;
      };
    }
    if (net.original.selectDeck) {
      window.selectDeck = function wrappedSelectDeck() {
        const out = net.original.selectDeck.apply(this, arguments);
        if (isGuest() && !net.inMatch) sendLocalSelectionToHost();
        return out;
      };
    }
  }

  function init() {
    bindUi();
    installHooks();
    window.__ssLanPvpMode = { enabled: false, role: null };

    window.Netplay = {
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
        guestConnected: net.guestConnected
      })
    };
  }

  window.addEventListener('load', init);
})();
