function renderHand() {
    const handEl = document.getElementById('player-hand'); handEl.innerHTML = '';
    state.player.hand.forEach((card, index) => {
        let div = document.createElement('div'); 
        div.className = 'card'; 
        
        // Add red glow if selected
        if (card.selectedForExert) {
            div.style.boxShadow = '0 0 12px 4px #ff4757';
            div.style.borderColor = '#ff4757';
            div.style.transform = 'translateY(-5px)';
        }

        if (state.phase === 'planning' || state.phase === 'pivot_wait') {
            div.draggable = true;
            // Send only an index instead of the full object (avoids stale copies)
            div.ondragstart = (e) => e.dataTransfer.setData('text/plain', JSON.stringify({source: 'hand', index}));
        } else if (state.phase === 'exert') {
            div.draggable = false;
            div.style.cursor = 'pointer';
            div.onclick = () => toggleExertCard(index);
        }
        
        div.innerHTML = `
            <div class="card-header"><span>${getIcon(card.type)}</span> <span>${card.name}</span></div>
            <div class="card-stats"><span>⏱ ${card.moments}</span><span>⚡ ${getMoveCost('player', card)}</span></div>
            <div class="card-desc">${formatKeywords(card.desc ? card.desc : '')}</div>
            ${card.dmg > 0 ? `<div class="card-dmg">${card.dmg} DMG</div>` : ''}
        `;
        handEl.appendChild(div);
    });
}

const pSlots = document.querySelectorAll('#player-timeline .slot');
pSlots.forEach(slot => {
    slot.addEventListener('dragover', e => e.preventDefault());
    slot.addEventListener('drop', e => {
        e.preventDefault(); 
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        if(data.source !== 'hand') return;
        
        const startMoment = parseInt(slot.dataset.moment) - 1;

        if (!window.EngineRuntime) return;
        window.EngineRuntime.dispatch({
            type: window.EngineRuntime.ActionTypes.PLACE_CARD_FROM_HAND,
            payload: { handIndex: data.index, startMoment },
        });
    });
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

function renderPlayerTimeline() {
    const tl = document.getElementById('player-timeline'); document.querySelectorAll('.player-placed').forEach(e => e.remove());
    let start = -1;
    for(let i=0; i<5; i++) {
        let t = state.player.timeline[i];
        if(t !== null && t !== 'occupied' && start === -1) {
            let m = t.moments; let width = (m * 20) + ((m-1)*2); let left = ((i - m + 1) * 20);
            let div = document.createElement('div'); div.className = 'timeline-card player-placed'; div.id = `p-card-mom-${i+1}`;
            div.style.left = `calc(${left}% + 10px)`; div.style.width = `calc(${width}% - 20px)`; 
            
            div.draggable = true; div.style.cursor = 'pointer'; div.title = "Click or drag to hand to remove";
            div.ondragstart = (e) => e.dataTransfer.setData('text/plain', JSON.stringify({source: 'timeline', index: i}));
            div.onclick = () => returnToHand(i);

            let extraText = '';
            if(t.dmg > 0) extraText = `<span style="color:#ffcccc; font-weight:bold;">${t.dmg} DMG</span>`;
            else if(t.type === 'block') extraText = `<span style="color:#ccffff; font-weight:bold;">🛡️ Block</span>`;
            else if(t.type === 'parry') extraText = `<span style="color:#ccffff; font-weight:bold;">🤺 Parry</span>`;
            else extraText = `<span style="color:#ccffcc; font-weight:bold;">✨ ${t.type}</span>`;

            let icon = getIcon(t.type);
            div.innerHTML = `<strong>${t.name}</strong>${t.desc ? `<div class="card-desc-timeline">${formatKeywords(t.desc)}</div>` : ''}<div>${icon} ${extraText}</div>`;
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
            div.style.left = `calc(${left}% + 10px)`; div.style.width = `calc(${width}% - 20px)`; 

            let extraText = '';
            if(t.dmg > 0) extraText = `<span style="color:#ffcccc; font-weight:bold;">${t.dmg} DMG</span>`;
            else if(t.type === 'block') extraText = `<span style="color:#ccffff; font-weight:bold;">🛡️ Block</span>`;
            else if(t.type === 'parry') extraText = `<span style="color:#ccffff; font-weight:bold;">🤺 Parry</span>`;
            else extraText = `<span style="color:#ccffcc; font-weight:bold;">✨ ${t.type}</span>`;

            let icon = getIcon(t.type);
            div.innerHTML = `<strong>${t.name}</strong>${t.desc ? `<div class="card-desc-timeline">${formatKeywords(t.desc)}</div>` : ''}<div>${icon} ${extraText}</div>`;
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
