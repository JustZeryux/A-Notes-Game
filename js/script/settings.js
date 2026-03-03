/* === js/script/settings.js - MEGA CONFIGURADOR PRO V6 (KEYBINDS & PREVIEW FIX) === */

window.loadSettings = function() {
    let saved = localStorage.getItem('gameCfg');
    
    // VARIABLES POR DEFECTO ACTUALIZADAS
    window.defaultCfg = {
        perfMode: false, subtitles: true, showFps: true, 
        spd: 2.5, down: true, den: 5, fov: 0, noteOp: 100, hitPos: 85,
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
    
    if (!window.cfg.modes) window.cfg.modes = {};

    for(let k = 1; k <= 10; k++) {
        if(!window.cfg.modes[k] || window.cfg.modes[k].length !== k) {
            window.cfg.modes[k] = [];
            const defKeys = ['a','s','d','f','g','h','j','k','l',';'];
            for(let i=0; i<k; i++) window.cfg.modes[k].push({ k: defKeys[i]||' ', c: '#00ffff', s: 'circle' });
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
    setVal('cfg-fov', 'fov'); setVal('cfg-noteop', 'noteOp'); setVal('cfg-hit-pos', 'hitPos');
    setVal('cfg-note-skin', 'noteSkin'); 

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
    
    if(typeof populateSkinDropdowns === 'function') populateSkinDropdowns();
};

window.openSettingsPanel = function() {
    window.loadSettings();
    let modal = document.getElementById('modal-settings');
    if (modal) { modal.style.display = 'flex'; } 
    else if (typeof openModal === 'function') { openModal('settings'); }
};

window.closeSettingsPanel = function() {
    let modal = document.getElementById('modal-settings');
    if (modal) { modal.style.display = 'none'; } 
    else if (typeof closeModal === 'function') { closeModal('settings'); }
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
    
    if(tabId === 'set-mania') window.renderLaneConfig(parseInt(document.getElementById('kb-mode-select').value || 4));
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
            <button id="kb-btn-${k}-${i}" onclick="window.waitForKey(${k}, ${i})" style="width:45px; height:45px; border-radius:8px; background:#111; color:white; border:2px solid ${l.c}; font-weight:900; font-size:1rem; cursor:pointer; transition:0.2s; box-shadow: 0 0 10px rgba(0,0,0,0.5);">${displayKey}</button>
            <input type="color" value="${l.c}" onchange="window.updateLaneProp(${k}, ${i}, 'c', this.value)" style="width:30px; height:30px; border:none; background:none; cursor:pointer; padding:0; margin-top:5px;">
        </div>`;
    }
    cont.innerHTML = html;
    window.updatePreview(k);
};

window.updateLaneProp = function(k, lane, prop, val) {
    window.cfg.modes[k][lane][prop] = val;
    window.renderLaneConfig(k); 
};

// 🌟 SISTEMA DE PREVIEW REHECHO (Garantizado que funciona con CSS)
window.updatePreview = function(k) {
    const box = document.getElementById('live-skin-preview');
    if(!box || !window.cfg || !window.cfg.modes[k]) return;
    
    let html = '';
    for(let i=0; i<k; i++) {
        let color = window.cfg.modes[k][i].c || "#00ffff";
        
        // Creamos notas puramente con CSS brillante para que nunca fallen
        html += `
        <div style="flex:1; height:100%; border-left:1px solid rgba(255,255,255,0.05); border-right:1px solid rgba(255,255,255,0.05); background:linear-gradient(to top, rgba(255,255,255,0.08), transparent); display:flex; justify-content:center; align-items:flex-end; padding-bottom: 10px;">
            <div style="width: 80%; max-width: 50px; height: 25px; background: ${color}; border-radius: 12px; box-shadow: 0 0 20px ${color}, inset 0 0 10px rgba(255,255,255,0.8); border: 2px solid white;"></div>
        </div>`;
    }
    box.innerHTML = html;
};

// 🎮 NUEVO SISTEMA DE CAPTURA DE TECLAS (ANTI-BUGS)
window.waitForKey = function(k, lane) {
    const btn = document.getElementById(`kb-btn-${k}-${lane}`);
    if(btn) { btn.blur(); btn.innerText = "?"; btn.style.background = "#ff66aa"; btn.style.borderColor = "white"; }
    
    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.9); z-index:9999999; display:flex; flex-direction:column; justify-content:center; align-items:center; backdrop-filter:blur(10px);";
    overlay.innerHTML = `
        <div style="color:#00ffff; font-size:4rem; font-weight:900; text-shadow: 0 0 20px #00ffff;">NUEVA TECLA</div>
        <div style="color:white; font-size:1.5rem; margin-top:10px;">Presiona la tecla para el Carril ${lane+1} (${k}K)</div>
        <div style="color:#888; margin-top:20px; font-weight:bold;">Presiona [ESC] para cancelar</div>
    `;
    document.body.appendChild(overlay);

    // Retraso de 100ms para evitar que el click capture la tecla Espacio o Enter por accidente
    setTimeout(() => {
        const handler = (e) => {
            e.preventDefault(); e.stopPropagation();
            
            let key = e.key;
            if(e.code === "Space") key = " ";
            
            if (key !== "Escape") {
                window.cfg.modes[k][lane].k = key;
            }
            
            overlay.remove();
            document.removeEventListener('keydown', handler, true);
            window.renderLaneConfig(k);
        };
        document.addEventListener('keydown', handler, true);
    }, 100);
};

window.captureSingleKey = function(btnId, cfgProp) {
    const btn = document.getElementById(btnId);
    if(btn) { btn.blur(); btn.innerText = "?"; btn.style.background = "#ff66aa"; }
    
    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.9); z-index:9999999; display:flex; flex-direction:column; justify-content:center; align-items:center; backdrop-filter:blur(10px);";
    overlay.innerHTML = `
        <div style="color:#ff66aa; font-size:4rem; font-weight:900; text-shadow: 0 0 20px #ff66aa;">ASIGNAR TECLA</div>
        <div style="color:white; font-size:1.5rem; margin-top:10px;">Toca cualquier tecla...</div>
        <div style="color:#888; margin-top:20px; font-weight:bold;">Presiona [ESC] para cancelar</div>
    `;
    document.body.appendChild(overlay);

    setTimeout(() => {
        const handler = (e) => {
            e.preventDefault(); e.stopPropagation();
            
            let key = e.key; 
            if(e.code === "Space") key = "Space";
            
            if (key !== "Escape") {
                window.cfg[cfgProp] = key;
                btn.innerText = key.toUpperCase().replace('ARROW','');
            }
            
            btn.style.background = "#111"; // Regresa a su color original
            overlay.remove();
            document.removeEventListener('keydown', handler, true);
        };
        document.addEventListener('keydown', handler, true);
    }, 100);
};

if(typeof window.loadSettings === 'function') window.loadSettings();
