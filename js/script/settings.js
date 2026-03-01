/* === js/script/settings.js - Menús y Variables Visuales (BLINDADO Y REPARADO) === */

window.applyCfg = function() {
    document.documentElement.style.setProperty('--track-alpha', (window.cfg.trackOp || 10) / 100); 
    document.documentElement.style.setProperty('--note-op', (window.cfg.noteOp || 100) / 100);
    document.documentElement.style.setProperty('--note-scale', window.cfg.noteScale || 1);
    document.documentElement.style.setProperty('--judge-y', (window.cfg.judgeY || 40) + '%'); 
    document.documentElement.style.setProperty('--judge-x', (window.cfg.judgeX || 50) + '%'); 
    document.documentElement.style.setProperty('--judge-scale', (window.cfg.judgeS || 7)/10); 
    document.documentElement.style.setProperty('--judge-op', window.cfg.judgeVis ? 1 : 0);

    const track = document.getElementById('track');
    if (track) {
        const fov = window.cfg.fov || 0;
        track.style.transform = `rotateX(${fov}deg)`;
        track.style.perspective = `${800 - (fov*10)}px`;
        if (window.cfg.middleScroll) track.classList.add('middle-scroll');
        else track.classList.remove('middle-scroll');
    }
};

window.openSettingsMenu = function() {
    const modal = document.getElementById('modal-settings');
    if(!modal) return;
    const panel = modal.querySelector('.modal-panel');
    panel.className = "modal-panel settings-panel"; 
    
    panel.innerHTML = `
        <div class="settings-header">
            <div class="m-title" style="margin:0; font-size:1.8rem; border:none;">CONFIGURACIÓN</div>
            <div style="display:flex; gap:10px;">
                <button class="action" style="width:auto; padding:10px 20px; font-size:1rem;" onclick="saveSettings()">GUARDAR</button>
                <button class="action secondary" style="width:auto; padding:10px 20px; font-size:1rem;" onclick="closeModal('settings')">X</button>
            </div>
        </div>
        <div class="settings-layout">
            <div class="settings-sidebar">
                <button class="set-tab-btn active" onclick="switchSetTab('gameplay')">🎮 GAMEPLAY</button>
                <button class="set-tab-btn" onclick="switchSetTab('visuals')">🎨 VISUALES</button>
                <button class="set-tab-btn" onclick="switchSetTab('audio')">🔊 AUDIO</button>
                <button class="set-tab-btn" onclick="switchSetTab('controls')">⌨️ CONTROLES</button>
            </div>
            <div class="settings-content" id="set-content-area"></div>
            <div class="settings-preview">
                <div class="preview-title">VISTA PREVIA</div>
                <div class="preview-box" id="preview-box"></div>
                <div style="margin-top:15px; color:#666; font-size:0.8rem; text-align:center;">Cambios en tiempo real</div>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    window.switchSetTab('gameplay'); 
};

window.saveSettings = function() {
    window.applyCfg();
    if(typeof save === 'function') { save(); if(window.notify) window.notify("Ajustes guardados", "success"); }
    document.getElementById('modal-settings').style.display = 'none';
    if(typeof window.updUI === 'function') window.updUI();
};

window.switchSetTab = function(tab) {
    const content = document.getElementById('set-content-area');
    document.querySelectorAll('.set-tab-btn').forEach(b => b.classList.remove('active'));
    const btns = document.querySelectorAll('.set-tab-btn');
    const idx = ['gameplay', 'visuals', 'audio', 'controls'].indexOf(tab);
    if(idx !== -1 && btns[idx]) btns[idx].classList.add('active');

    let html = '';
    if (tab === 'gameplay') {
        html += window.renderToggle('Middlescroll (Centrado)', 'middleScroll');
        html += window.renderToggle('Downscroll (Caída abajo)', 'down');
        html += window.renderRange('Velocidad (Scroll Speed)', 'spd', 10, 60);
        html += window.renderRange('Dificultad', 'den', 1, 20);
        html += window.renderRange('Offset Global (ms)', 'off', -200, 200);
    } 
    else if (tab === 'visuals') {
        html += window.renderToggle('Vivid Lights', 'vivid'); html += window.renderToggle('Screen Shake', 'shake'); html += window.renderToggle('Lane Flash (Luz Carril)', 'laneFlash'); html += window.renderToggle('Mostrar Splash Hits', 'showSplash'); html += window.renderToggle('Subtítulos (Karaoke)', 'subtitles'); html += window.renderToggle('Efectos de Cámara en Fondo', 'bgEffects');
        html += `<div class="set-row"><span class="set-label">Tipo de Splash</span><select class="log-inp" style="width:150px; padding:5px;" onchange="window.updateCfgVal('splashType', this.value)"><option value="classic" ${window.cfg.splashType=='classic'?'selected':''}>Classic Ring</option><option value="fire" ${window.cfg.splashType=='fire'?'selected':''}>Fire Burst</option><option value="electric" ${window.cfg.splashType=='electric'?'selected':''}>Electric</option><option value="star" ${window.cfg.splashType=='star'?'selected':''}>Star Pop</option><option value="text" ${window.cfg.splashType=='text'?'selected':''}>Text HIT</option></select></div>`;
        html += window.renderRange('Tamaño Nota (Escala)', 'noteScale', 0.5, 1.5, 0.1); html += window.renderRange('Track FOV (Inclinación 3D)', 'fov', 0, 45); html += window.renderRange('Posición Juez Y', 'judgeY', 0, 100); html += window.renderToggle('Mostrar Juez', 'judgeVis'); html += window.renderToggle('Mostrar FC Status', 'showFC'); html += window.renderToggle('Mostrar Mean MS', 'showMean'); html += window.renderRange('Opacidad Carril (%)', 'trackOp', 0, 100); html += window.renderRange('Opacidad Notas (%)', 'noteOp', 10, 100); html += window.renderRange('Posición Juez X', 'judgeX', 0, 100);
        html += `<div style="margin-top:20px; border-top:1px solid #333; padding-top:15px;"><button class="btn-small btn-add" style="width:100%" onclick="document.getElementById('bg-file').click()">🖼️ CAMBIAR FONDO DE PANTALLA</button><input type="file" id="bg-file" accept="image/*" style="display:none" onchange="window.handleBg(this)"></div>`;
    } 
    else if (tab === 'audio') {
        html += window.renderRange('Volumen Música', 'vol', 0, 100); html += window.renderToggle('Hit Sounds', 'hitSound'); html += window.renderRange('Volumen Hits', 'hvol', 0, 100); html += window.renderToggle('Miss Sounds', 'missSound'); html += window.renderRange('Volumen Miss', 'missVol', 0, 100);
        html += `<div style="margin-top:20px; display:grid; grid-template-columns:1fr 1fr; gap:10px;"><button class="btn-small btn-add" onclick="document.getElementById('hit-file').click()">🔊 HIT SOUND</button><button class="btn-small btn-chat" onclick="document.getElementById('miss-file').click()">🔇 MISS SOUND</button></div>`;
        html += `<input type="file" id="hit-file" accept="audio/*" style="display:none" onchange="window.loadHitSound(this)"><input type="file" id="miss-file" accept="audio/*" style="display:none" onchange="window.loadMissSound(this)">`;
    }
    else if (tab === 'controls') {
        let skinOptions = `<option value="default">Default (Sin Skin)</option>`; let uiOptions = `<option value="default">Default (Sin Marco)</option>`;
        if (window.user && window.user.inventory) {
            window.user.inventory.forEach(itemId => {
                if(typeof SHOP_ITEMS !== 'undefined') {
                    const item = SHOP_ITEMS.find(x => x.id === itemId);
                    if (item) {
                        if (item.type === 'skin') skinOptions += `<option value="${item.id}" ${window.user.equipped && window.user.equipped.skin === item.id ? 'selected' : ''}>${item.name}</option>`;
                        else if (item.type === 'ui' || item.type === 'overlay') uiOptions += `<option value="${item.id}" ${window.user.equipped && window.user.equipped.ui === item.id ? 'selected' : ''}>${item.name}</option>`;
                    }
                }
            });
        }
        html += `<div class="kb-tabs" style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:15px;">${[1,2,3,4,5,6,7,8,9,10].map(k => `<div class="kb-tab ${k===4?'active':''}" id="tab-${k}" onclick="window.renderLaneConfig(${k})">${k}K</div>`).join('')}</div>`;
        html += `<div class="lane-cfg-box"><div id="lanes-container" class="lanes-view" style="display:flex; justify-content:center; gap:5px;"></div><div style="margin-top: 40px; border-top: 1px solid #333; padding-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;"><div><div style="font-weight:900; color:var(--accent); margin-bottom:10px; font-size:1.1rem;">🎨 SKIN DE NOTAS</div><select class="skin-selector" onchange="window.equipSkinFromSettings(this.value)" style="width:100%; padding:10px; background:#222; color:white; border:1px solid #ff66aa; border-radius:5px; outline:none; font-weight:bold;">${skinOptions}</select></div><div><div style="font-weight:900; color:#00ffff; margin-bottom:10px; font-size:1.1rem;">🖼️ MARCOS DE UI</div><select class="skin-selector" onchange="window.equipUIFromSettings(this.value)" style="width:100%; padding:10px; background:#222; color:white; border:1px solid #00ffff; border-radius:5px; outline:none; font-weight:bold;">${uiOptions}</select></div></div></div>`;
        setTimeout(() => window.renderLaneConfig(4), 50);
    }
    content.innerHTML = html;
    if(typeof window.updatePreview === 'function') window.updatePreview(); 
};

window.renderToggle = function(label, key) { const val = window.cfg[key]; return `<div class="set-row"><span class="set-label">${label}</span><button id="tog-${key}" class="toggle-switch ${val ? 'on' : 'off'}" onclick="window.toggleCfg('${key}')">${val ? 'ON' : 'OFF'}</button></div>`; };
window.renderRange = function(label, key, min, max, step=1) { let val = window.cfg[key]; if (key.includes('vol')) val = Math.round((val||0.5) * 100); return `<div class="set-row"><span class="set-label">${label}</span><div style="display:flex;gap:10px;align-items:center;"><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" oninput="window.updateCfgVal('${key}', this.value)"><div id="disp-${key}" class="num-input">${val}</div></div></div>`; };

window.toggleCfg = function(key) {
    window.cfg[key] = !window.cfg[key];
    const btn = document.getElementById('tog-' + key);
    if(btn) { btn.className = `toggle-switch ${window.cfg[key] ? 'on' : 'off'}`; btn.innerText = window.cfg[key] ? 'ON' : 'OFF'; }
    window.applyCfg(); if(typeof window.updatePreview === 'function') window.updatePreview();
};

window.updateCfgVal = function(key, val) {
    const disp = document.getElementById('disp-'+key); if(disp) disp.innerText = val;
    if (key.includes('vol')) window.cfg[key] = val / 100; else if (key === 'noteScale') window.cfg[key] = parseFloat(val); else window.cfg[key] = parseInt(val);
    window.applyCfg(); if(typeof window.updatePreview === 'function') window.updatePreview();
};

// ==========================================
// EL MOTOR DE CONFIGURACIÓN DE TECLAS (BLINDADO)
// ==========================================
// ==========================================
// EL MOTOR DE CONFIGURACIÓN DE TECLAS (REPARACIÓN ABSOLUTA)
// ==========================================
// ==========================================
// EL MOTOR DE CONFIGURACIÓN DE TECLAS (TRAMPA GLOBAL)
// ==========================================

// 1. EL SECUESTRADOR GLOBAL (Trampa absoluta de teclado)
window.assigningKeyInfo = null;
window.addEventListener('keydown', function(e) {
    if (window.assigningKeyInfo) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        let k = window.assigningKeyInfo.k;
        let lane = window.assigningKeyInfo.lane;
        window.assigningKeyInfo = null; // Apagamos la trampa

        let newKey = e.key;
        if(newKey === " ") newKey = "Space";
        
        // Guardar la tecla en el sistema
        window.cfg.modes[k][lane].k = newKey.toLowerCase();
        if(typeof save === 'function') save(); 
        
        // Actualizar pantalla
        window.renderLaneConfig(k);
        if(typeof window.updatePreview === 'function') window.updatePreview();
    }
}, true); // El 'true' asegura que atrape la tecla ANTES que game.js

// 2. DIBUJAR LOS BOTONES LIMPIOS
window.renderLaneConfig = function(k) {
    document.querySelectorAll('.kb-tab').forEach(b => b.classList.remove('active'));
    const t = document.getElementById('tab-'+k); if(t) t.classList.add('active');
    const cont = document.getElementById('lanes-container');
    if(!cont) return;
    
    if(!window.cfg.modes) window.cfg.modes = {};
    if(!window.cfg.modes[k]) {
        window.cfg.modes[k] = [];
        const defaultKeys = ['a','s','d','f','g','h','j','k','l',';'];
        for(let i=0; i<k; i++) window.cfg.modes[k].push({ k: defaultKeys[i] || ' ', c: '#00ffff', s: 'circle' });
    }

    let html = '';
    for(let i=0; i<k; i++) {
        let l = window.cfg.modes[k][i];
        
        // LIMPIEZA VISUAL PERFECTA (Ej: "keyd" -> "D", "space" -> "SPC")
        let displayKey = String(l.k).toUpperCase();
        if(displayKey.startsWith('KEY')) displayKey = displayKey.replace('KEY', '');
        if(displayKey === ' ' || displayKey === 'SPACE') displayKey = 'SPC';
        
        html += `
        <div class="lane-col" style="display:flex; flex-direction:column; align-items:center; gap:10px;">
            <button class="key-btn" id="kb-btn-${k}-${i}" onclick="window.waitForKey(${k}, ${i})" style="width:50px; height:50px; border-radius:8px; background:#111; color:white; border:2px solid #555; font-weight:900; font-size:1.2rem; cursor:pointer; transition:0.2s; text-shadow:0 0 5px rgba(255,255,255,0.5);">
                ${displayKey}
            </button>
            <input type="color" value="${l.c}" onchange="window.updateLaneColor(${k}, ${i}, this.value)" style="width:30px; height:30px; border:none; background:none; cursor:pointer;">
            <select onchange="window.updateLaneShape(${k}, ${i}, this.value)" style="width:60px; background:#111; color:white; border:1px solid #333; font-size:0.7rem; padding:2px;">
                <option value="circle" ${l.s==='circle'?'selected':''}>Circ</option>
                <option value="bar" ${l.s==='bar'?'selected':''}>Bar</option>
                <option value="arrow_up" ${l.s==='arrow_up'?'selected':''}>Up</option>
                <option value="arrow_down" ${l.s==='arrow_down'?'selected':''}>Dwn</option>
            </select>
        </div>`;
    }
    cont.innerHTML = html;
};

// 3. ACTIVAR EL MODO DE ESPERA
window.waitForKey = function(k, lane) {
    const btn = document.getElementById(`kb-btn-${k}-${lane}`);
    if(!btn) return;
    
    btn.blur(); // Quita el foco
    btn.innerText = '?';
    btn.style.background = '#F9393F';
    btn.style.borderColor = '#ffaa00';
    btn.style.boxShadow = '0 0 15px #F9393F';
    
    // Encendemos la trampa global
    window.assigningKeyInfo = { k: k, lane: lane };
};

window.updateLaneColor = function(k, l, color) { window.cfg.modes[k][l].c = color; if(typeof window.updatePreview === 'function') window.updatePreview(); };
window.updateLaneShape = function(k, l, shape) { window.cfg.modes[k][l].s = shape; if(typeof window.updatePreview === 'function') window.updatePreview(); };

window.equipSkinFromSettings = function(val) {
    if(!window.user) return;
    if(!window.user.equipped) window.user.equipped = {};
    window.user.equipped.skin = val;
    window.notify("Skin guardada temporalmente. Usa GUARDAR para fijarla.", "info");
    if(typeof window.updatePreview === 'function') window.updatePreview();
};

window.equipUIFromSettings = function(val) {
    if(!window.user) return;
    if(!window.user.equipped) window.user.equipped = {};
    window.user.equipped.ui = val;
    window.notify("Marco guardado temporalmente. Usa GUARDAR para fijarlo.", "info");
};

window.updatePreview = function() {
    const box = document.getElementById('preview-box');
    if(!box) return;
    box.innerHTML = '';
    let sampleKeyCount = 4;
    if(window.cfg.modes && window.cfg.modes[sampleKeyCount]) {
        let activeSkin = null;
        if(window.user && window.user.equipped && window.user.equipped.skin !== 'default' && typeof SHOP_ITEMS !== 'undefined') {
            activeSkin = SHOP_ITEMS.find(x => x.id === window.user.equipped.skin);
        }
        
        let c = window.cfg.modes[sampleKeyCount][1].c; 
        let s = window.cfg.modes[sampleKeyCount][1].s;
        let p = (typeof PATHS !== 'undefined') ? PATHS[s] || PATHS['circle'] : "M50,10 A40,40 0 1,0 50,90 A40,40 0 1,0 50,10";
        
        if (activeSkin) {
            if (activeSkin.shape && typeof SKIN_PATHS !== 'undefined' && SKIN_PATHS[activeSkin.shape]) p = SKIN_PATHS[activeSkin.shape];
            if (activeSkin.fixed) c = activeSkin.color;
        }
        box.innerHTML = `<svg viewBox="0 0 100 100" style="width:80%; height:80%; filter:drop-shadow(0 0 10px ${c});"><path d="${p}" fill="${c}" stroke="white" stroke-width="2"/></svg>`;
    }
};
