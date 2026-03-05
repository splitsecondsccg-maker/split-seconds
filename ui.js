function renderHand() {

    const handEl = document.getElementById('player-hand');
    handEl.innerHTML = '';

    const total = state.player.hand.length;
    const center = (total - 1) / 2;

    const fanSpread = 16;
    const fanOffset = 70;

    state.player.hand.forEach((card, index) => {

        const div = document.createElement('div');
        div.className = 'card';
        if (card.type === 'enhancer') div.classList.add('enhancer-card');

        // fan positioning
        const angle = (index - center) * fanSpread;
        const x = (index - center) * fanOffset;
        const y = Math.abs(index - center) * 6;

        div.dataset.handIndex = String(index);
        div.dataset.baseX = String(x);
        div.dataset.baseY = String(y);

        div.style.setProperty("--tx", `${x}px`);
        div.style.setProperty("--ty", `${y}px`);
        div.style.setProperty("--rot", `${angle}deg`);
        div.style.setProperty("--scale", `0.88`);

        if (card.selectedForExert) {
            div.style.boxShadow = '0 0 12px 4px #ff4757';
            div.style.borderColor = '#ff4757';
        }

        if (state.phase === 'planning' || state.phase === 'pivot_wait') {

            if (!window.isTouch) {

                div.draggable = true;

                div.ondragstart = (e) =>
                    e.dataTransfer.setData(
                        'text/plain',
                        JSON.stringify({ source: 'hand', index })
                    );
            } else {

                div.addEventListener("touchstart", (e) => {
                    startTouchDrag(e, div, index);
                }, { passive: false });

            }

        } else if (state.phase === 'exert') {

            div.style.cursor = 'pointer';
            div.onclick = () => toggleExertCard(index);

        }

        div.innerHTML = `
            <div class="card-header"><span>${getIcon(card.type)}</span> <span>${card.name}</span></div>
            <div class="card-stats"><span>${card.type === 'enhancer' ? 'ENH' : `⏱ ${card.moments}`}</span><span>⚡ ${getMoveCost('player', card)}</span></div>
            <div class="card-desc">${formatKeywords(card.desc ? card.desc : '')}</div>
            ${card.dmg > 0 ? `<div class="card-dmg">${card.dmg} DMG</div>` : ''}
        `;

        handEl.appendChild(div);

    });

    bindHandHover();
}



// HAND HOVER MANAGER (desktop) — avoids hovered card blocking others
let _handHoverBound = false;
function bindHandHover(){
    if(_handHoverBound) return;
    const handEl = document.getElementById('player-hand');
    if(!handEl) return;
    _handHoverBound = true;

    // Hysteresis (no RAF) to prevent flicker when the cursor is between cards.
    let lastBest = null;
    let lastBestScore = Infinity;

    function clear(){
        handEl.querySelectorAll('.card.hovered').forEach(c=>c.classList.remove('hovered'));
        lastBest = null;
        lastBestScore = Infinity;
    }

    function applyHoverFromMouse(clientX, clientY){
        if(window.isTouch) return;
        if(state.phase !== 'planning' && state.phase !== 'pivot_wait') { clear(); return; }

        const cards = Array.from(handEl.querySelectorAll('.card'));
        if(!cards.length) return;

        let best = null;
        let bestScore = Infinity;

        for(const c of cards){
            const baseX = Number(c.dataset.baseX || 0);
            // Cards are arranged horizontally; pick by nearest X to avoid hover flicker when cards scale/lift.
            const dx = clientX - (handEl.getBoundingClientRect().left + handEl.getBoundingClientRect().width/2 + baseX);
            const score = dx*dx;
            if(score < bestScore){ bestScore = score; best = c; }
        }

        // Stronger hysteresis to avoid edge flicker, but still feels responsive.
        if(lastBest && best && best !== lastBest){
            const SWITCH_THRESHOLD = 0.62; // new must be much better to steal hover
            if(bestScore > lastBestScore * SWITCH_THRESHOLD){
                best = lastBest;
                bestScore = lastBestScore;
            }
        }

        lastBest = best;
        lastBestScore = bestScore;

        for(const c of cards){
            if(c === best) c.classList.add('hovered');
            else c.classList.remove('hovered');
        }
    }

    document.addEventListener('mousemove', (e) => {
        if(window.isTouch) return;
        const t = e.target;
        // Keep hover stable even if the hovered card lifts outside the hand box.
        if(t && (t.closest('#player-hand'))){
            applyHoverFromMouse(e.clientX, e.clientY);
        } else {
            clear();
        }
    }, { passive:true });
}

function dispatchPlaceFromHandToMoment(handIndex, startMoment, targetTimelineIndex = null) {
    if (!window.EngineRuntime) return;
    const card = state.player.hand?.[handIndex];
    if (!card) return;

    const payload = { handIndex, startMoment };
    if (card.type === 'enhancer') {
        if (Number.isFinite(Number(targetTimelineIndex))) {
            payload.targetTimelineIndex = Number(targetTimelineIndex);
        } else {
            const data = (typeof getCardData === 'function') ? getCardData('player', startMoment) : null;
            if (!data || !data.card) {
                if (typeof alert === 'function') alert('Enhancer cards must be dropped on an existing timeline action.');
                return;
            }
            payload.targetTimelineIndex = data.startIndex;
        }
    }

    window.EngineRuntime.dispatch({
        type: window.EngineRuntime.ActionTypes.PLACE_CARD_FROM_HAND,
        payload
    });
}
// TOUCH DRAG SYSTEM

let touchDrag = null;

function startTouchDrag(e, card, index) {

    e.preventDefault();

    const rect = card.getBoundingClientRect();

    touchDrag = {
        index,
        offsetX: e.touches[0].clientX - rect.left,
        offsetY: e.touches[0].clientY - rect.top,
        card: card.cloneNode(true)
    };

    touchDrag.card.classList.add("touch-drag-card");

    document.body.appendChild(touchDrag.card);

    moveTouchCard(e.touches[0]);

    document.addEventListener("touchmove", touchMove, { passive: false });
    document.addEventListener("touchend", touchEnd);
}

function touchMove(e) {
    e.preventDefault();
    moveTouchCard(e.touches[0]);
}

function moveTouchCard(touch) {

    if (!touchDrag) return;

    const x = touch.clientX - touchDrag.offsetX;
    const y = touch.clientY - touchDrag.offsetY;

    touchDrag.card.style.left = x + "px";
    touchDrag.card.style.top = y + "px";
}

function touchEnd(e) {

    if (!touchDrag) return;

    const touch = e.changedTouches[0];

    const target = document.elementFromPoint(
        touch.clientX,
        touch.clientY
    );

    const actionCard = target?.closest(".timeline-card.player-placed");
    const slot = target?.closest(".slot");

    if (actionCard) {
        const targetIndex = Number(actionCard.dataset.timelineIndex);
        dispatchPlaceFromHandToMoment(touchDrag.index, targetIndex, targetIndex);
    } else if (slot) {
        const startMoment = parseInt(slot.dataset.moment) - 1;
        dispatchPlaceFromHandToMoment(touchDrag.index, startMoment);
    }

    touchDrag.card.remove();
    touchDrag = null;

    document.removeEventListener("touchmove", touchMove);
    document.removeEventListener("touchend", touchEnd);
}


const pSlots = document.querySelectorAll('#player-timeline .slot');
pSlots.forEach(slot => {
    slot.addEventListener("dragenter", () => {
        slot.classList.add("slot-hover");
    });

    slot.addEventListener("dragleave", () => {
        slot.classList.remove("slot-hover");
    });

    slot.addEventListener("drop", () => {
        slot.classList.remove("slot-hover");
    });

    slot.addEventListener('dragover', e => e.preventDefault());
    slot.addEventListener('drop', e => {
        e.preventDefault(); 
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        if(data.source !== 'hand') return;
        
        const startMoment = parseInt(slot.dataset.moment) - 1;
        dispatchPlaceFromHandToMoment(data.index, startMoment);
    });
});

const playerTimeline = document.getElementById('player-timeline');
playerTimeline?.addEventListener('dragover', e => {
    // Must always allow drop on visible timeline card; some browsers block getData during dragover.
    if (e.target?.closest('.timeline-card.player-placed')) {
        e.preventDefault();
    }
});

playerTimeline?.addEventListener('drop', e => {
    const actionEl = e.target?.closest('.timeline-card.player-placed');
    if (!actionEl) return;
    const dataText = e.dataTransfer?.getData('text/plain');
    if (!dataText) return;
    let data;
    try { data = JSON.parse(dataText); } catch { return; }
    if (data.source !== 'hand') return;
    const card = state.player.hand?.[data.index];
    if (card?.type !== 'enhancer') return;

    e.preventDefault();
    const targetIdx = Number(actionEl.dataset.timelineIndex);
    if (!Number.isFinite(targetIdx)) return;
    dispatchPlaceFromHandToMoment(data.index, targetIdx, targetIdx);
});
const handZone = document.getElementById('player-hand');
handZone.addEventListener('dragover', e => e.preventDefault());
handZone.addEventListener('drop', e => {
    e.preventDefault(); 
    if(state.phase !== 'planning' && state.phase !== 'pivot_wait') return; // UPDATED
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    if(data.source === 'timeline') returnToHand(data.index);
});

function returnToHand(index) {
    if (!window.EngineRuntime) return;
    window.EngineRuntime.dispatch({
        type: window.EngineRuntime.ActionTypes.RETURN_CARD_TO_HAND,
        payload: { timelineIndex: index }
    });
}

function addBasicAction(name, cost, moments, dmg, type) {
    if (!window.EngineRuntime) return;
    window.EngineRuntime.dispatch({
        type: window.EngineRuntime.ActionTypes.ADD_BASIC_ACTION,
        payload: { name, cost, moments, dmg, type }
    });
}

function getEnhancerUiInfo(card) {
    const enhancers = Array.isArray(card?.enhancers) ? card.enhancers : [];
    if (!enhancers.length) return { inline: '', title: '' };

    const names = enhancers.map(e => `${e.name} (+${e?.enhance?.dmg || 0})`).join(', ');
    const dmg = enhancers.reduce((sum, e) => sum + (e?.enhance?.dmg || 0), 0);
    const chips = enhancers.map(e => `<span class="enhancer-chip">${e.name} +${e?.enhance?.dmg || 0}</span>`).join('');

    return {
        inline: `
            <div class="enhancer-badge">Enhancers: +${dmg} DMG (${enhancers.length})</div>
            <div class="enhancer-chips">${chips}</div>
        `,
        title: `\nEnhancers: ${names}`
    };
}
function renderPlayerTimeline() {
    const tl = document.getElementById('player-timeline'); document.querySelectorAll('.player-placed').forEach(e => e.remove());
    let start = -1;
    for(let i=0; i<5; i++) {
        let t = state.player.timeline[i];
        if(t !== null && t !== 'occupied' && start === -1) {
            let m = t.moments; let width = (m * 20) + ((m-1)*2); let left = ((i - m + 1) * 20);
            let div = document.createElement('div'); div.className = 'timeline-card player-placed'; div.id = `p-card-mom-${i+1}`;
            div.dataset.timelineIndex = String(i);
            if (Array.isArray(t.enhancers) && t.enhancers.length > 0) div.classList.add('has-enhancer');
            div.style.left = `calc(${left}% + 10px)`; div.style.width = `calc(${width}% - 20px)`; 
            
            const enhInfo = getEnhancerUiInfo(t);
            div.draggable = true; div.style.cursor = 'pointer'; div.title = "Click or drag to hand to remove" + enhInfo.title;
            div.ondragstart = (e) => e.dataTransfer.setData('text/plain', JSON.stringify({source: 'timeline', index: i}));
            div.onclick = () => returnToHand(i);

            let extraText = '';
            if(t.dmg > 0) extraText = `<span style="color:#ffcccc; font-weight:bold;">${t.dmg} DMG</span>`;
            else if(t.type === 'block') extraText = `<span style="color:#ccffff; font-weight:bold;">🛡️ Block</span>`;
            else if(t.type === 'parry') extraText = `<span style="color:#ccffff; font-weight:bold;">🤺 Parry</span>`;
            else extraText = `<span style="color:#ccffcc; font-weight:bold;">✨ ${t.type}</span>`;

            let icon = getIcon(t.type);
            div.innerHTML = `<strong>${t.name}</strong>${t.desc ? `<div class="card-desc-timeline">${formatKeywords(t.desc)}</div>` : ''}${enhInfo.inline}<div>${icon} ${extraText}</div>`;
            tl.appendChild(div);
        }
    }
}

function renderAITimeline() {
    // Fog of war: AI timeline must stay hidden while the player is still planning,
    // including the post-PIVOT adjustment window (pivot_wait). Otherwise the player
    // can gain information before pressing LOCK.
    const isHidden = (state.phase === 'planning' || state.phase === 'pivot_wait');
    const tl = document.getElementById('ai-timeline');
    document.querySelectorAll('.ai-placed').forEach(e => e.remove());
    
    if(isHidden) return;

    for(let i=0; i<5; i++) {
        let t = state.ai.timeline[i];
        if(t !== null && t !== 'occupied') {
            let m = t.moments; let width = (m * 20) + ((m-1)*2); let left = ((i - m + 1) * 20);
            let div = document.createElement('div'); div.className = 'timeline-card ai-placed ai-timeline-card'; div.id = `ai-card-mom-${i+1}`;
            div.dataset.timelineIndex = String(i);
            if (Array.isArray(t.enhancers) && t.enhancers.length > 0) div.classList.add('has-enhancer');
            div.style.left = `calc(${left}% + 10px)`; div.style.width = `calc(${width}% - 20px)`; 

            let extraText = '';
            if(t.dmg > 0) extraText = `<span style="color:#ffcccc; font-weight:bold;">${t.dmg} DMG</span>`;
            else if(t.type === 'block') extraText = `<span style="color:#ccffff; font-weight:bold;">🛡️ Block</span>`;
            else if(t.type === 'parry') extraText = `<span style="color:#ccffff; font-weight:bold;">🤺 Parry</span>`;
            else extraText = `<span style="color:#ccffcc; font-weight:bold;">✨ ${t.type}</span>`;

            const enhInfo = getEnhancerUiInfo(t);
            let icon = getIcon(t.type);
            div.innerHTML = `<strong>${t.name}</strong>${t.desc ? `<div class="card-desc-timeline">${formatKeywords(t.desc)}</div>` : ''}${enhInfo.inline}<div>${icon} ${extraText}</div>`;
            tl.appendChild(div);
        }
    }
}





/* -------------------------------
   Keyword tooltip manager (global)
   Fixes:
   - Tooltip is never clipped/covered by neighboring cards (rendered in body)
   - Works in Active Effects box too (event delegation on .keyword)
---------------------------------*/
(function initKeywordTooltips() {
    if (window.__ssKeywordTooltipInstalled) return;
    window.__ssKeywordTooltipInstalled = true;

    const tipEl = document.createElement('div');
    tipEl.className = 'ss-keyword-tooltip';
    document.body.appendChild(tipEl);

    let activeKeyword = null;

    function position(e) {
        const pad = 12;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Default: to the right & slightly below cursor
        let x = e.clientX + pad;
        let y = e.clientY + pad;

        // Measure
        tipEl.style.left = '0px';
        tipEl.style.top = '0px';
        const rect = tipEl.getBoundingClientRect();

        // Clamp within viewport
        if (x + rect.width + pad > vw) x = Math.max(pad, e.clientX - rect.width - pad);
        if (y + rect.height + pad > vh) y = Math.max(pad, e.clientY - rect.height - pad);

        tipEl.style.left = `${x}px`;
        tipEl.style.top = `${y}px`;
    }

    function show(el, e) {
        const tip = el.getAttribute('data-tip') || '';
        if (!tip.trim()) return;
        activeKeyword = el;
        tipEl.textContent = tip;
        tipEl.classList.add('is-visible');
        position(e);
    }

    function hide() {
        activeKeyword = null;
        tipEl.classList.remove('is-visible');
    }

    document.addEventListener('mousemove', (e) => {
        if (!activeKeyword) return;
        position(e);
    });

    // Event delegation: works anywhere in the UI.
    document.addEventListener('mouseover', (e) => {
        const el = e.target && e.target.closest ? e.target.closest('.keyword') : null;
        if (!el) return;
        show(el, e);
    });

    document.addEventListener('mouseout', (e) => {
        if (!activeKeyword) return;
        // If moving within the same keyword span, ignore.
        const toEl = e.relatedTarget;
        if (toEl && activeKeyword.contains(toEl)) return;
        // If moving to another keyword, the next mouseover will handle it.
        const nextKeyword = toEl && toEl.closest ? toEl.closest('.keyword') : null;
        if (nextKeyword) return;
        hide();
    });

    window.addEventListener('scroll', () => {
        if (!activeKeyword) return;
        // On scroll, just hide to avoid “stale” position.
        hide();
    }, true);
})();

