/* === SETTINGS.JS - Menús y Variables Visuales === */

window.applyCfg = function() {
    document.documentElement.style.setProperty('--track-alpha', (cfg.trackOp || 10) / 100); 
    document.documentElement.style.setProperty('--note-op', (cfg.noteOp || 100) / 100);
    document.documentElement.style.setProperty('--note-scale', cfg.noteScale || 1);
    document.documentElement.style.setProperty('--judge-y', (cfg.judgeY || 40) + '%'); 
    document.documentElement.style.setProperty('--judge-x', (cfg.judgeX || 50) + '%'); 
    document.documentElement.style.setProperty('--judge-scale', (cfg.judgeS || 7)/10); 
    document.documentElement.style.setProperty('--judge-op', cfg.judgeVis ? 1 : 0);

    const track = document.getElementById('track');
    if (track) {
        const fov = cfg.fov || 0;
        track.style.transform = `rotateX(${fov}deg)`;
        track.style.perspective = `${800 - (fov*10)}px`;
        if (cfg.middleScroll) track.classList.add('middle-scroll');
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
        html += renderToggle('Middlescroll (Centrado)', 'middleScroll');
        html += renderToggle('Downscroll (Caída abajo)', 'down');
        html += renderRange('Velocidad (Scroll Speed)', 'spd', 10, 60);
        html += renderRange('Dificultad', 'den', 1, 20);
        html += renderRange('Offset Global (ms)', 'off', -200, 200);
    } 
    else if (tab === 'visuals') {
        html += renderToggle('Vivid Lights', 'vivid'); html += renderToggle('Screen Shake', 'shake'); html += renderToggle('Lane Flash (Luz Carril)', 'laneFlash'); html += renderToggle('Mostrar Splash Hits', 'showSplash'); html += renderToggle('Subtítulos (Karaoke)', 'subtitles'); html += renderToggle('Efectos de Cámara en Fondo', 'bgEffects');
        html += `<div class="set-row"><span class="set-label">Tipo de Splash</span><select class="log-inp" style="width:150px; padding:5px;" onchange="updateCfgVal('splashType', this.value)"><option value="classic" ${cfg.splashType=='classic'?'selected':''}>Classic Ring</option><option value="fire" ${cfg.splashType=='fire'?'selected':''}>Fire Burst</option><option value="electric" ${cfg.splashType=='electric'?'selected':''}>Electric</option><option value="star" ${cfg.splashType=='star'?'selected':''}>Star Pop</option><option value="text" ${cfg.splashType=='text'?'selected':''}>Text HIT</option></select></div>`;
        html += renderRange('Tamaño Nota (Escala)', 'noteScale', 0.5, 1.5, 0.1); html += renderRange('Track FOV (Inclinación 3D)', 'fov', 0, 45); html += renderRange('Posición Juez Y', 'judgeY', 0, 100); html += renderToggle('Mostrar Juez', 'judgeVis'); html += renderToggle('Mostrar FC Status', 'showFC'); html += renderToggle('Mostrar Mean MS', 'showMean'); html += renderRange('Opacidad Carril (%)', 'trackOp', 0, 100); html += renderRange('Opacidad Notas (%)', 'noteOp', 10, 100); html += renderRange('Posición Juez X', 'judgeX', 0, 100);
        html += `<div style="margin-top:20px; border-top:1px solid #333; padding-top:15px;"><button class="btn-small btn-add" style="width:100%" onclick="document.getElementById('bg-file').click()">🖼️ CAMBIAR FONDO DE PANTALLA</button><input type="file" id="bg-file" accept="image/*" style="display:none" onchange="window.handleBg(this)"></div>`;
    } 
    else if (tab === 'audio') {
        html += renderRange('Volumen Música', 'vol', 0, 100); html += renderToggle('Hit Sounds', 'hitSound'); html += renderRange('Volumen Hits', 'hvol', 0, 100); html += renderToggle('Miss Sounds', 'missSound'); html += renderRange('Volumen Miss', 'missVol', 0, 100);
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
                        if (item.type === 'skin') skinOptions += `<option value="${item.id}" ${user.equipped && user.equipped.skin === item.id ? 'selected' : ''}>${item.name}</option>`;
                        else if (item.type === 'ui' || item.type === 'overlay') uiOptions += `<option value="${item.id}" ${user.equipped && user.equipped.ui === item.id ? 'selected' : ''}>${item.name}</option>`;
                    }
                }
            });
        }
        html += `<div class="kb-tabs" style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:15px;">${[1,2,3,4,5,6,7,8,9,10].map(k => `<div class="kb-tab ${k===4?'active':''}" id="tab-${k}" onclick="window.renderLaneConfig(${k})">${k}K</div>`).join('')}</div>`;
        html += `<div class="lane-cfg-box"><div id="lanes-container" class="lanes-view"></div><div style="margin-top: 40px; border-top: 1px solid #333; padding-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;"><div><div style="font-weight:900; color:var(--accent); margin-bottom:10px; font-size:1.1rem;">🎨 SKIN DE NOTAS</div><select class="skin-selector" onchange="window.equipSkinFromSettings(this.value)" style="width:100%; padding:10px; background:#222; color:white; border:1px solid #ff66aa; border-radius:5px; outline:none; font-weight:bold;">${skinOptions}</select></div><div><div style="font-weight:900; color:#00ffff; margin-bottom:10px; font-size:1.1rem;">🖼️ MARCOS DE UI</div><select class="skin-selector" onchange="window.equipUIFromSettings(this.value)" style="width:100%; padding:10px; background:#222; color:white; border:1px solid #00ffff; border-radius:5px; outline:none; font-weight:bold;">${uiOptions}</select></div></div></div>`;
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
