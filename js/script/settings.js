/* === js/script/settings.js - MEGA CONFIGURADOR PRO VFINAL (BLINDADO) === */

window.NOTE_SHAPES = ['circle', 'diamond', 'bar', 'ring'];

window.getShapeSvg = function(shapeName, color) {
    let s = shapeName || 'circle', c = color || '#00ffff';
    switch(s) {
        case 'circle': return `<svg viewBox="0 0 100 100" style="width:100%; height:100%; filter:drop-shadow(0 0 5px ${c});"><circle cx="50" cy="50" r="40" fill="${c}" stroke="white" stroke-width="5"/></svg>`;
        case 'diamond': return `<svg viewBox="0 0 100 100" style="width:100%; height:100%; filter:drop-shadow(0 0 5px ${c});"><polygon points="50,10 90,50 50,90 10,50" fill="${c}" stroke="white" stroke-width="5"/></svg>`;
        case 'bar': return `<svg viewBox="0 0 100 100" style="width:100%; height:100%; filter:drop-shadow(0 0 5px ${c});"><rect x="15" y="35" width="70" height="30" rx="10" fill="${c}" stroke="white" stroke-width="5"/></svg>`;
        case 'ring': return `<svg viewBox="0 0 100 100" style="width:100%; height:100%; filter:drop-shadow(0 0 5px ${c});"><circle cx="50" cy="50" r="35" fill="none" stroke="${c}" stroke-width="15"/></svg>`;
        default: return `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="${c}"/></svg>`;
    }
};

window.loadSettings = function() {
    if (!window.cfg) window.cfg = {};
    if (!window.cfg.modes) window.cfg.modes = {};

    let saved = localStorage.getItem('gameCfg');
    if (saved) {
        try { 
            let parsed = JSON.parse(saved);
            for (let key in parsed) {
                if (key === 'modes') {
                    for (let k in parsed.modes) window.cfg.modes[k] = parsed.modes[k];
                } else { window.cfg[key] = parsed[key]; }
            }
        } catch(e) { console.warn("Error leyendo settings"); }
    }

    const defKeys = { 4:['d','f','j','k'], 5:['d','f',' ','j','k'], 6:['s','d','f','j','k','l'], 7:['s','d','f',' ','j','k','l'], 9:['a','s','d','f',' ','h','j','k','l'] };
    for(let k = 1; k <= 10; k++) {
        if(!window.cfg.modes[k] || window.cfg.modes[k].length !== k) {
            window.cfg.modes[k] = [];
            let kArr = defKeys[k] || ['a','s','d','f','g','h','j','k','l',';'];
            for(let i=0; i<k; i++) window.cfg.modes[k].push({ k: kArr[i]||' ', c: '#00ffff', s: 'circle' });
        }
    }

    const setVal = (id, prop) => { const el=document.getElementById(id); if(el && window.cfg[prop]!==undefined) el.value=window.cfg[prop]; };
    const setChk = (id, prop) => { const el=document.getElementById(id); if(el && window.cfg[prop]!==undefined) el.checked=!!window.cfg[prop]; };
    const setTxt = (id, prop) => { 
        const el=document.getElementById(id); 
        if(el && window.cfg[prop]) {
            let txt = String(window.cfg[prop]).toUpperCase().replace(/KEY/g, '').replace(/DIGIT/g, '').replace(/ARROW/g, '');
            if(txt === ' ' || txt === 'SPACE') txt = 'SPC'; el.innerText = txt; 
        }
    };

    setChk('cfg-perf-mode', 'perfMode'); setChk('cfg-show-fps', 'showFps'); setChk('cfg-subtitles', 'subtitles');
    setVal('cfg-ui-skin', 'uiSkin'); setVal('cfg-spd', 'spd'); setChk('cfg-down', 'down'); setVal('cfg-den', 'den');
    setVal('cfg-fov', 'fov'); setVal('cfg-noteop', 'noteOp'); setVal('cfg-hit-pos', 'hitPos'); setVal('cfg-note-size', 'noteSize');
    setVal('cfg-note-skin', 'noteSkin'); setVal('cfg-std-ar', 'stdAR'); setVal('cfg-std-cs', 'stdCS'); setChk('cfg-std-trail', 'stdTrail');
    setTxt('cfg-std-k1', 'stdK1'); setTxt('cfg-std-k2', 'stdK2'); setVal('cfg-tk-spd', 'tkSpeed');
    setTxt('cfg-tk-dl', 'tkDonL'); setTxt('cfg-tk-dr', 'tkDonR'); setTxt('cfg-tk-kl', 'tkKatsuL'); setTxt('cfg-tk-kr', 'tkKatsuR');
    setVal('cfg-ct-spd', 'ctSpeed'); setVal('cfg-ct-cs', 'ctCS'); setTxt('cfg-ct-l', 'ctLeft'); setTxt('cfg-ct-r', 'ctRight'); setTxt('cfg-ct-d', 'ctDash');
    setVal('cfg-dim', 'bgDim'); setChk('cfg-splash', 'showSplash'); setChk('cfg-show-ms', 'showMs'); setChk('cfg-hide-ui', 'hideUI');
    
    if(document.getElementById('cfg-vol')) document.getElementById('cfg-vol').value = (window.cfg.vol !== undefined ? window.cfg.vol : 0.5) * 100;
    if(document.getElementById('cfg-hvol')) document.getElementById('cfg-hvol').value = (window.cfg.hvol !== undefined ? window.cfg.hvol : 0.8) * 100;
    if(document.getElementById('cfg-mvol')) document.getElementById('cfg-mvol').value = (window.cfg.missVol !== undefined ? window.cfg.missVol : 0.6) * 100;
    setVal('cfg-off', 'off'); setVal('cfg-hitsound', 'hitSound');
    if(typeof window.populateSkinDropdowns === 'function') window.populateSkinDropdowns();
};

window.openSettingsPanel = function() {
    window.loadSettings();
    let modal = document.getElementById('modal-settings');
    if (modal) { modal.style.display = 'flex'; modal.style.zIndex = '9999999'; }
    const select = document.getElementById('kb-mode-select');
    window.renderLaneConfig(parseInt(select ? select.value : 4));
};

window.closeSettingsPanel = function() {
    let modal = document.getElementById('modal-settings');
    if (modal) modal.style.display = 'none';
};

window.saveSettings = function() {
    const getVal = (id) => { const el=document.getElementById(id); return el ? parseFloat(el.value) : 0; };
    const getStr = (id) => { const el=document.getElementById(id); return el ? el.value : 'default'; };
    const getChk = (id) => { const el=document.getElementById(id); return el ? el.checked : false; };

    window.cfg.perfMode = getChk('cfg-perf-mode'); window.cfg.showFps = getChk('cfg-show-fps'); window.cfg.subtitles = getChk('cfg-subtitles');
    window.cfg.uiSkin = getStr('cfg-ui-skin'); window.cfg.spd = getVal('cfg-spd'); window.cfg.down = getChk('cfg-down'); 
    window.cfg.den = getVal('cfg-den'); window.cfg.fov = getVal('cfg-fov'); window.cfg.noteOp = getVal('cfg-noteop'); 
    window.cfg.hitPos = getVal('cfg-hit-pos'); window.cfg.noteSize = getVal('cfg-note-size'); window.cfg.noteSkin = getStr('cfg-note-skin');
    window.cfg.stdAR = getVal('cfg-std-ar'); window.cfg.stdCS = getVal('cfg-std-cs'); window.cfg.stdTrail = getChk('cfg-std-trail');
    window.cfg.tkSpeed = getVal('cfg-tk-spd'); window.cfg.ctSpeed = getVal('cfg-ct-spd'); window.cfg.ctCS = getVal('cfg-ct-cs');
    window.cfg.bgDim = getVal('cfg-dim'); window.cfg.showSplash = getChk('cfg-splash'); window.cfg.showMs = getChk('cfg-show-ms'); window.cfg.hideUI = getChk('cfg-hide-ui');
    
    let volEl = document.getElementById('cfg-vol'); if(volEl) window.cfg.vol = parseFloat(volEl.value) / 100;
    let hvolEl = document.getElementById('cfg-hvol'); if(hvolEl) window.cfg.hvol = parseFloat(hvolEl.value) / 100;
    let mvolEl = document.getElementById('cfg-mvol'); if(mvolEl) window.cfg.missVol = parseFloat(mvolEl.value) / 100;
    window.cfg.off = getVal('cfg-off'); window.cfg.hitSound = getStr('cfg-hitsound');

    localStorage.setItem('gameCfg', JSON.stringify(window.cfg));
    if (typeof window.notify === 'function') window.notify("Ajustes guardados.", "success");
    window.closeSettingsPanel();
};

window.switchSetTab = function(tabId) {
    document.querySelectorAll('.set-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.set-section').forEach(s => s.style.display = 'none');
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
    const tab = document.getElementById(tabId); if(tab) tab.style.display = 'block';
    if(tabId === 'set-mania') window.renderLaneConfig(parseInt(document.getElementById('kb-mode-select').value || 4));
};

window.renderLaneConfig = function(k) {
    k = parseInt(k); if (!k || isNaN(k)) k = 4;
    const cont = document.getElementById('lanes-container'); if(!cont) return;
    if(!window.cfg.modes[k]) window.loadSettings();

    let html = '';
    window.cfg.modes[k].forEach((lane, i) => {
        let kStr = String(lane.k || ''); let keyText = '';
        
        if (kStr === ' ' || kStr.toLowerCase() === 'space') {
            keyText = 'SPC';
        } else {
            keyText = kStr.toUpperCase().replace(/KEY/g, '').replace(/DIGIT/g, '').replace(/ARROW/g, '');
            if (keyText.length > 5) keyText = keyText.substring(0, 4) + '..';
        }

        let shapeSvg = window.getShapeSvg(lane.s, lane.c);

        html += `
        <div class="l-col" style="display:flex; flex-direction:column; align-items:center; gap:15px; margin:0 5px;">
            <button class="key-bind" onclick="window.remapKey(this, ${k}, ${i})" 
                 style="width:70px; height:70px; border:3px solid ${lane.c}; border-radius:15px; font-weight:900; font-size:1.6rem; cursor:pointer; background:#111; color:white; box-shadow:0 0 15px rgba(0,0,0,0.5); overflow:hidden;">
                ${keyText}
            </button>
            <div class="shape-indicator" onclick="window.cycleShape(${k}, ${i})" style="width:40px; height:40px; cursor:pointer;">${shapeSvg}</div>
            <input type="color" value="${lane.c}" onchange="window.updateLaneColor(${k}, ${i}, this.value)" style="width:60px; height:25px; border:none; cursor:pointer; padding:0;">
        </div>`;
    });
    cont.innerHTML = html;
    window.updatePreview(k);
};

window.cycleShape = function(k, laneIdx) {
    if (!window.cfg.modes[k][laneIdx].s) window.cfg.modes[k][laneIdx].s = 'circle';
    let curr = window.cfg.modes[k][laneIdx].s;
    let next = window.NOTE_SHAPES[(window.NOTE_SHAPES.indexOf(curr) + 1) % window.NOTE_SHAPES.length];
    window.cfg.modes[k][laneIdx].s = next;
    window.renderLaneConfig(k);
};

window.updateLaneColor = function(k, laneIdx, newColor) { window.cfg.modes[k][laneIdx].c = newColor; window.renderLaneConfig(k); };

window.remapKey = function(btnElement, k, laneIdx) {
    if(btnElement.dataset.waiting === "true") return;
    btnElement.dataset.waiting = "true";
    btnElement.innerText = "..."; 
    btnElement.style.background = "#F9393F"; 
    btnElement.blur();

    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); z-index:9999999; display:flex; flex-direction:column; justify-content:center; align-items:center; backdrop-filter:blur(8px);";
    overlay.innerHTML = `<div style="color:#F9393F; font-size:4rem; font-weight:900; text-shadow:0 0 30px #F9393F;">ASIGNAR TECLA</div><div style="color:white; font-size:1.8rem; margin-top:15px;">Presiona la nueva tecla para el Carril ${laneIdx + 1}</div><div style="color:#888; margin-top:30px; font-size:1rem;">(Haz clic aquí o presiona ESC para cancelar)</div>`;
    document.body.appendChild(overlay);

    const cleanUp = () => {
        btnElement.dataset.waiting = "false";
        overlay.remove(); 
        window.removeEventListener('keydown', capture, { capture: true });
        window.renderLaneConfig(k);
    };

    const capture = (e) => {
        e.preventDefault(); e.stopPropagation();
        let keyToSave = e.key;
        
        if (e.code === "Space" || e.key === " ") keyToSave = " "; 
        else if (keyToSave.length === 1) keyToSave = keyToSave.toLowerCase();
        
        if (e.key !== "Escape" && e.key !== "Esc") {
            window.cfg.modes[k][laneIdx].k = keyToSave;
        }
        cleanUp();
    };
    
    overlay.onclick = cleanUp;

    setTimeout(() => { 
        window.addEventListener('keydown', capture, { capture: true }); 
    }, 200);
};

window.captureSingleKey = function(btnId, cfgProp) {
    const btn = document.getElementById(btnId); 
    if(!btn || btn.dataset.waiting === "true") return;
    
    const origText = btn.innerText; 
    btn.dataset.waiting = "true"; 
    btn.innerText = "..."; 
    btn.style.background = "#F9393F"; 
    btn.blur();

    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); z-index:9999999; display:flex; flex-direction:column; justify-content:center; align-items:center;";
    overlay.innerHTML = `<div style="color:#ff66aa; font-size:4rem; font-weight:900;">ASIGNAR TECLA</div><div style="color:white; font-size:1.5rem; margin-top:10px;">Toca cualquier tecla...</div><div style="color:#888; margin-top:30px; font-size:1rem;">(Haz clic aquí o presiona ESC para cancelar)</div>`;
    document.body.appendChild(overlay);

    const cleanUp = () => {
        btn.dataset.waiting = "false"; 
        btn.style.background = "transparent";
        overlay.remove(); 
        window.removeEventListener('keydown', capture, { capture: true });
    };

    const capture = (e) => {
        e.preventDefault(); e.stopPropagation();
        let key = e.key; 
        
        if(e.code === "Space" || key === " ") key = " ";
        else if (key.length === 1) key = key.toLowerCase();

        if (e.key !== "Escape" && e.key !== "Esc") {
            window.cfg[cfgProp] = key; 
            let display = key === " " ? "SPC" : key.toUpperCase().replace(/ARROW/g,'').replace(/KEY/g,'').replace(/DIGIT/g,'');
            btn.innerText = display.length > 5 ? display.substring(0,4)+'..' : display;
        } else { 
            btn.innerText = origText; 
        }
        cleanUp();
    };
    
    overlay.onclick = () => { btn.innerText = origText; cleanUp(); };

    setTimeout(() => window.addEventListener('keydown', capture, { capture: true }), 200);
};

window.updatePreview = function(k) {
    const box = document.getElementById('live-skin-preview'); if(!box) return;
    let html = '';
    for(let i=0; i<k; i++) {
        let laneData = window.cfg.modes[k][i]; if(!laneData) continue;
        let shapeSvg = window.getShapeSvg(laneData.s, laneData.c);
        html += `<div style="flex:1; height:100%; border-left:1px solid rgba(255,255,255,0.05); border-right:1px solid rgba(255,255,255,0.05); display:flex; justify-content:center; align-items:flex-end; padding-bottom:15px; background: linear-gradient(to top, rgba(255,255,255,0.05), transparent);"><div style="width:50px; height:50px;">${shapeSvg}</div></div>`;
    }
    box.innerHTML = html;
};

window.populateSkinDropdowns = function() {
    const ns = document.getElementById('cfg-note-skin'), ui = document.getElementById('cfg-ui-skin');
    if(!ns || !ui || !window.user || !window.user.inventory || typeof SHOP_ITEMS === 'undefined') return;
    window.user.inventory.forEach(itemId => {
        let item = SHOP_ITEMS.find(i => i.id === itemId);
        if(item) {
            if(item.type === 'skin' && !ns.querySelector(`option[value="${item.id}"]`)) ns.innerHTML += `<option value="${item.id}">${item.name}</option>`;
            if(item.type === 'ui' && !ui.querySelector(`option[value="${item.id}"]`)) ui.innerHTML += `<option value="${item.id}">${item.name}</option>`;
        }
    });
    ns.value = window.cfg.noteSkin || 'default'; ui.value = window.cfg.uiSkin || 'default';
};

window.addEventListener('DOMContentLoaded', window.loadSettings);
