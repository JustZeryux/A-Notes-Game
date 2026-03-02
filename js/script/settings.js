/* === js/script/settings.js - MEGA CONFIGURADOR PRO === */

// 1. CARGA DE CONFIGURACIÓN MAESTRA
wwindow.loadSettings = function() {
    let saved = localStorage.getItem('gameCfg');
    
    // FIX: Evitamos que el juego crashee si window.defaultCfg no existe aún
    let fallbackCfg = window.defaultCfg || {
        subtitles: true, showFps: true, spd: 2, down: true, den: 5, bgDim: 50, showSplash: true,
        vol: 0.5, hvol: 0.5, missVol: 0.5, off: 0,
        stdAR: 9, stdCS: 4, stdK1: 'z', stdK2: 'x',
        tkDonL: 'f', tkDonR: 'j', tkKatsuL: 'd', tkKatsuR: 'k',
        ctSpeed: 5, ctLeft: 'ArrowLeft', ctRight: 'ArrowRight', ctDash: 'Shift'
    };

    if (saved) {
        try { window.cfg = Object.assign({}, fallbackCfg, JSON.parse(saved)); } 
        catch(e) { window.cfg = JSON.parse(JSON.stringify(fallbackCfg)); }
    } else {
        window.cfg = JSON.parse(JSON.stringify(fallbackCfg));
    }
    
    // Asegurar estructura de modos por si es primera vez
    if(!window.cfg.modes) window.cfg.modes = {};
    [4,5,6,7,8,9,10].forEach(k => {
        if(!window.cfg.modes[k]) {
            window.cfg.modes[k] = [];
            const defKeys = ['a','s','d','f','g','h','j','k','l',';'];
            for(let i=0; i<k; i++) window.cfg.modes[k].push({ k: defKeys[i]||' ', c: '#00ffff', s: 'circle' });
        }
    });

    // Cargar en el UI de forma segura
    const setVal = (id, prop) => { const el = document.getElementById(id); if(el) el.value = window.cfg[prop]; };
    const setChk = (id, prop) => { const el = document.getElementById(id); if(el) el.checked = window.cfg[prop]; };
    const setTxt = (id, prop) => { const el = document.getElementById(id); if(el) el.innerText = String(window.cfg[prop]).toUpperCase().replace('ARROW',''); };

    // UX / General
    setChk('cfg-subtitles', 'subtitles');
    setChk('cfg-show-fps', 'showFps');
    
    // Mania
    setVal('cfg-spd', 'spd');
    setChk('cfg-down', 'down');
    setVal('cfg-den', 'den');

    // Visuales y Audio
    if(document.getElementById('cfg-dim')) document.getElementById('cfg-dim').value = window.cfg.bgDim || 50;
    setChk('cfg-splash', 'showSplash');
    if(document.getElementById('cfg-vol')) document.getElementById('cfg-vol').value = (window.cfg.vol || 0.5) * 100;
    if(document.getElementById('cfg-hvol')) document.getElementById('cfg-hvol').value = (window.cfg.hvol || 0.5) * 100;
    if(document.getElementById('cfg-mvol')) document.getElementById('cfg-mvol').value = (window.cfg.missVol || 0.5) * 100;
    setVal('cfg-off', 'off');

    // Standard, Taiko, Catch
    setVal('cfg-std-ar', 'stdAR'); setVal('cfg-std-cs', 'stdCS');
    setTxt('cfg-std-k1', 'stdK1'); setTxt('cfg-std-k2', 'stdK2');
    setTxt('cfg-tk-dl', 'tkDonL'); setTxt('cfg-tk-dr', 'tkDonR');
    setTxt('cfg-tk-kl', 'tkKatsuL'); setTxt('cfg-tk-kr', 'tkKatsuR');
    setVal('cfg-ct-spd', 'ctSpeed');
    setTxt('cfg-ct-l', 'ctLeft'); setTxt('cfg-ct-r', 'ctRight'); setTxt('cfg-ct-d', 'ctDash');
};

// 2. GUARDADO AL SALIR
window.saveSettings = function() {
    const getVal = (id) => { const el = document.getElementById(id); return el ? parseFloat(el.value) : 0; };
    const getChk = (id) => { const el = document.getElementById(id); return el ? el.checked : false; };

    window.cfg.subtitles = getChk('cfg-subtitles');
    window.cfg.showFps = getChk('cfg-show-fps');
    
    window.cfg.spd = getVal('cfg-spd');
    window.cfg.down = getChk('cfg-down');
    window.cfg.den = getVal('cfg-den');

    let dimEl = document.getElementById('cfg-dim'); if(dimEl) window.cfg.bgDim = parseFloat(dimEl.value);
    window.cfg.showSplash = getChk('cfg-splash');
    
    let volEl = document.getElementById('cfg-vol'); if(volEl) window.cfg.vol = parseFloat(volEl.value) / 100;
    let hvolEl = document.getElementById('cfg-hvol'); if(hvolEl) window.cfg.hvol = parseFloat(hvolEl.value) / 100;
    let mvolEl = document.getElementById('cfg-mvol'); if(mvolEl) window.cfg.missVol = parseFloat(mvolEl.value) / 100;
    window.cfg.off = getVal('cfg-off');

    window.cfg.stdAR = getVal('cfg-std-ar'); window.cfg.stdCS = getVal('cfg-std-cs');
    window.cfg.ctSpeed = getVal('cfg-ct-spd');

    localStorage.setItem('gameCfg', JSON.stringify(window.cfg));
    window.notify("Ajustes guardados correctamente.", "success");
    if(typeof updatePreview === 'function') updatePreview();
};

// 3. PESTAÑAS DEL PANEL
window.switchSetTab = function(tabId) {
    document.querySelectorAll('.set-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.set-section').forEach(s => s.classList.remove('active'));
    
    event.currentTarget.classList.add('active');
    document.getElementById(tabId).classList.add('active');
    
    if(tabId === 'set-mania') window.renderLaneConfig(4); // Renderiza 4K por defecto al abrir
};

// 4. EDITOR DE TECLAS MANIA Y VISTA PREVIA REAL
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
        <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
            <button id="kb-btn-${k}-${i}" onclick="window.waitForKey(${k}, ${i})" style="width:45px; height:45px; border-radius:8px; background:#111; color:white; border:2px solid #555; font-weight:900; font-size:1rem; cursor:pointer; transition:0.2s;">${displayKey}</button>
            <input type="color" value="${l.c}" onchange="window.updateLaneProp(${k}, ${i}, 'c', this.value)" style="width:30px; height:30px; border:none; background:none; cursor:pointer; padding:0;">
            <select onchange="window.updateLaneProp(${k}, ${i}, 's', this.value)" style="width:60px; background:#111; color:white; border:1px solid #333; font-size:0.7rem; padding:2px; border-radius:5px;">
                <option value="circle" ${l.s==='circle'?'selected':''}>Circ</option>
                <option value="bar" ${l.s==='bar'?'selected':''}>Bar</option>
                <option value="arrow_up" ${l.s==='arrow_up'?'selected':''}>Up</option>
                <option value="arrow_down" ${l.s==='arrow_down'?'selected':''}>Dwn</option>
            </select>
        </div>`;
    }
    cont.innerHTML = html;
    window.updatePreview(k); // Actualiza el cuadro de preview
};

window.updateLaneProp = function(k, lane, prop, val) {
    window.cfg.modes[k][lane][prop] = val;
    window.updatePreview(k);
};

// 🚨 FIX: LA VISTA PREVIA AHORA REFLEJA TU SKIN O COLORES ELEGIDOS 🚨
window.updatePreview = function(k) {
    const box = document.getElementById('live-skin-preview');
    if(!box || !window.cfg || !window.cfg.modes[k]) return;
    
    // Tomamos el color y forma del carril 0 como ejemplo para el preview
    let conf = window.cfg.modes[k][0];
    let color = conf.c;
    
    // Si tienes PATHS definidos en globals, lo usa. Si no, dibuja un círculo por defecto
    let shapeData = (typeof PATHS !== 'undefined' && PATHS[conf.s]) ? PATHS[conf.s] : "M50,10 A40,40 0 1,1 49.9,10"; 

    // Revisar si hay Skin equipada (Prioridad Absoluta)
    if (window.user && window.user.equipped && window.user.equipped.skin !== 'default' && typeof SHOP_ITEMS !== 'undefined') {
        let activeSkin = SHOP_ITEMS.find(i => i.id === window.user.equipped.skin);
        if (activeSkin) {
            if (activeSkin.shape && typeof SKIN_PATHS !== 'undefined' && SKIN_PATHS[activeSkin.shape]) shapeData = SKIN_PATHS[activeSkin.shape];
            if (activeSkin.fixed) color = activeSkin.color;
        }
    }

    box.innerHTML = `
        <svg viewBox="0 0 100 100" style="width:70%; height:70%; filter:drop-shadow(0 0 15px ${color});">
            <path d="${shapeData}" fill="${color}" stroke="white" stroke-width="3"/>
        </svg>
    `;
    box.style.borderColor = color;
    box.style.boxShadow = `0 0 20px ${color}33 inset`;
};

// 5. CAPTURA GLOBAL DE TECLAS (Súper seguro)
window.waitForKey = function(k, lane) {
    const btn = document.getElementById(`kb-btn-${k}-${lane}`);
    if(btn) { btn.blur(); btn.innerText = "?"; btn.style.background = "#ff66aa"; btn.style.borderColor = "white"; }
    
    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); z-index:9999999; display:flex; justify-content:center; align-items:center; color:#00ffff; font-size:3rem; font-weight:900; backdrop-filter:blur(5px);";
    overlay.innerHTML = `<div>PRESIONA TECLA PARA CARRIL ${lane+1}</div>`;
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

// Captura simple para Standard, Taiko y Catch
window.captureSingleKey = function(btnId, cfgProp) {
    const btn = document.getElementById(btnId);
    if(btn) { btn.blur(); btn.innerText = "?"; btn.style.background = "#ff66aa"; }
    
    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); z-index:9999999; display:flex; justify-content:center; align-items:center; color:#ff66aa; font-size:3rem; font-weight:900; backdrop-filter:blur(5px);";
    overlay.innerHTML = `<div>ASIGNANDO NUEVA TECLA</div>`;
    document.body.appendChild(overlay);

    const handler = (e) => {
        e.preventDefault(); e.stopPropagation();
        let key = e.key; if(e.code === "Space") key = "Space";
        
        window.cfg[cfgProp] = key;
        btn.innerText = key.toUpperCase().replace('ARROW','');
        btn.style.background = "#000";
        
        overlay.remove();
        window.removeEventListener('keydown', handler, true);
    };
    window.addEventListener('keydown', handler, true);
};
