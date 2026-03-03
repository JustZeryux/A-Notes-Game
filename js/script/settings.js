/* === js/script/settings.js - MEGA CONFIGURADOR PRO V9 (FIX APERTURA) === */

window.loadSettings = function() {
    let saved = localStorage.getItem('gameCfg');
    
    window.defaultCfg = {
        perfMode: false, subtitles: true, showFps: true, 
        spd: 25, down: true, den: 5, fov: 0, noteOp: 100, hitPos: 85, noteSize: 100,
        bgDim: 60, showSplash: true, showMs: true, hideUI: false,
        vol: 0.5, hvol: 0.8, missVol: 0.6, off: 0, hitSound: 'default',
        stdAR: 9, stdCS: 4, stdK1: 'z', stdK2: 'x', stdTrail: true,
        tkDonL: 'f', tkDonR: 'j', tkKatsuL: 'd', tkKatsuR: 'k', tkSpeed: 1.0,
        ctSpeed: 10, ctLeft: 'ArrowLeft', ctRight: 'ArrowRight', ctDash: 'Shift', ctCS: 5,
        noteSkin: 'default', uiSkin: 'default',
        modes: {}
    };

    if (saved) {
        try { window.cfg = Object.assign({}, window.defaultCfg, JSON.parse(saved)); } 
        catch(e) { window.cfg = JSON.parse(JSON.stringify(window.defaultCfg)); }
    } else {
        window.cfg = JSON.parse(JSON.stringify(window.defaultCfg));
    }
    
    if (!window.cfg.modes) window.cfg.modes = {};

    for(let k = 1; k <= 10; k++) {
        if(!window.cfg.modes[k] || window.cfg.modes[k].length !== k) {
            window.cfg.modes[k] = [];
            const defKeys = ['a','s','d','f','g','h','j','k','l',';'];
            for(let i=0; i<k; i++) window.cfg.modes[k].push({ k: defKeys[i]||' ', c: '#00ffff' });
        }
    }

    const setVal = (id, prop) => { const el = document.getElementById(id); if(el) el.value = window.cfg[prop]; };
    const setChk = (id, prop) => { const el = document.getElementById(id); if(el) el.checked = !!window.cfg[prop]; };
    const setTxt = (id, prop) => { 
        const el = document.getElementById(id); 
        if(el) {
            let txt = String(window.cfg[prop]||'').toUpperCase().replace('ARROW', '');
            if(txt === ' ' || txt === 'SPACE') txt = 'SPC';
            el.innerText = txt; 
        }
    };

    setChk('cfg-perf-mode', 'perfMode');
    setChk('cfg-show-fps', 'showFps'); setChk('cfg-subtitles', 'subtitles');
    setVal('cfg-ui-skin', 'uiSkin');
    
    setVal('cfg-spd', 'spd'); setChk('cfg-down', 'down'); setVal('cfg-den', 'den');
    setVal('cfg-fov', 'fov'); setVal('cfg-noteop', 'noteOp'); 
    setVal('cfg-hit-pos', 'hitPos'); setVal('cfg-note-size', 'noteSize');
    setVal('cfg-note-skin', 'noteSkin'); 

    setVal('cfg-std-ar', 'stdAR'); setVal('cfg-std-cs', 'stdCS'); setChk('cfg-std-trail', 'stdTrail');
    setTxt('cfg-std-k1', 'stdK1'); setTxt('cfg-std-k2', 'stdK2');
    setVal('cfg-tk-spd', 'tkSpeed');
    setTxt('cfg-tk-dl', 'tkDonL'); setTxt('cfg-tk-dr', 'tkDonR'); setTxt('cfg-tk-kl', 'tkKatsuL'); setTxt('cfg-tk-kr', 'tkKatsuR');
    setVal('cfg-ct-spd', 'ctSpeed'); setVal('cfg-ct-cs', 'ctCS');
    setTxt('cfg-ct-l', 'ctLeft'); setTxt('cfg-ct-r', 'ctRight'); setTxt('cfg-ct-d', 'ctDash');

    setVal('cfg-dim', 'bgDim'); setChk('cfg-splash', 'showSplash'); setChk('cfg-show-ms', 'showMs'); setChk('cfg-hide-ui', 'hideUI');
    if(document.getElementById('cfg-vol')) document.getElementById('cfg-vol').value = (window.cfg.vol || 0.5) * 100;
    if(document.getElementById('cfg-hvol')) document.getElementById('cfg-hvol').value = (window.cfg.hvol || 0.8) * 100;
    if(document.getElementById('cfg-mvol')) document.getElementById('cfg-mvol').value = (window.cfg.missVol || 0.6) * 100;
    setVal('cfg-off', 'off'); setVal('cfg-hitsound', 'hitSound');
    
    if(typeof window.populateSkinDropdowns === 'function') window.populateSkinDropdowns();
};

// 🚨 AQUÍ ESTÁN LAS FUNCIONES QUE FALTABAN PARA ABRIR Y CERRAR 🚨
window.openSettingsPanel = function() {
    window.loadSettings();
    let modal = document.getElementById('modal-settings');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '9999999';
    } else if (typeof openModal === 'function') {
        openModal('settings');
    }
};

window.closeSettingsPanel = function() {
    let modal = document.getElementById('modal-settings');
    if (modal) {
        modal.style.display = 'none';
    } else if (typeof closeModal === 'function') {
        closeModal('settings');
    }
};

window.saveSettings = function() {
    const getVal = (id) => { const el = document.getElementById(id); return el ? parseFloat(el.value) : 0; };
    const getStr = (id) => { const el = document.getElementById(id); return el ? el.value : 'default'; };
    const getChk = (id) => { const el = document.getElementById(id); return el ? el.checked : false; };

    window.cfg.perfMode = getChk('cfg-perf-mode');
    window.cfg.showFps = getChk('cfg-show-fps'); window.cfg.subtitles = getChk('cfg-subtitles');
    window.cfg.uiSkin = getStr('cfg-ui-skin');
    
    window.cfg.spd = getVal('cfg-spd'); window.cfg.down = getChk('cfg-down'); 
    window.cfg.den = getVal('cfg-den'); window.cfg.fov = getVal('cfg-fov'); 
    window.cfg.noteOp = getVal('cfg-noteop'); window.cfg.hitPos = getVal('cfg-hit-pos');
    window.cfg.noteSize = getVal('cfg-note-size');
    window.cfg.noteSkin = getStr('cfg-note-skin');
    
    window.cfg.stdAR = getVal('cfg-std-ar'); window.cfg.stdCS = getVal('cfg-std-cs'); window.cfg.stdTrail = getChk('cfg-std-trail');
    window.cfg.tkSpeed = getVal('cfg-tk-spd');
    window.cfg.ctSpeed = getVal('cfg-ct-spd'); window.cfg.ctCS = getVal('cfg-ct-cs');
    
    window.cfg.bgDim = getVal('cfg-dim'); window.cfg.showSplash = getChk('cfg-splash'); 
    window.cfg.showMs = getChk('cfg-show-ms'); window.cfg.hideUI = getChk('cfg-hide-ui');
    
    let volEl = document.getElementById('cfg-vol'); if(volEl) window.cfg.vol = parseFloat(volEl.value) / 100;
    let hvolEl = document.getElementById('cfg-hvol'); if(hvolEl) window.cfg.hvol = parseFloat(hvolEl.value) / 100;
    let mvolEl = document.getElementById('cfg-mvol'); if(mvolEl) window.cfg.missVol = parseFloat(mvolEl.value) / 100;
    window.cfg.off = getVal('cfg-off'); window.cfg.hitSound = getStr('cfg-hitsound');

    localStorage.setItem('gameCfg', JSON.stringify(window.cfg));
    if (typeof window.notify === 'function') window.notify("Ajustes guardados con éxito.", "success");
    
    window.closeSettingsPanel();
};

window.switchSetTab = function(tabId) {
    document.querySelectorAll('.set-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.set-section').forEach(s => s.style.display = 'none');
    
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
    const tab = document.getElementById(tabId);
    if(tab) tab.style.display = 'block';
    
    if(tabId === 'set-mania') {
        const select = document.getElementById('kb-mode-select');
        window.renderLaneConfig(parseInt(select ? select.value : 4));
    }
};

window.renderLaneConfig = function(k) {
    k = parseInt(k);
    const cont = document.getElementById('lanes-container');
    if(!cont) return;
    
    if(!window.cfg.modes[k]) {
        window.cfg.modes[k] = [];
        const def = ['a','s','d','f','g','h','j','k','l',';'];
        for(let i=0; i<k; i++) window.cfg.modes[k].push({ k: def[i]||' ', c: '#00ffff' });
    }

    cont.innerHTML = ''; 
    
    window.cfg.modes[k].forEach((lane, i) => {
        let keyText = lane.k === ' ' ? 'SPC' : String(lane.k).toUpperCase();
        
        const card = document.createElement('div');
        card.style.cssText = "text-align:center; background:rgba(255,255,255,0.05); padding:15px; border-radius:12px; border:1px solid #444; box-shadow: 0 5px 15px rgba(0,0,0,0.5); display:flex; flex-direction:column; align-items:center;";
        
        const label = document.createElement('div');
        label.style.cssText = "color:#aaa; font-size:0.8rem; font-weight:bold; margin-bottom:10px;";
        label.innerText = `LANE ${i+1}`;
        card.appendChild(label);
        
        const btn = document.createElement('button');
        btn.id = `kb-btn-${k}-${i}`;
        btn.className = "kb-btn";
        btn.style.cssText = `width:60px; height:60px; background:#111; border:3px solid ${lane.c}; color:white; font-size:1.5rem; font-weight:900; border-radius:10px; cursor:pointer; transition:0.2s; display:flex; justify-content:center; align-items:center;`;
        btn.innerText = keyText;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            window.startKeyCapture(k, i);
        });
        card.appendChild(btn);
        
        const colorLabel = document.createElement('div');
        colorLabel.style.cssText = "margin-top:10px; color:#666; font-size:0.7rem;";
        colorLabel.innerText = "COLOR";
        card.appendChild(colorLabel);
        
        const colorInp = document.createElement('input');
        colorInp.type = 'color';
        colorInp.value = lane.c;
        colorInp.style.cssText = "display:block; margin:5px auto 0; width:35px; height:35px; border:none; background:none; cursor:pointer;";
        colorInp.addEventListener('input', (e) => {
            window.updateLaneColor(k, i, e.target.value);
        });
        card.appendChild(colorInp);
        
        cont.appendChild(card);
    });

    window.updatePreview(k);
};

window.startKeyCapture = function(k, laneIdx) {
    const btn = document.getElementById(`kb-btn-${k}-${laneIdx}`);
    if (!btn || btn.dataset.waiting === "true") return;
    
    document.querySelectorAll('.kb-btn').forEach(b => {
        if(b.dataset.waiting === "true") {
            b.dataset.waiting = "false";
            b.innerText = b.dataset.origKey;
            b.style.background = "#111";
        }
    });

    btn.dataset.origKey = btn.innerText;
    btn.dataset.waiting = "true";
    btn.innerText = "...";
    btn.style.background = "#F9393F";
    btn.blur(); 

    const capture = (e) => {
        e.preventDefault(); e.stopPropagation();
        
        let key = e.key;
        if(e.code === "Space") key = " ";
        
        if (key !== "Escape") {
            window.cfg.modes[k][laneIdx].k = key;
        }
        
        document.removeEventListener('keydown', capture, true);
        window.renderLaneConfig(k); 
    };

    setTimeout(() => {
        document.addEventListener('keydown', capture, true);
    }, 150);
};

window.captureSingleKey = function(btnId, cfgProp) {
    const btn = document.getElementById(btnId);
    if(!btn || btn.dataset.waiting === "true") return;
    
    btn.dataset.origKey = btn.innerText;
    btn.dataset.waiting = "true";
    btn.innerText = "...";
    btn.style.background = "#F9393F";
    btn.blur();

    const capture = (e) => {
        e.preventDefault(); e.stopPropagation();
        let key = e.key; 
        if(e.code === "Space") key = "Space";
        
        if (key !== "Escape") {
            window.cfg[cfgProp] = key;
            btn.innerText = key.toUpperCase().replace('ARROW','');
        } else {
            btn.innerText = btn.dataset.origKey;
        }
        
        btn.dataset.waiting = "false";
        btn.style.background = "transparent";
        document.removeEventListener('keydown', capture, true);
    };

    setTimeout(() => document.addEventListener('keydown', capture, true), 150);
};

window.updatePreview = function(k) {
    const box = document.getElementById('live-skin-preview');
    if(!box) return;
    
    box.innerHTML = '';
    for(let i=0; i<k; i++) {
        let color = window.cfg.modes[k][i].c || '#00ffff';
        
        const lane = document.createElement('div');
        lane.style.cssText = "flex:1; height:100%; border-left:1px dashed #333; display:flex; justify-content:center; align-items:flex-end; padding-bottom:15px; background: linear-gradient(to top, rgba(255,255,255,0.05), transparent);";
        
        const note = document.createElement('div');
        note.style.cssText = `width:80%; max-width:60px; height:20px; background:${color}; border-radius:8px; box-shadow: 0 0 20px ${color}, inset 0 0 10px rgba(255,255,255,0.8); border:2px solid white;`;
        
        lane.appendChild(note);
        box.appendChild(lane);
    }
};

window.updateLaneColor = function(k, i, color) {
    window.cfg.modes[k][i].c = color;
    window.updatePreview(k);
    
    const btn = document.getElementById(`kb-btn-${k}-${i}`);
    if(btn) btn.style.borderColor = color;
};

window.populateSkinDropdowns = function() {
    const ns = document.getElementById('cfg-note-skin');
    const ui = document.getElementById('cfg-ui-skin');
    if(!ns || !ui || !window.user || !window.user.inventory || typeof SHOP_ITEMS === 'undefined') return;

    window.user.inventory.forEach(itemId => {
        let item = SHOP_ITEMS.find(i => i.id === itemId);
        if(item) {
            if(item.type === 'skin' && !ns.querySelector(`option[value="${item.id}"]`)) ns.innerHTML += `<option value="${item.id}">${item.name}</option>`;
            if(item.type === 'ui' && !ui.querySelector(`option[value="${item.id}"]`)) ui.innerHTML += `<option value="${item.id}">${item.name}</option>`;
        }
    });
    
    ns.value = window.cfg.noteSkin || 'default';
    ui.value = window.cfg.uiSkin || 'default';
};

window.loadSettings();
