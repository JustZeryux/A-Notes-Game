/* === js/script/settings.js - MEGA CONFIGURADOR PRO V4 (1K a 10K) === */

window.loadSettings = function() {
    let saved = localStorage.getItem('gameCfg');
    
    window.defaultCfg = {
        subtitles: true, showFps: true, spd: 2.5, down: true, den: 5, fov: 0, noteOp: 100,
        bgDim: 50, showSplash: true, showMs: true, hideUI: false,
        vol: 0.5, hvol: 0.5, missVol: 0.5, off: 0, hitSound: 'default',
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
    
    // Generar mapeos desde 1K hasta 10K
    for(let k = 1; k <= 10; k++) {
        if(!window.cfg.modes[k] || window.cfg.modes[k].length !== k) {
            window.cfg.modes[k] = [];
            const defKeys = ['a','s','d','f','g','h','j','k','l',';'];
            for(let i=0; i<k; i++) window.cfg.modes[k].push({ k: defKeys[i]||' ', c: '#00ffff', s: 'circle' });
        }
    }

    const setVal = (id, prop) => { const el = document.getElementById(id); if(el) el.value = window.cfg[prop]; };
    const setChk = (id, prop) => { const el = document.getElementById(id); if(el) el.checked = !!window.cfg[prop]; };
    const setTxt = (id, prop) => { const el = document.getElementById(id); if(el) el.innerText = String(window.cfg[prop]||'').toUpperCase().replace('ARROW',''); };

    setChk('cfg-show-fps', 'showFps'); setChk('cfg-subtitles', 'subtitles');
    
    setVal('cfg-spd', 'spd'); setChk('cfg-down', 'down'); setVal('cfg-den', 'den');
    setVal('cfg-fov', 'fov'); setVal('cfg-noteop', 'noteOp');
    setVal('cfg-note-skin', 'noteSkin'); setVal('cfg-ui-skin', 'uiSkin');

    setVal('cfg-std-ar', 'stdAR'); setVal('cfg-std-cs', 'stdCS'); setChk('cfg-std-trail', 'stdTrail');
    setTxt('cfg-std-k1', 'stdK1'); setTxt('cfg-std-k2', 'stdK2');

    setVal('cfg-tk-spd', 'tkSpeed');
    setTxt('cfg-tk-dl', 'tkDonL'); setTxt('cfg-tk-dr', 'tkDonR'); setTxt('cfg-tk-kl', 'tkKatsuL'); setTxt('cfg-tk-kr', 'tkKatsuR');

    setVal('cfg-ct-spd', 'ctSpeed'); setVal('cfg-ct-cs', 'ctCS');
    setTxt('cfg-ct-l', 'ctLeft'); setTxt('cfg-ct-r', 'ctRight'); setTxt('cfg-ct-d', 'ctDash');

    setVal('cfg-dim', 'bgDim'); setChk('cfg-splash', 'showSplash'); setChk('cfg-show-ms', 'showMs'); setChk('cfg-hide-ui', 'hideUI');
    
    if(document.getElementById('cfg-vol')) document.getElementById('cfg-vol').value = (window.cfg.vol || 0.5) * 100;
    if(document.getElementById('cfg-hvol')) document.getElementById('cfg-hvol').value = (window.cfg.hvol || 0.5) * 100;
    if(document.getElementById('cfg-mvol')) document.getElementById('cfg-mvol').value = (window.cfg.missVol || 0.5) * 100;
    setVal('cfg-off', 'off'); setVal('cfg-hitsound', 'hitSound');
    
    populateSkinDropdowns();
};

window.openSettingsPanel = function() {
    window.loadSettings();
    const modal = document.getElementById('modal-settings');
    if(modal) {
        modal.style.display = 'flex';
        window.renderLaneConfig(4); 
    }
};

window.closeSettingsPanel = function() {
    const modal = document.getElementById('modal-settings');
    if(modal) modal.style.display = 'none';
};

window.saveSettings = function() {
    const getVal = (id) => { const el = document.getElementById(id); return el ? parseFloat(el.value) : 0; };
    const getStr = (id) => { const el = document.getElementById(id); return el ? el.value : 'default'; };
    const getChk = (id) => { const el = document.getElementById(id); return el ? el.checked : false; };

    window.cfg.showFps = getChk('cfg-show-fps'); window.cfg.subtitles = getChk('cfg-subtitles');
    
    window.cfg.spd = getVal('cfg-spd'); window.cfg.down = getChk('cfg-down'); 
    window.cfg.den = getVal('cfg-den'); window.cfg.fov = getVal('cfg-fov'); window.cfg.noteOp = getVal('cfg-noteop');
    window.cfg.noteSkin = getStr('cfg-note-skin'); window.cfg.uiSkin = getStr('cfg-ui-skin');
    
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
    window.notify("Ajustes guardados con éxito.", "success");
    window.closeSettingsPanel();
};

window.switchSetTab = function(tabId) {
    document.querySelectorAll('.set-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.set-section').forEach(s => s.style.display = 'none');
    
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
    const tab = document.getElementById(tabId);
    if(tab) tab.style.display = 'block';
    
    if(tabId === 'set-controls') window.renderLaneConfig(parseInt(document.getElementById('kb-mode-select').value || 4));
};

window.renderLaneConfig = function(k) {
    const cont = document.getElementById('lanes-container');
    if(!cont) return;
    
    document.getElementById('kb-mode-select').value = k;
    let html = '';
    
    for(let i=0; i<k; i++) {
        let l = window.cfg.modes[k][i];
        let displayKey = String(l.k).toUpperCase().replace('KEY', '').replace('ARROW', '');
        if (displayKey === ' ' || displayKey === 'SPACE') displayKey = 'SPC';
        
        html += `
        <div style="display:flex; flex-direction:column; align-items:center; gap:5px; background:rgba(255,255,255,0.02); padding:10px; border-radius:10px; border:1px solid #333;">
            <div style="color:#aaa; font-size:0.7rem; font-weight:bold;">T${i+1}</div>
            <button id="kb-btn-${k}-${i}" onclick="window.waitForKey(${k}, ${i})" style="width:45px; height:45px; border-radius:8px; background:#111; color:white; border:2px solid ${l.c}; font-weight:900; font-size:1rem; cursor:pointer; transition:0.2s;">${displayKey}</button>
            <input type="color" value="${l.c}" onchange="window.updateLaneProp(${k}, ${i}, 'c', this.value)" style="width:30px; height:30px; border:none; background:none; cursor:pointer; padding:0; margin-top:5px;">
        </div>`;
    }
    cont.innerHTML = html;
    window.updatePreview(k);
};

window.updateLaneProp = function(k, lane, prop, val) {
    window.cfg.modes[k][lane][prop] = val;
    window.renderLaneConfig(k); // Refresca los bordes de los botones
};

// 🚨 VISTA PREVIA MASIVA QUE DIBUJA TODA LA PISTA 🚨
window.updatePreview = function(k) {
    const box = document.getElementById('live-skin-preview');
    if(!box || !window.cfg || !window.cfg.modes[k]) return;
    
    let html = '';
    for(let i=0; i<k; i++) {
        let conf = window.cfg.modes[k][i];
        let color = conf.c;
        let shapeData = "M50,10 A40,40 0 1,1 49.9,10"; 

        let skinId = window.cfg.noteSkin || 'default';
        if (skinId !== 'default' && typeof SHOP_ITEMS !== 'undefined') {
            let skin = SHOP_ITEMS.find(item => item.id === skinId);
            if (skin) {
                if (skin.shape && typeof SKIN_PATHS !== 'undefined') shapeData = SKIN_PATHS[skin.shape];
                if (skin.fixed) color = skin.color;
            }
        }

        html += `
        <div style="flex:1; height:100%; border-left:1px solid rgba(255,255,255,0.05); border-right:1px solid rgba(255,255,255,0.05); background:linear-gradient(to top, rgba(255,255,255,0.05), transparent); display:flex; justify-content:center; align-items:flex-end;">
            <svg viewBox="0 0 100 100" style="width:60%; filter:drop-shadow(0 0 8px ${color}); margin-bottom:10px;">
                <path d="${shapeData}" fill="${color}" stroke="white" stroke-width="3"/>
            </svg>
        </div>`;
    }
    box.innerHTML = html;
};

// Poblar los desplegables de Skins si tienes items comprados
function populateSkinDropdowns() {
    const ns = document.getElementById('cfg-note-skin');
    const ui = document.getElementById('cfg-ui-skin');
    if(!ns || !ui || !window.user || !window.user.inventory || typeof SHOP_ITEMS === 'undefined') return;

    window.user.inventory.forEach(itemId => {
        let item = SHOP_ITEMS.find(i => i.id === itemId);
        if(item) {
            if(item.type === 'skin' && !ns.querySelector(`option[value="${item.id}"]`)) {
                ns.innerHTML += `<option value="${item.id}">${item.name}</option>`;
            }
            if(item.type === 'ui' && !ui.querySelector(`option[value="${item.id}"]`)) {
                ui.innerHTML += `<option value="${item.id}">${item.name}</option>`;
            }
        }
    });
    
    ns.value = window.cfg.noteSkin || 'default';
    ui.value = window.cfg.uiSkin || 'default';
}

window.waitForKey = function(k, lane) {
    const btn = document.getElementById(`kb-btn-${k}-${lane}`);
    if(btn) { btn.blur(); btn.innerText = "?"; btn.style.background = "#ff66aa"; btn.style.borderColor = "white"; }
    
    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.9); z-index:9999999; display:flex; flex-direction:column; justify-content:center; align-items:center; backdrop-filter:blur(5px);";
    overlay.innerHTML = `<div style="color:#00ffff; font-size:4rem; font-weight:900;">CAPTURA DE TECLA</div><div style="color:white; font-size:1.5rem; margin-top:10px;">Presiona tu nueva tecla para el Carril ${lane+1} (${k}K)</div>`;
    document.body.appendChild(overlay);

    const handler = (e) => {
        e.preventDefault(); e.stopPropagation();
        let key = e.key.toLowerCase(); if(e.code === "Space") key = " ";
        
        window.cfg.modes[k][lane].k = key;
        overlay.remove();
        window.renderLaneConfig(k);
        window.removeEventListener('keydown', handler, true);
    };
    window.addEventListener('keydown', handler, true);
};

window.captureSingleKey = function(btnId, cfgProp) {
    const btn = document.getElementById(btnId);
    if(btn) { btn.blur(); btn.innerText = "?"; btn.style.background = "#ff66aa"; }
    
    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.9); z-index:9999999; display:flex; flex-direction:column; justify-content:center; align-items:center; backdrop-filter:blur(5px);";
    overlay.innerHTML = `<div style="color:#ff66aa; font-size:4rem; font-weight:900;">NUEVA TECLA</div><div style="color:white; font-size:1.5rem; margin-top:10px;">Toca cualquier botón...</div>`;
    document.body.appendChild(overlay);

    const handler = (e) => {
        e.preventDefault(); e.stopPropagation();
        let key = e.key; if(e.code === "Space") key = "Space";
        
        window.cfg[cfgProp] = key;
        btn.innerText = key.toUpperCase().replace('ARROW','');
        btn.style.background = "transparent";
        
        overlay.remove();
        window.removeEventListener('keydown', handler, true);
    };
    window.addEventListener('keydown', handler, true);
};

window.loadSettings();
