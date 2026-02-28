/* === UI LOGIC & INTERACTION (FULL MASTER VERSION V17) === */

// ==========================================
// 1. HELPERS & NOTIFICACIONES
// ==========================================

// ==========================================
// 3. NOTIFICACIONES PERSISTENTES (DESAFÍOS)
// ==========================================
// === SET DE TECLAS MAESTRO (EVITA CRASHEOS DE 1K A 10K) ===
const MASTER_KEYS = {
    1: ['Space'],
    2: ['KeyF', 'KeyJ'],
    3: ['KeyF', 'Space', 'KeyJ'],
    4: ['KeyD', 'KeyF', 'KeyJ', 'KeyK'],
    5: ['KeyD', 'KeyF', 'Space', 'KeyJ', 'KeyK'],
    6: ['KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL'],
    7: ['KeyS', 'KeyD', 'KeyF', 'Space', 'KeyJ', 'KeyK', 'KeyL'],
    8: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyH', 'KeyJ', 'KeyK', 'KeyL'],
    9: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'Space', 'KeyH', 'KeyJ', 'KeyK', 'KeyL'],
    10: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyV', 'KeyN', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon']
};

// Nos aseguramos de que la configuración exista
if(!window.cfg) window.cfg = {};
if(!window.cfg.keys) window.cfg.keys = {};

// Revisamos del 1 al 10. Si falta alguna tecla, le ponemos la del Set Maestro
for(let i = 1; i <= 10; i++) {
    if(!window.cfg.keys[i] || window.cfg.keys[i].length !== i) {
        window.cfg.keys[i] = MASTER_KEYS[i];
    }
}
// Guardamos para que el motor de juego las detecte de inmediato
localStorage.setItem('cfg', JSON.stringify(window.cfg));
window.notifyChallenge = function(fromUser, lobbyId, songName) {
    const area = document.getElementById('notification-area');
    if(!area) return;

    const card = document.createElement('div');
    card.className = 'notify-card';
    card.style.borderLeftColor = "var(--gold)"; // Color especial
    card.style.animation = "slideIn 0.3s forwards"; // Sin slideOut automático

    card.innerHTML = `
        <div class="notify-title">⚔️ DESAFÍO DE ${fromUser}</div>
        <div class="notify-body">
            Te invita a jugar <b>${songName}</b>.
        </div>
        <div class="notify-actions">
            <button class="btn-small btn-acc" onclick="acceptChallenge('${lobbyId}', this)">ACEPTAR</button>
            <button class="btn-small" style="background:#444;" onclick="this.parentElement.parentElement.remove()">IGNORAR</button>
        </div>
    `;

    area.appendChild(card);
    
    // Sonido de notificación si quieres
    playHover(); 
};

window.acceptChallenge = function(lobbyId, btnElement) {
    if(window.joinLobbyData) {
        btnElement.innerText = "UNIENDO...";
        window.joinLobbyData(lobbyId).then(() => {
            // Eliminar la notificación al unirse
            btnElement.parentElement.parentElement.remove();
        });
    }
};

function playHover(){ 
    if(typeof st !== 'undefined' && st.ctx && typeof cfg !== 'undefined' && cfg.hvol > 0 && st.ctx.state==='running') { 
        try {
            const o=st.ctx.createOscillator(); 
            const g=st.ctx.createGain(); 
            o.frequency.value=600; 
            g.gain.value=0.05; 
            o.connect(g); 
            g.connect(st.ctx.destination); 
            o.start(); 
            o.stop(st.ctx.currentTime+0.05); 
        } catch(e){}
    } 
}

function setText(id, val) { const el = document.getElementById(id); if(el) el.innerText = val; }
function setStyle(id, prop, val) { const el = document.getElementById(id); if(el) el.style[prop] = val; }

// ==========================================
// 2. ACTUALIZACIÓN DE LA INTERFAZ (CORE)
// ==========================================

function updUI() {
    if(!user || !cfg) return;

    // Inicializar valores por defecto si faltan
    if(cfg.middleScroll === undefined) cfg.middleScroll = false;
    if(cfg.trackOp === undefined) cfg.trackOp = 10;
    if(cfg.noteOp === undefined) cfg.noteOp = 100;
    if(cfg.noteScale === undefined) cfg.noteScale = 1;

    // --- PERFIL & STATS ---
    setText('m-name', user.name);
    setText('p-name', user.name);
    setText('ig-name', user.name);
    
    setText('h-pp', user.pp);
    setText('h-sp', (user.sp || 0).toLocaleString());
    
    setText('p-score', user.score.toLocaleString());
    setText('p-plays', user.plays);
    setText('p-pp-display', user.pp);
    setText('p-sp-display', (user.sp || 0).toLocaleString());

    setText('m-rank', "LVL " + user.lvl);
    setText('p-lvl-txt', "LVL " + user.lvl);
    
    // Barra de XP
    let xpReq = 1000 * Math.pow(1.05, user.lvl - 1);
    if(user.lvl >= 10) xpReq = 1000 * Math.pow(1.02, user.lvl - 1);
    xpReq = Math.floor(xpReq);
    const pct = Math.min(100, (user.xp / xpReq) * 100);
    
    setStyle('p-xp-bar', 'width', pct + "%");
    setText('p-xp-txt', `${Math.floor(user.xp)} / ${xpReq} XP`);
    
    // Avatar y Fondo
    if(user.avatarData) { 
        const url = `url(${user.avatarData})`;
        setStyle('m-av', 'backgroundImage', url); setText('m-av', ""); 
        setStyle('p-av-big', 'backgroundImage', url); setStyle('ig-av', 'backgroundImage', url);
    }
    
    if(user.bg) { 
        const bg = document.getElementById('bg-image');
        if(bg) { bg.src = user.bg; bg.style.opacity = 0.3; }
    }

    // Actualizar Rango Global si no se ha cargado
    const rankEl = document.getElementById('p-global-rank');
    if(rankEl && rankEl.innerText === "#--") updateGlobalRank();

    // Aplicar variables CSS
    applyCfg();

    // --- HUD EN JUEGO ---
    if (typeof st !== 'undefined') {
        const fcEl = document.getElementById('hud-fc');
        const meanEl = document.getElementById('hud-mean');
        const comboEl = document.getElementById('g-combo');
        
        if (fcEl) {
            fcEl.innerText = (cfg.showFC && st.fcStatus) ? st.fcStatus : "";
            // Colores del FC
            if(st.fcStatus==="PFC") fcEl.style.color = "cyan";
            else if(st.fcStatus==="GFC") fcEl.style.color = "gold";
            else if(st.fcStatus==="FC") fcEl.style.color = "#12FA05";
            else fcEl.style.color = "#F9393F";
        }
        
        if (meanEl) {
            meanEl.innerText = (cfg.showMean && st.hitCount > 0) ? (st.totalOffset / st.hitCount).toFixed(2) + "ms" : "";
        }
        
        if (comboEl) {
            if (st.cmb > 0) {
                comboEl.innerText = st.cmb;
                comboEl.style.opacity = '1';
                // Reset animation hack
                comboEl.classList.remove('pulse'); 
                void comboEl.offsetWidth; 
                comboEl.classList.add('pulse');
            } else {
                comboEl.style.opacity = '0';
            }
        }
    }

    // --- GESTIÓN DE PANELES LOGIN/LOGOUT ---
    const isGoogle = user.pass === "google-auth";
    const locSet = document.getElementById('local-acc-settings');
    const gooSet = document.getElementById('google-acc-settings');
    if(locSet) locSet.style.display = isGoogle ? 'none' : 'block';
    if(gooSet) gooSet.style.display = isGoogle ? 'block' : 'none';
}

function updateGlobalRank() {
    if(!db || user.name === "Guest") return;
    db.collection("leaderboard").orderBy("pp", "desc").limit(100).get().then(snap => {
        let rank = "#100+";
        snap.docs.forEach((doc, index) => {
            if(doc.id === user.name) {
                rank = "#" + (index + 1);
            }
        });
        setText('p-global-rank', rank);
    }).catch(e => console.log("Rank update limit", e));
}

function applyCfg() {
    // Variables CSS globales para que el estilo reaccione
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
}

// ==========================================
// 3. MENÚ DE AJUSTES (ESTILO ROBLOX / 3 COLUMNAS)
// ==========================================

function openSettingsMenu() {
    const modal = document.getElementById('modal-settings');
    if(!modal) return;
    
    const panel = modal.querySelector('.modal-panel');
    panel.className = "modal-panel settings-panel"; // Clase ancha
    
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
    switchSetTab('gameplay'); // Cargar primera pestaña
}

function saveSettings() {
    applyCfg();
    if(typeof save === 'function') { save(); notify("Ajustes guardados"); }
    document.getElementById('modal-settings').style.display = 'none';
    updUI();
}

function switchSetTab(tab) {
    const content = document.getElementById('set-content-area');
    document.querySelectorAll('.set-tab-btn').forEach(b => b.classList.remove('active'));
    
    // Activar botón visualmente
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
        html += renderToggle('Vivid Lights', 'vivid');
        html += renderToggle('Screen Shake', 'shake');
        html += renderToggle('Lane Flash (Luz Carril)', 'laneFlash');
        html += renderToggle('Mostrar Splash Hits', 'showSplash');
        html += renderToggle('Subtítulos (Karaoke)', 'subtitles');
        html += renderToggle('Efectos de Cámara en Fondo', 'bgEffects');
    
    html += `<div class="set-row">
        <span class="set-label">Tipo de Splash</span>
        <select class="log-inp" style="width:150px; padding:5px;" onchange="updateCfgVal('splashType', this.value)">
            <option value="classic" ${cfg.splashType=='classic'?'selected':''}>Classic Ring</option>
            <option value="fire" ${cfg.splashType=='fire'?'selected':''}>Fire Burst</option>
            <option value="electric" ${cfg.splashType=='electric'?'selected':''}>Electric</option>
            <option value="star" ${cfg.splashType=='star'?'selected':''}>Star Pop</option>
            <option value="text" ${cfg.splashType=='text'?'selected':''}>Text HIT</option>
        </select>
    </div>`;
        html += renderRange('Tamaño Nota (Escala)', 'noteScale', 0.5, 1.5, 0.1);
        html += renderRange('Track FOV (Inclinación 3D)', 'fov', 0, 45); // <--- NUEVO
        html += renderRange('Posición Juez Y', 'judgeY', 0, 100);
        html += renderToggle('Mostrar Juez', 'judgeVis');
        html += renderToggle('Mostrar FC Status', 'showFC');
        html += renderToggle('Mostrar Mean MS', 'showMean');
        html += renderRange('Opacidad Carril (%)', 'trackOp', 0, 100);
        html += renderRange('Opacidad Notas (%)', 'noteOp', 10, 100);
        html += renderRange('Posición Juez Y', 'judgeY', 0, 100);
        html += renderRange('Posición Juez X', 'judgeX', 0, 100);
        html += `<div style="margin-top:20px; border-top:1px solid #333; padding-top:15px;">
            <button class="btn-small btn-add" style="width:100%" onclick="document.getElementById('bg-file').click()">🖼️ CAMBIAR FONDO DE PANTALLA</button>
            <input type="file" id="bg-file" accept="image/*" style="display:none" onchange="handleBg(this)">
        </div>`;
    } 
    else if (tab === 'audio') {
        html += renderRange('Volumen Música', 'vol', 0, 100);
        html += renderToggle('Hit Sounds', 'hitSound');
        html += renderRange('Volumen Hits', 'hvol', 0, 100);
        html += renderToggle('Miss Sounds', 'missSound');
        html += renderRange('Volumen Miss', 'missVol', 0, 100);
        html += `<div style="margin-top:20px; display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <button class="btn-small btn-add" onclick="document.getElementById('hit-file').click()">🔊 HIT SOUND</button>
            <button class="btn-small btn-chat" onclick="document.getElementById('miss-file').click()">🔇 MISS SOUND</button>
        </div>`;
        html += `<input type="file" id="hit-file" accept="audio/*" style="display:none" onchange="loadHitSound(this)">`;
        html += `<input type="file" id="miss-file" accept="audio/*" style="display:none" onchange="loadMissSound(this)">`;
    }
else if (tab === 'controls') {
        // Generar opciones del selector
        let skinOptions = `<option value="default">Default (Sin Skin)</option>`;
        if (user.inventory) {
            user.inventory.forEach(itemId => {
                const item = SHOP_ITEMS.find(x => x.id === itemId);
                if (item && item.type === 'skin') {
                    const isEquipped = user.equipped && user.equipped.skin === item.id;
                    skinOptions += `<option value="${item.id}" ${isEquipped ? 'selected' : ''}>${item.name}</option>`;
                }
            });
        }

        html += `
        <div class="kb-tabs">
            <div class="kb-tab active" id="tab-4" onclick="renderLaneConfig(4)">4K</div>
            <div class="kb-tab" id="tab-6" onclick="renderLaneConfig(6)">6K</div>
            <div class="kb-tab" id="tab-7" onclick="renderLaneConfig(7)">7K</div>
            <div class="kb-tab" id="tab-9" onclick="renderLaneConfig(9)">9K</div>
        </div>
        
        <div class="lane-cfg-box">
            <div id="lanes-container" class="lanes-view"></div>
            
            <div style="margin-top: 40px; border-top: 1px solid #333; padding-top: 20px;">
                <div style="font-weight:900; color:var(--accent); margin-bottom:10px; font-size:1.2rem;">🎨 SKIN DE NOTAS</div>
                <select class="skin-selector" onchange="equipSkinFromSettings(this.value)">
                    ${skinOptions}
                </select>
                <div style="color:#888; font-size:0.9rem; margin-top:10px; font-style:italic;">
                    ⚠️ Si usas una skin "Color Fijo", los colores de arriba serán ignorados.
                </div>
            </div>
        </div>`;
        
        setTimeout(() => renderLaneConfig(4), 50);
    }

    content.innerHTML = html;
    updatePreview(); 
}

window.equipSkinFromSettings = function(skinId) {
    if (!user.equipped) user.equipped = {};
    user.equipped.skin = skinId;
    save(); // Guardar en localStorage/Firebase
    notify(skinId === 'default' ? "Skin desactivada" : "Skin equipada", "success");
    // Forzar actualización visual si estamos en el menú
    updatePreview(); 
};
function equipItem(id, type) { /* Obsoleto para skins, mantenido para UI frames si quieres */ }

function updatePreview() {
    const box = document.getElementById('preview-box');
    if (!box) return;
    
    const sampleLane = cfg.modes[4][0];
    const shapePath = (typeof PATHS !== 'undefined') ? (PATHS[sampleLane.s] || PATHS['circle']) : "";
    const scale = cfg.noteScale || 1;
    const opacity = (cfg.noteOp || 100) / 100;
    const splashType = cfg.splashType || 'classic'; 
    
    // VERIFICACIÓN: Si showSplash es falso, no renderizamos el div de splash
    const splashHTML = cfg.showSplash ? `
        <div class="splash-wrapper" style="position: absolute; top: 50%; left: 50%; z-index: 1;">
            <div class="splash-${splashType}" style="
                --c: ${sampleLane.c}; 
                animation-iteration-count: infinite; 
                animation-duration: 1.5s;
            "></div>
        </div>` : '';

    box.innerHTML = `
        <div class="preview-note" style="transform: scale(${scale}); opacity: ${opacity}; transition: 0.1s; position: relative; z-index: 2;">
            <svg viewBox="0 0 100 100" style="width:100%; height:100%; filter: drop-shadow(0 0 15px ${sampleLane.c});">
                <path d="${shapePath}" fill="${sampleLane.c}" stroke="white" stroke-width="5" />
            </svg>
        </div>
        ${splashHTML}
    `;
}
// Helpers para generar HTML de los ajustes
function renderToggle(label, key) {
    const val = cfg[key];
    return `<div class="set-row">
        <span class="set-label">${label}</span>
        <button id="tog-${key}" class="toggle-switch ${val ? 'on' : 'off'}" onclick="toggleCfg('${key}')">${val ? 'ON' : 'OFF'}</button>
    </div>`;
}

function renderRange(label, key, min, max, step=1) {
    let val = cfg[key];
    if (key.includes('vol')) val = Math.round((val||0.5) * 100);
    return `<div class="set-row">
        <span class="set-label">${label}</span>
        <div style="display:flex;gap:10px;align-items:center;">
            <input type="range" min="${min}" max="${max}" step="${step}" value="${val}" oninput="updateCfgVal('${key}', this.value)">
            <div id="disp-${key}" class="num-input">${val}</div>
        </div>
    </div>`;
}

function toggleCfg(key) {
    cfg[key] = !cfg[key];
    const btn = document.getElementById('tog-' + key);
    if(btn) {
        btn.className = `toggle-switch ${cfg[key] ? 'on' : 'off'}`;
        btn.innerText = cfg[key] ? 'ON' : 'OFF';
    }
    applyCfg();
    updatePreview();
}

function updateCfgVal(key, val) {
    const disp = document.getElementById('disp-'+key);
    if(disp) disp.innerText = val;
    
    if (key.includes('vol')) cfg[key] = val / 100;
    else if (key === 'noteScale') cfg[key] = parseFloat(val);
    else cfg[key] = parseInt(val);
    
    applyCfg();
    updatePreview();
}

// ==========================================
// 4. HANDLERS GLOBALES (MODALES)
// ==========================================

// Asignamos a window para que el HTML pueda verlas
window.openModal = function(id) {
    if (id === 'settings') {
        openSettingsMenu();
    } else {
        const m = document.getElementById('modal-'+id);
        if(m) m.style.display='flex';
        
        if(id==='profile') { 
            const lv = document.getElementById('login-view');
            const pv = document.getElementById('profile-view');
            if(lv && pv) {
                lv.style.display = user.name==='Guest'?'block':'none';
                pv.style.display = user.name==='Guest'?'none':'block';
            }
            switchProfileTab('resumen'); 
        }
        if(id==='upload') setText('upload-status', "");
        if(id==='diff' && curSongData) { 
            setText('diff-song-title', curSongData.title);
            const cover = document.getElementById('diff-song-cover');
            if(curSongData.imageURL) {
                cover.style.backgroundImage = `url(${curSongData.imageURL})`;
            } else {
                // Color fallback
                let hash = 0;
                for (let i = 0; i < curSongData.id.length; i++) hash = curSongData.id.charCodeAt(i) + ((hash << 5) - hash);
                const hue = Math.abs(hash % 360);
                cover.style.backgroundImage = `linear-gradient(135deg, hsl(${hue}, 60%, 20%), #000)`;
            }
        }
    }
};

function closeModal(id){ document.getElementById('modal-'+id).style.display='none'; }

// ==========================================
// 5. CANCIONES Y MENÚ (CON REINTENTO)
// ==========================================

// ==========================================
// 5. CANCIONES Y MENÚ (CORREGIDO)
// ==========================================

// ==========================================
// 5. CANCIONES Y MENÚ (CON AUTO-PORTADAS API)
// ==========================================

let globalSongsListener = null;

function renderMenu(filter="") {
    if(!db) {
        setTimeout(() => renderMenu(filter), 500);
        return;
    }
    const grid = document.getElementById('song-grid');
    if(!grid) return;

    if(globalSongsListener) globalSongsListener(); 
    
    globalSongsListener = db.collection("globalSongs").orderBy("createdAt", "desc").limit(50).onSnapshot(snapshot => {
        grid.innerHTML = '';
        if(snapshot.empty) { grid.innerHTML = '<div style="color:#666; text-align:center; grid-column:1/-1;">No hay canciones globales. ¡Sube una!</div>'; return; }
        
        snapshot.forEach(doc => {
            const s = doc.data();
            const songId = doc.id;
            if(filter && !s.title.toLowerCase().includes(filter.toLowerCase())) return;
            
            const c = document.createElement('div'); 
            c.className = 'beatmap-card';
            
let bgStyle;
            if(s.imageURL) {
                bgStyle = `background-image:url(${s.imageURL})`;
            } else {
                let hash = 0;
                for (let i = 0; i < songId.length; i++) hash = songId.charCodeAt(i) + ((hash << 5) - hash);
                const hue = Math.abs(hash % 360);
                bgStyle = `background-image: linear-gradient(135deg, hsl(${hue}, 60%, 20%), #000)`;

                // === EL TRUCO: AUTOCURAR CANCIONES VIEJAS ===
                let cleanTitle = s.title.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
                fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanTitle)}&entity=song&limit=1`)
                .then(r => r.json())
                .then(d => {
                    if(d.results && d.results.length > 0) {
                        let newImg = d.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
                        const bgDiv = c.querySelector('.bc-bg');
                        if(bgDiv) bgDiv.style.backgroundImage = `url(${newImg})`;
                        db.collection("globalSongs").doc(songId).update({ imageURL: newImg });
                    }
                }).catch(e => {}); 
            }
            
            // HTML DE LA TARJETA CON ETIQUETAS DE TECLAS
            c.innerHTML = `
                <div class="bc-bg" style="${bgStyle}"></div>
                <div class="bc-info">
                    <div class="bc-title">${s.title}</div>
                    <div class="bc-meta">Subido por: ${s.uploader}</div>
                    
                    <div class="card-badges">
                        <div class="key-badge active">4K</div>
                        <div class="key-badge active">6K</div>
                        <div class="key-badge active">7K</div>
                        <div class="key-badge active">9K</div>
                    </div>
                </div>`;
                
            c.onclick = () => { 
                curSongData = { id: songId, ...s }; 
                openModal('diff'); 
            };
            grid.appendChild(c);
        });
    });
}
// ==========================================
// 6. AMIGOS & SOLICITUDES (COMPLETO)
// ==========================================

function openFriends() {
    if(user.name === "Guest") return notify("Inicia sesión primero", "error");
    if(!db) return notify("Error de conexión", "error");
    
    const reqList = document.getElementById('req-list');
    const friList = document.getElementById('friend-list');
    
    db.collection("users").doc(user.name).onSnapshot(doc => {
        if(!doc.exists) return;
        const data = doc.data();
        
        // Requests
        if(reqList) {
            reqList.innerHTML = '';
            if(data.requests && data.requests.length > 0) {
                data.requests.forEach(reqName => {
                    const row = document.createElement('div');
                    row.className = 'friend-row';
                    row.style.borderColor = 'var(--accent)';
                    row.innerHTML = `
                        <span class="friend-row-name">${reqName}</span>
                        <div style="display:flex; gap:5px;">
                            <button class="btn-small btn-acc" onclick="window.respondFriend('${reqName}', true)">✔</button>
                            <button class="btn-small" style="background:#F9393F" onclick="window.respondFriend('${reqName}', false)">✕</button>
                        </div>`;
                    reqList.appendChild(row);
                });
            } else {
                reqList.innerHTML = '<div style="color:#666; font-size:0.8rem; padding:10px;">Sin solicitudes.</div>';
            }
        }

        // Friends
        if(friList) {
            friList.innerHTML = '';
            if(data.friends && data.friends.length > 0) {
                data.friends.forEach(fName => {
                    const row = document.createElement('div'); 
                    row.className = 'friend-row';
                    row.onclick = function() { showFriendProfile(fName); };
                    row.innerHTML = `
                        <div style="display:flex;align-items:center;">
                            <div class="f-row-av" id="fav-${fName}"></div>
                            <span class="friend-row-name">${fName}</span>
                        </div>
                    `;
                    friList.appendChild(row);
                    
                    db.collection("users").doc(fName).get().then(fDoc => {
                        if(fDoc.exists && fDoc.data().avatarData) {
                            const av = document.getElementById(`fav-${fName}`);
                            if(av) av.style.backgroundImage = `url(${fDoc.data().avatarData})`;
                        }
                    });
                });
            } else {
                friList.innerHTML = '<div style="padding:20px;color:#666;">Sin amigos aún.</div>';
            }
        }
    });
    openModal('friends');
}

function showFriendProfile(name) {
    if(!name) return;
    db.collection("users").doc(name).get().then(doc => {
        if(doc.exists) {
            const d = doc.data();
            setText('fp-name', name);
            setText('fp-lvl', "LVL " + (d.lvl || 1));
            setText('fp-score', (d.score || 0).toLocaleString());
            const av = document.getElementById('fp-av');
            if(av) av.style.backgroundImage = d.avatarData ? `url(${d.avatarData})` : '';
            
            const btn = document.getElementById('btn-challenge');
            if(btn) {
                btn.disabled = false;
                btn.onclick = () => { challengeFriend(name); closeModal('friend-profile'); };
            }
            closeModal('friends');
            openModal('friend-profile');
        }
    });
}

// ==========================================
// 7. PANEL DE HOST (COMPACTO Y VISUAL)
// ==========================================

// ==========================================
// SECCIÓN LOBBY / SALA DE ESPERA (CORREGIDA)
// ==========================================

/* === UI LOBBY FIXED (VERSIÓN MAESTRA) === */

/* === UI LOBBY SAFE VERSION (AUTO-GENERATED HTML) === */

// Función principal para abrir el panel
window.openHostPanel = function(songData, isClient = false) {
    if(!songData) return console.error("No song data");
    window.curSongData = songData; // Asegurar global
    
    // 1. Detener juego de fondo para ahorrar recursos
    if(typeof window.st !== 'undefined') { window.st.act = false; window.st.paused = false; }
    const gl = document.getElementById('game-layer');
    if(gl) gl.style.display = 'none';

    // 2. INYECCIÓN AUTOMÁTICA DEL HTML (Anti-Error Null)
    // Si el div "modal-host" no existe en index.html, lo creamos aquí mismo.
    let modal = document.getElementById('modal-host'); 
    if(!modal) {
        console.log("Creando modal-host dinámicamente...");
        modal = document.createElement('div');
        modal.id = 'modal-host'; 
        modal.className = 'modal-overlay'; 
        modal.style.display = 'none';
        modal.innerHTML = '<div class="modal-panel host-panel-compact"></div>';
        document.body.appendChild(modal);
    }

    // 3. Configuración
    const panel = modal.querySelector('.modal-panel');
    panel.className = "modal-panel host-panel-compact"; // Forzar clase CSS
    
    window.isLobbyHost = !isClient;
    const currentDen = (window.cfg && window.cfg.den) ? window.cfg.den : 5;

    // Estilo de fondo
    const bgStyle = songData.imageURL 
        ? `background-image: linear-gradient(to bottom, rgba(0,0,0,0.6), #111), url(${songData.imageURL}); background-size: cover;` 
        : 'background: linear-gradient(to bottom, #333, #111);';

    // 4. HTML INTERNO (Usamos IDs seguros: room-players y btn-lobby-action)
    panel.innerHTML = `
        <div class="hp-header" style="${bgStyle}">
            <div class="hp-title-info">
                <div class="hp-song-title">${songData.title}</div>
                <div class="hp-meta">Subido por: ${songData.uploader}</div>
            </div>
        </div>
        
        <div class="hp-body">
            <div class="hp-config-col">
                <div class="hp-section-title">CONFIGURACIÓN</div>
                <div class="set-row">
                    <span>Modo</span><strong style="color:var(--blue)">4K</strong>
                </div>
                <div class="set-row">
                    <span>Densidad</span><strong style="color:var(--good)">${currentDen}</strong>
                </div>
                <div style="margin-top:20px; font-size:0.8rem; color:#888; text-align:center;">
                    ${window.isLobbyHost ? '👑 ERES EL HOST' : 'ESPERANDO AL HOST...'}
                </div>
            </div>

            <div class="hp-players-col">
                <div class="hp-section-title">JUGADORES</div>
                <div id="room-players" class="hp-grid"></div>
            </div>
        </div>
        
        <div class="hp-footer">
            <button class="action secondary" onclick="closeModal('host'); leaveLobbyData();">SALIR</button>
            <button id="btn-lobby-action" class="action" style="opacity:0.5; cursor:wait;">CONECTANDO...</button>
        </div>
    `;
    
    modal.style.display = 'flex';
};

// Función para actualizar la lista (llamada desde online.js)
window.updateHostPanelUI = function(players, hostName) {
    const container = document.getElementById('room-players');
    const btn = document.getElementById('btn-lobby-action');
    
    // SEGURIDAD: Si la ventana no existe, salir sin error
    if(!container || !btn) return;
    
    container.innerHTML = ''; 
    
    let allReady = true;
    let amIHost = (window.user.name === hostName);
    let myStatus = 'not-ready';
    let playersCount = players.length;

    // Dibujar lista de jugadores
    players.forEach(p => {
        const isHost = p.name === hostName;
        const isReady = p.status === 'ready';
        
        if (!isReady && !isHost) allReady = false; 
        if (p.name === window.user.name) myStatus = p.status;

        const div = document.createElement('div');
        div.className = 'lobby-p-card';
        // Bordes verdes si está listo
        div.style.border = isReady ? '2px solid var(--good)' : '2px solid #444';
        div.style.background = isReady ? 'rgba(18, 250, 5, 0.1)' : 'rgba(255,255,255,0.05)';
        div.style.padding = '10px';
        div.style.borderRadius = '8px';
        div.style.width = '90px';
        div.style.textAlign = 'center';
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        div.style.alignItems = 'center';
        
        div.innerHTML = `
            <div style="width:35px; height:35px; background:url(${p.avatar||''}) center/cover; border-radius:50%; background-color:#333; margin-bottom:5px;"></div>
            <div style="font-size:0.7rem; font-weight:bold; overflow:hidden; text-overflow:ellipsis; width:100%;">${p.name}</div>
            <div style="font-size:0.6rem; color:${isReady?'var(--good)':'#888'}; font-weight:900;">
                ${isHost ? 'HOST' : (isReady ? 'LISTO' : '...')}
            </div>
        `;
        container.appendChild(div);
    });

    // Lógica del Botón Inteligente
    // Clonamos para limpiar eventos viejos
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    if (amIHost) {
        // MODO HOST
        newBtn.innerText = "INICIAR PARTIDA";
        // Permitir iniciar si hay >1 jugador y todos listos (O si estás solo)
        const canStart = (playersCount > 1 && allReady) || (playersCount === 1);
        
        newBtn.className = "action " + (canStart ? "btn-acc" : "secondary");
        newBtn.style.opacity = canStart ? "1" : "0.5";
        newBtn.style.cursor = canStart ? "pointer" : "not-allowed";
        
        newBtn.onclick = () => {
            if(canStart) {
                newBtn.innerText = "INICIANDO...";
                if(window.startLobbyMatchData) window.startLobbyMatchData();
            } else {
                if(window.notify) window.notify("Esperando a que todos estén listos", "error");
            }
        };
    } else {
        // MODO CLIENTE
        let isReady = myStatus === 'ready';
        newBtn.innerText = isReady ? "CANCELAR LISTO" : "¡ESTOY LISTO!";
        newBtn.className = isReady ? "action secondary" : "action btn-acc";
        newBtn.style.opacity = "1";
        newBtn.style.cursor = "pointer";
        
        newBtn.onclick = () => {
            if(window.toggleReadyData) window.toggleReadyData();
        };
    }
};

window.confirmCreateLobby = function() {
    if(!window.curSongData) return;
    
    // Fix: Densidad correcta
    const den = (window.cfg && window.cfg.den) ? window.cfg.den : 5;
    const config = { keys: [window.selectedLobbyKeys || 4], density: den, ranked: false };
    
    if(window.notify) window.notify("Creando sala...", "info");
    
    if (window.createLobbyData) {
        window.createLobbyData(window.curSongData.id, config, false).then(() => {
            if(typeof closeModal === 'function') closeModal('diff');
            // Abrir panel inmediatamente
            window.openHostPanel(window.curSongData, false);
            window.isCreatingLobby = false;
        });
    }
};


// Toggle visual del menú de ajustes dentro del lobby
window.toggleLobbySettings = function() {
    const el = document.getElementById('lobby-settings-overlay');
    if(el) el.style.display = el.style.display === 'none' ? 'flex' : 'none';
};

// Actualizar variable local antes de guardar
let tempLobbyConfig = { keys: 4, density: 5 };
window.updateLobbyConfigLocal = function(key, val) {
    if(key === 'keys') tempLobbyConfig.keys = val;
    notify(`Seleccionado: ${val}${key==='keys'?'K':''}`, "info");
};

// Enviar cambios a Firebase
window.saveLobbySettings = function() {
    if(!currentLobbyId || !db) return;
    const den = document.getElementById('host-den-slider').value;
    
    db.collection("lobbies").doc(currentLobbyId).update({
        "config.keys": [tempLobbyConfig.keys],
        "config.density": parseInt(den)
    }).then(() => {
        notify("Configuración de sala actualizada", "success");
        toggleLobbySettings();
    });
};

// ==========================================
// 8. HELPERS VARIOS
// ==========================================

function changeSection(sec) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const map = { 'songs': 'nav-songs', 'multi': 'nav-multi', 'shop': 'nav-shop', 'settings': 'nav-settings', 'rank': 'nav-rank', 'friends': 'nav-friends' };
    const target = document.getElementById(map[sec]);
    if(target) target.classList.add('active');
}

function switchProfileTab(tab) {
    document.querySelectorAll('.settings-tabs .kb-tab').forEach(t => t.classList.remove('active'));
    const btn = document.getElementById('ptab-'+tab);
    if(btn) btn.classList.add('active');
    const r = document.getElementById('p-tab-content-resumen');
    const c = document.getElementById('p-tab-content-cuenta');
    if(r) r.style.display = tab === 'resumen' ? 'block' : 'none';
    if(c) c.style.display = tab === 'cuenta' ? 'block' : 'none';
}

function renderLaneConfig(k){ 
    document.querySelectorAll('.kb-tab').forEach(t=>t.classList.remove('active')); 
    const tab = document.getElementById('tab-'+k);
    if(tab) tab.classList.add('active'); 
    
    const c=document.getElementById('lanes-container'); 
    if(!c) return;
    c.innerHTML=''; 
    
    for(let i=0; i<k; i++){ 
        const l = cfg.modes[k][i]; 
        const d=document.createElement('div'); d.className='l-col'; 
        const shapePath = (typeof PATHS !== 'undefined') ? (PATHS[l.s] || PATHS['circle']) : ""; 
        d.innerHTML=`<div class="key-bind ${remapIdx===i && remapMode===k?'listening':''}" onclick="remapKey(${k},${i})">${l.k.toUpperCase()}</div><div class="shape-indicator" onclick="cycleShape(${k},${i})"><svg class="shape-svg-icon" viewBox="0 0 100 100"><path d="${shapePath}"/></svg></div><input type="color" class="col-pk" value="${l.c}" onchange="updateLaneColor(${k},${i},this.value)">`; 
        c.appendChild(d); 
    } 
}
function remapKey(k,i){ if(document.activeElement) document.activeElement.blur(); remapMode=k; remapIdx=i; renderLaneConfig(k); }
function updateLaneColor(k,i,v){ cfg.modes[k][i].c=v; updatePreview(); }
function cycleShape(k,i){ const shapes=['circle','arrow','square','diamond']; const cur=shapes.indexOf(cfg.modes[k][i].s); cfg.modes[k][i].s = shapes[(cur+1)%4]; renderLaneConfig(k); updatePreview(); }

function handleBg(i){ if(i.files[0]){ const r=new FileReader(); r.onload=e=>{user.bg=e.target.result;save();}; r.readAsDataURL(i.files[0]); i.value=""; }}
function uploadAvatar(i){ if(i.files[0]){ const r=new FileReader(); r.onload=e=>{user.avatar=e.target.result;user.avatarData=e.target.result;save(); updUI(); updateFirebaseScore();}; r.readAsDataURL(i.files[0]); i.value=""; }}
async function loadHitSound(i){ if(i.files[0]){ const buf = await i.files[0].arrayBuffer(); hitBuf = await st.ctx.decodeAudioData(buf); notify("Hit Sound cargado"); i.value = ""; } }
async function loadMissSound(i){ if(i.files[0]){ const buf = await i.files[0].arrayBuffer(); missBuf = await st.ctx.decodeAudioData(buf); notify("Miss Sound cargado"); i.value = ""; } }

// ==========================================
// 9. LÓGICA DE SALAS ONLINE (MISSING CODE FIXED)
// ==========================================

// Abrir el navegador de salas (Corrige el error openLobbyBrowser)
window.openLobbyBrowser = function() {
    openModal('lobbies');
    refreshLobbies();
};

// Actualizar la lista de salas disponibles
window.refreshLobbies = function() {
    const list = document.getElementById('lobby-list');
    if (!list) return;
    list.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">Cargando salas...</div>';

    if (!window.db) {
        list.innerHTML = '<div style="padding:20px; text-align:center; color:var(--miss);">Error DB</div>';
        return;
    }

    // FILTRO: Solo salas esperando Y que NO sean privadas
    window.db.collection("lobbies")
        .where("status", "==", "waiting")
        // .where("isPrivate", "==", false) // NOTA: Requiere índice compuesto en Firebase.
        // Si no quieres crear índice, filtramos en cliente:
        .get()
        .then(snapshot => {
            list.innerHTML = '';
            let visibleCount = 0;

            snapshot.forEach(doc => {
                const data = doc.data();
                
                // FILTRO MANUAL DE PRIVACIDAD
                if (data.isPrivate === true) return; 

                visibleCount++;
                const div = document.createElement('div');
                div.className = 'lobby-box';
                div.innerHTML = `
                    <div style="display:flex; align-items:center; gap:15px;">
                        <div style="width:50px; height:50px; background:#333; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:1.5rem; color:#555;">VS</div>
                        <div>
                            <div style="font-weight:900; font-size:1.2rem; color:white;">${data.songTitle || 'Desconocido'}</div>
                            <div style="color:var(--blue); font-size:0.9rem; font-weight:bold;">HOST: ${data.host}</div>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:900; font-size:1.5rem; color:white;">${data.players ? data.players.length : 1}/8</div>
                        <div style="font-size:0.8rem; font-weight:bold; color:${data.config?.ranked ? 'var(--gold)' : '#666'}">${data.config?.ranked ? 'RANKED' : 'CASUAL'}</div>
                    </div>
                `;
                div.onclick = function() { if(window.joinLobbyData) window.joinLobbyData(doc.id); };
                list.appendChild(div);
            });

            if (visibleCount === 0) {
                list.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">No hay salas públicas. ¡Crea una!</div>';
            }
        })
        .catch(error => {
            console.error(error);
            list.innerHTML = '<div style="padding:20px; text-align:center;">Error al cargar.</div>';
        });
};
// Abrir selector de canciones para crear sala
window.openSongSelectorForLobby = function() {
    closeModal('lobbies');
    // Reutilizamos el selector de canciones normal pero cambiamos el comportamiento
    // Nota: Necesitarás asegurarte que al hacer click en una canción en este modo, llame a openModal('diff')
    // con una bandera especial para "crear sala".
    
    // Solución rápida: Abrir el selector normal
    document.querySelector('.search-inp').focus();
    notify("Elige una canción del menú principal para crear sala", "info");
    document.getElementById('menu-container').classList.remove('hidden');
};

// Configurar el modal de dificultad para mostrar opción de crear sala
// (Esto se conecta con tu HTML: id="create-lobby-opts")
const originalDiffClick = window.openModal; // Guardar referencia si es necesario
// ==========================================
// 10. SELECTOR DE CANCIONES COMPACTO (LOBBY)
// ==========================================

window.openSongSelectorForLobby = function() {
    // 1. Cerramos el menú de salas si está abierto
    closeModal('lobbies');
    // 2. Abrimos el modal selector
    openModal('song-selector');
    // 3. Cargamos las canciones
    renderLobbySongList();
};

// === BUSCADOR DE CANCIONES PARA SALAS ONLINE ===
window.renderLobbySongList = function(query = "") {
    const grid = document.getElementById('lobby-song-grid');
    if(!grid) return;
    grid.innerHTML = '';

    // Usamos la lista masiva unificada (Firebase + Osu)
    let source = window.unifiedSongs || [];
    let filtered = source.filter(s => {
        if(!query) return true;
        return s.title.toLowerCase().includes(query.toLowerCase()) || 
               s.artist.toLowerCase().includes(query.toLowerCase());
    });

    filtered.forEach(song => {
        const card = document.createElement('div');
        card.style.display = 'flex';
        card.style.alignItems = 'center';
        card.style.justifyContent = 'space-between';
        card.style.background = '#111';
        card.style.padding = '10px';
        card.style.marginBottom = '10px';
        card.style.borderRadius = '8px';
        // Borde rosa brillante si es de Osu!
        card.style.border = song.isOsu ? '1px solid #ff66aa' : '1px solid #333';

        card.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px;">
                <div style="width:50px; height:50px; border-radius:8px; background-image:url('${song.imageURL}'), url('icon.png'); background-size:cover; background-position:center;"></div>
                <div>
                    <div style="font-weight:bold; font-size:1.1rem; color:white;">${song.title}</div>
                    <div style="font-size:0.8rem; color:#aaa;">${song.artist} ${song.isOsu ? '<span style="color:#ff66aa; font-weight:bold; margin-left:5px;">🌸 OSU!</span>' : ''}</div>
                </div>
            </div>
            <button class="action" style="width:auto; padding:5px 20px; font-size:0.9rem; ${song.isOsu ? 'background:#ff66aa; color:black;' : ''}">ELEGIR</button>
        `;
        
        card.querySelector('button').onclick = () => {
            closeModal('song-selector');
            
            // Empaquetamos los datos para que tu servidor multijugador lo entienda
            let lobbyData = song.isOsu ? {
                id: "osu_" + song.id, // Marca clave para que el otro jugador sepa descargar el ZIP
                title: song.title,
                imageURL: song.imageURL,
                isOsu: true
            } : song.raw;

            window.curSongData = lobbyData;
            
            // Enviar la canción a la sala
            if(typeof window.selectSongForLobby === 'function') {
                window.selectSongForLobby(lobbyData);
            } else {
                const rs = document.getElementById('room-song');
                if(rs) rs.innerText = song.title;
                openModal('host');
            }
        };
        
        grid.appendChild(card);
    });
};
window.selectSongForLobby = function(id, data) {
    // Guardamos la canción seleccionada globalmente
    curSongData = { id: id, ...data };
    
    // Cerramos el selector
    closeModal('song-selector');
    
    // Abrimos directamente el panel de dificultad/creación
    // Esto reutiliza tu modal "diff" pero le activamos el modo creación
    openModal('diff');
    
    // Mostramos el botón de crear y ocultamos los de jugar solo
    const createBtn = document.getElementById('create-lobby-opts');
    if(createBtn) {
        createBtn.style.display = 'block';
        // Ocultamos temporalmente las tarjetas de dificultad de "Solo" si quisieras, 
        // o dejamos que el usuario elija dificultad y luego pulse "Crear Sala".
    }
    
    notify(`Seleccionado: ${data.title}`, "info");
};
// ==========================================
// 11. INTERACCIÓN CON AMIGOS (CORRECCIONES)
// ==========================================

// Función para desafiar (Abre el selector de música para crear sala)
window.challengeFriend = function(friendName) {
    notify(`Desafiando a ${friendName}... Selecciona una canción.`, "info");
    
    // Cerramos el perfil del amigo
    closeModal('friend-profile');
    closeModal('friends');
    
    // Abrimos el selector de canciones para crear la sala
    openSongSelectorForLobby();
    
    // NOTA: Aquí podrías guardar 'friendName' en una variable global 
    // para invitarlo automáticamente cuando la sala se cree.
    window.pendingInvite = friendName; 
};

// Función para abrir el Chat Flotante
window.openFloatingChat = function(targetUser) {
    if(!user.name || user.name === "Guest") return notify("Inicia sesión", "error");
    
    // Si no se pasa usuario, solo abrimos el contenedor si ya tiene chats
    const container = document.getElementById('chat-overlay-container');
    if(!container) return;

    // Verificar si ya existe una ventana para este usuario
    const existingId = `chat-w-${targetUser || 'global'}`;
    if(document.getElementById(existingId)) return; // Ya está abierto

    const chatName = targetUser || "Chat Global";
    
    // Crear la ventana de chat visualmente
    const chatWindow = document.createElement('div');
    chatWindow.className = 'chat-window';
    chatWindow.id = existingId;
    chatWindow.innerHTML = `
        <div class="cw-header" onclick="this.parentElement.classList.toggle('minimized')">
            <span>${chatName}</span>
            <span style="font-size:0.8rem">▼</span>
        </div>
        <div class="cw-body" id="cw-body-${targetUser}">
            <div style="color:#666; font-style:italic; text-align:center; margin-top:10px;">
                Inicio de la charla...
            </div>
        </div>
        <div class="cw-input-area">
            <input type="text" class="cw-input" placeholder="Escribe..." onkeypress="handleChatInput(event, '${targetUser}', this)">
        </div>
    `;
    
    container.appendChild(chatWindow);
    
    // Cerrar modales que estorben
    closeModal('friend-profile');
    closeModal('friends');
};

window.handleChatInput = function(e, target, input) {
    if(e.key === 'Enter' && input.value.trim() !== "") {
        const txt = input.value.trim();
        const chatWindowId = target ? `cw-body-${target}` : `chat-global`; // Ajusta según tu ID
        
        // Buscar el cuerpo del chat para feedback visual inmediato (Opcional si usas listener)
        // Pero lo importante es enviar a la DB:
        if(db) {
            db.collection("chats").add({
                msg: txt,
                user: user.name,
                target: target || "global",
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                console.log("Mensaje enviado");
            }).catch(err => notify("Error chat: " + err, "error"));
        }

        input.value = "";
    }
};
// ==========================================
// 12. SISTEMA DE CREACIÓN DE SALAS (FIXED)
// ==========================================

// Función puente para el Chat (llamada desde main.js)
window.uiOpenChat = function(target) {
    // Reutilizamos la lógica visual que tenías o creamos una básica
    const id = `chat-${target || 'global'}`;
    if(document.getElementById(id)) return;
    const box = document.createElement('div');
    box.id = id;
    box.className = 'chat-window';
    box.innerHTML = `<div class="cw-header" onclick="this.parentElement.remove()">${target || 'Chat Global'} (Cerrar)</div><div class="cw-body" style="height:200px; background:#000;"></div><input style="width:100%; padding:10px;" placeholder="Escribe...">`;
    const cont = document.getElementById('chat-overlay-container');
    if(cont) cont.appendChild(box);
}

// 1. Interceptar el inicio de juego (startGame)
// Guardamos la función original por si acaso, pero redefinimos la global
const originalStartGame = window.startGame;

// ==========================================
// 1. FIX: EVITAR INICIO AUTOMÁTICO
// ==========================================

// Sobrescribimos startGame para controlar el flujo
window.startGame = function(k) {
    console.log("Intento de iniciar modo:", k, "Creando Lobby:", window.isCreatingLobby);

    // SI ESTAMOS CREANDO UNA SALA, SOLO SELECCIONAMOS, NO JUGAMOS
    if (window.isCreatingLobby) {
        window.selectedLobbyKeys = k;
        
        // Efecto visual de selección
        document.querySelectorAll('.diff-card').forEach(c => {
            c.style.border = "2px solid #333";
            c.style.transform = "scale(1)";
        });
        
        // Buscar la tarjeta clickeada para iluminarla
        // (Buscamos por texto interno porque no tienen ID único en el HTML original)
        const cards = document.querySelectorAll('.diff-card');
        const indexMap = {4:0, 6:1, 7:2, 9:3};
        if(cards[indexMap[k]]) {
            cards[indexMap[k]].style.border = "4px solid var(--accent)";
            cards[indexMap[k]].style.transform = "scale(1.05)";
        }
        
        notify(`Modo ${k}K seleccionado para la sala`, "info");
        return; // <--- ESTE RETURN ES CRÍTICO PARA NO INICIAR EL JUEGO
    }

    // SI NO ESTAMOS CREANDO SALA, JUGAMOS SOLO (Cierra modal y arranca)
    closeModal('diff');
    prepareAndPlaySong(k);
};

// 2. Modificar la apertura del modal DIFF para inyectar controles de Lobby
window.selectSongForLobby = function(id, data) {
    curSongData = { id: id, ...data };
    window.isCreatingLobby = true; // IMPORTANTE: Activamos el modo
    closeModal('song-selector');
    
    // Abrimos el modal normal
    openModal('diff');
    
    // Manipulamos el DOM del modal para mostrar opciones de sala
    const optsDiv = document.getElementById('create-lobby-opts');
    if(optsDiv) {
        optsDiv.style.display = 'block';
        
        // INYECTAR CONTROLES DE DENSIDAD (SOLICITADO)
        // Limpiamos contenido previo para no duplicar
        optsDiv.innerHTML = `
            <div style="background:#111; padding:15px; border-radius:10px; margin-bottom:15px; border:1px solid #333;">
                <div style="color:var(--accent); font-weight:bold; margin-bottom:10px;">CONFIGURACIÓN DE SALA</div>
                
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span>Dificultad (Densidad):</span>
                    <input type="number" id="lobby-density-input" value="5" min="1" max="10" class="num-input" style="width:60px;">
                </div>
                
                <div style="font-size:0.9rem; color:#888;">
                    1. Selecciona teclas arriba (4K, 6K...)<br>
                    2. Ajusta la dificultad.<br>
                    3. Crea la sala.
                </div>
            </div>
            <button class="action" onclick="confirmCreateLobby()">
                ${window.lobbyTargetFriend ? '⚔️ DESAFIAR A ' + window.lobbyTargetFriend : 'CREAR SALA ONLINE'}
            </button>
        `;
    }
    
    // Ocultar toggle de ranked si quieres forzarlo, o dejarlo
    // Simular selección de 4K por defecto visualmente
    setTimeout(() => window.startGame(4), 100);
};

// 3. Crear la sala realmente (Soluciona el "Creando sala..." infinito)


// Helper para enviar notificación de desafío (Simulado o real si tienes el sistema)
function sendChallengeNotification(target, lobbyId, songTitle) {
    if(!db) return;
    db.collection("users").doc(target).collection("notifications").add({
        type: "challenge",
        from: user.name,
        lobbyId: lobbyId,
        songName: songTitle,
        body: `${user.name} te desafía en ${songTitle}!`,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    notify(`Invitación enviada a ${target}`, "success");
}

const originalCloseModal = window.closeModal;
window.closeModal = function(id) {
    const el = document.getElementById('modal-' + id);
    if (el) el.style.display = 'none';

    // Si cerramos el modal de dificultad, cancelamos el modo creación de sala
    // Esto evita que se quede "pegado" el modo de selección
    if (id === 'diff' && typeof window.isCreatingLobby !== 'undefined' && window.isCreatingLobby) {
        window.isCreatingLobby = false;
        
        // Notificar visualmente
        if (typeof notify === 'function') notify("Creación de sala cancelada", "info");
        
        // Restaurar estilo de las tarjetas (quitar borde verde/azul)
        const cards = document.querySelectorAll('.diff-card');
        cards.forEach(c => {
            c.style.border = "2px solid #333";
            c.style.transform = "scale(1)";
        });

        // Ocultar opciones de crear sala para la próxima vez
        const opts = document.getElementById('create-lobby-opts');
        if(opts) opts.style.display = 'none';
    }
};

// === TIENDA ===
function openShop() {
    setText('shop-sp', (user.sp || 0).toLocaleString());
    const grid = document.getElementById('shop-items');
    if(grid && typeof SHOP_ITEMS !== 'undefined') {
        grid.innerHTML = '';
        SHOP_ITEMS.forEach(item => {
           const originalCloseModal = window.closeModal;
window.closeModal = function(id) {
    // Restaurar comportamiento original
    document.getElementById('modal-'+id).style.display = 'none';
    
    // Si cerramos el modal de dificultad, cancelamos el modo creación de sala
    if(id === 'diff' && window.isCreatingLobby) {
        window.isCreatingLobby = false;
        if(window.notify) window.notify("Creación de sala cancelada", "info");
        
        // Restaurar estilo de las tarjetas
        document.querySelectorAll('.diff-card').forEach(c => {
            c.style.border = "2px solid #333";
            c.style.transform = "scale(1)";
        });
        
        // Ocultar opciones de crear sala
        const opts = document.getElementById('create-lobby-opts');
        if(opts) opts.style.display = 'none';
    }
}; const owned = user.inventory && user.inventory.includes(item.id);
            const div = document.createElement('div');
            div.className = 'shop-item';
            if (owned) {
                div.style.borderColor = "var(--good)";
                div.style.background = "#1a221a"; // Fondo verdoso sutil si ya lo tienes
            }
            
            const typeTag = item.type === 'skin' 
                ? (item.fixed ? '<span class="tag-fix">COLOR FIJO</span>' : '<span class="tag-cust">TU COLOR</span>') 
                : '<span class="tag-ui">UI</span>';

            // GENERAR PREVIEW VISUAL
            let iconHTML = '';
            
            if (item.type === 'skin') {
                // Obtener la forma correcta desde globals
                const pathData = SKIN_PATHS[item.shape] || SKIN_PATHS.circle;
                const displayColor = item.fixed ? item.color : 'white'; // Blanco para representar "Tu Color"
                
                // SVG Miniatura
                iconHTML = `
                    <div class="shop-preview-box">
                        <svg viewBox="0 0 100 100" style="filter:drop-shadow(0 0 8px ${displayColor}); width:60px; height:60px;">
                            <path d="${pathData}" fill="${displayColor}" stroke="white" stroke-width="3" />
                        </svg>
                    </div>`;
            } else {
                // Preview para UI (Marcos)
                iconHTML = `<div class="shop-preview-box" style="border: 3px solid ${item.color}; border-radius:10px;"></div>`;
            }

            div.innerHTML = `
                ${iconHTML}
                <div class="shop-name">${item.name}</div>
                <div class="shop-desc">${item.desc}</div>
                ${typeTag}
                <div class="shop-price" style="${owned ? 'color:var(--good)' : ''}">
                    ${owned ? '✔ EN INVENTARIO' : item.price.toLocaleString() + ' SP'}
                </div>
                ${!owned ? `<button class="btn-small btn-add" onclick="buyItem('${item.id}',${item.price})">COMPRAR</button>` : ''}
            `;
            grid.appendChild(div);
        });
    }
    const m = document.getElementById('modal-shop');
    if(m) m.style.display='flex';
}

// ==========================================
// 12. SISTEMA DE NOTIFICACIONES (LISTENER)
// ==========================================

window.setupNotificationsListener = function() {
    if(!window.db || !window.user || window.user.name === "Guest") return;

    // Escuchar la subcolección 'notifications' de mi usuario
    window.db.collection("users").doc(window.user.name).collection("notifications")
        .orderBy("timestamp", "desc")
        .limit(5)
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === "added") {
                    const data = change.doc.data();
                    // Evitar notificaciones viejas (más de 30 segundos)
                    const now = Date.now();
                    const notifTime = data.timestamp ? data.timestamp.toMillis() : 0;
                    
                    if (now - notifTime < 30000) { 
                        if (data.type === 'challenge') {
                            notifyChallenge(data.from, data.lobbyId, data.songName);
                            // Opcional: Borrar la notificación después de verla
                            change.doc.ref.delete(); 
                        }
                    }
                }
            });
        });
};

function buyItem(id, price) {
    if ((user.sp || 0) < price) return notify("SP Insuficientes", "error");
    user.sp -= price;
    if (!user.inventory) user.inventory = [];
    user.inventory.push(id);
    save(); notify("¡Comprado!", "success"); openShop(); updUI();
}

function equipItem(id, type) {
    if (!user.equipped) user.equipped = {};
    if (user.equipped[type] === id) { user.equipped[type] = 'default'; notify("Desequipado"); } 
    else { user.equipped[type] = id; notify("Equipado"); }
    save(); openShop();
}

// ==========================================
// SISTEMA DE SUBIDA A LA NUBE (AUDIO + IMAGEN)
// ==========================================

// === REEMPLAZA O AGREGA ESTO EN JS/UI.JS ===

// === REEMPLAZAR EN JS/UI.JS ===


// ==========================================
// A NOTES STUDIO - SISTEMA DE SUBIDA V2
// ==========================================

let tempUploadData = {
    audioURL: null,
    imageURL: null
};

window.openCustomUploadModal = function() {
    if (!window.user || window.user.name === "Guest") {
        return notify("Debes iniciar sesión para subir canciones", "error");
    }
    
    // Limpiar el formulario
    tempUploadData = { audioURL: null, imageURL: null };
    document.getElementById('up-title').value = '';
    document.getElementById('up-url').value = ''; // Limpiar input de URL
    
    const audioLbl = document.getElementById('lbl-up-audio');
    audioLbl.innerText = 'Ningún archivo seleccionado';
    audioLbl.style.color = '#666';
    document.getElementById('btn-up-audio').innerText = '1. SUBIR MP3 (UPLOADCARE)';
    document.getElementById('btn-up-audio').style.background = 'white';
    
    const coverPreview = document.getElementById('up-cover-preview');
    coverPreview.style.backgroundImage = 'none';
    coverPreview.style.border = '2px dashed #444';
    coverPreview.innerHTML = '<span style="font-size:3.5rem;">📷</span><span style="color:#888; font-weight:bold; margin-top:10px; text-transform: uppercase;">Subir Imagen</span>';
    
    document.getElementById('btn-publish-song').innerText = 'PUBLICAR CANCIÓN';
    
    openModal('upload');
};

// --- NUEVA FUNCIÓN: Manejador de URL Directa ---
window.handleUrlInput = function(val) {
    const audioLbl = document.getElementById('lbl-up-audio');
    if(val.trim() !== "") {
        tempUploadData.audioURL = val.trim();
        if(audioLbl) {
            audioLbl.innerText = "🔗 Usando enlace URL directo";
            audioLbl.style.color = "var(--blue)";
        }
    } else {
        tempUploadData.audioURL = null;
        if(audioLbl) {
            audioLbl.innerText = "Ningún archivo seleccionado";
            audioLbl.style.color = "#666";
        }
    }
};

// --- RESTAURADO: El viejo Uploadcare que querías de vuelta ---
// 1. REEMPLAZA ESTO CON TUS DATOS DE CLOUDINARY
const CLOUD_NAME = "djauhc6md"; // Ej: "dzq8xyz"
const UPLOAD_PRESET = "subida_juego";  // Ej: "subida_juego"

window.triggerAudioUpload = function() {
    if (typeof cloudinary === 'undefined') return notify("Cloudinary no ha cargado.", "error");
    
    const urlInput = document.getElementById('up-url');
    if(urlInput) urlInput.value = '';

    const btn = document.getElementById('btn-up-audio');
    const audioLbl = document.getElementById('lbl-up-audio');

    // Se abre el widget de Cloudinary
    let myWidget = cloudinary.createUploadWidget({
        cloudName: CLOUD_NAME,
        uploadPreset: UPLOAD_PRESET,
        sources: ['local'],
        resourceType: 'auto', // "auto" permite que trague MP3, OGG, Y2Mate sin quejarse
        clientAllowedFormats: ['mp3', 'ogg', 'wav', 'm4a'],
        maxFileSize: 15000000 // Límite de 15MB para que no suban locuras
    }, (error, result) => {
        if (!error && result && result.event === "success") {
            // AQUÍ OCURRE LA MAGIA: Guardamos el nuevo link en la variable de tu juego
            tempUploadData.audioURL = result.info.secure_url;

            if(audioLbl) {
                audioLbl.innerText = "✅ " + result.info.original_filename;
                audioLbl.style.color = "#12FA05"; 
            }
            btn.innerText = "¡MP3 CARGADO!";
            btn.style.background = "#12FA05";
            btn.style.color = "black";
            
            const titleInput = document.getElementById('up-title');
            if(titleInput && titleInput.value.trim() === '') {
                titleInput.value = result.info.original_filename.replace('.mp3', '');
            }
        } else if (error) {
            notify("Error al subir el archivo.", "error");
        }
    });
    
    myWidget.open();
};

window.triggerCoverUpload = function() {
    if (typeof cloudinary === 'undefined') return notify("Cloudinary no ha cargado.", "error");

    const preview = document.getElementById('up-cover-preview');

    let myWidget = cloudinary.createUploadWidget({
        cloudName: CLOUD_NAME,
        uploadPreset: UPLOAD_PRESET,
        sources: ['local', 'url'],
        resourceType: 'image',
        clientAllowedFormats: ['png', 'jpg', 'jpeg', 'webp']
    }, (error, result) => {
        if (!error && result && result.event === "success") {
            // Guardamos el link de la imagen
            tempUploadData.imageURL = result.info.secure_url;
            preview.innerHTML = '';
            preview.style.backgroundImage = `url(${result.info.secure_url})`;
            preview.style.border = '2px solid var(--gold)';
        }
    });

    myWidget.open();
};

window.submitSongToFirebase = async function() {
    const title = document.getElementById('up-title').value.trim();
    const lyrics = document.getElementById('up-lyrics').value.trim();
    
    if(!title) return notify("¡Escribe un título!", "error");
    if(!tempUploadData.audioURL) return notify("¡Falta el archivo MP3 o la URL!", "error");
    
    const btnSubmit = document.getElementById('btn-publish-song');
    btnSubmit.innerText = "GUARDANDO...";
    btnSubmit.style.pointerEvents = "none";
    
    try {
        if (window.db) {
            const checkQuery = await window.db.collection("globalSongs").where("title", "==", title).get();
            if (!checkQuery.empty) {
                btnSubmit.innerText = "PUBLICAR CANCIÓN";
                btnSubmit.style.pointerEvents = "auto";
                return notify("❌ ¡Esta canción ya fue subida por alguien más!", "error");
            }
        }

        let finalImageUrl = tempUploadData.imageURL;
        if (!finalImageUrl) {
            try {
                let cleanTitle = title.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
                const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanTitle)}&entity=song&limit=1`);
                const data = await res.json();
                
                if (data.results && data.results.length > 0) {
                    finalImageUrl = data.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
                }
            } catch(e) { console.warn("No se encontró portada automática."); }
        }

        // Subir a la colección CORRECTA: globalSongs
        const songData = {
            title: title,
            audioURL: tempUploadData.audioURL,
            imageURL: finalImageUrl || null,
            uploader: window.user.name,
            lyrics: lyrics || null, 
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if(window.db) {
            await window.db.collection("globalSongs").add(songData);
            notify("¡Canción publicada globalmente!", "success");
            closeModal('upload');
        }

    } catch (error) {
        notify("Error DB: " + error.message, "error");
    } finally {
        btnSubmit.innerText = "PUBLICAR CANCIÓN";
        btnSubmit.style.pointerEvents = "auto";
    }
};


// === PEGAR AL FINAL DE JS/ONLINE.JS ===

// 1. Avisar que ya cargué el mapa
window.notifyLobbyLoaded = function() {
    console.log(">> ONLINE: Mapa listo. Enviando señal.");
    const txt = document.getElementById('loading-text');
    if(txt) txt.innerText = "ESPERANDO A TODOS...";
    
    // Si soy el Host, espero 3 segundos y lanzo la partida para todos
    if(window.isLobbyHost && window.currentLobbyId) {
        setTimeout(() => {
            if(window.db) {
                console.log(">> HOST: Iniciando partida para todos...");
                window.db.collection("lobbies").doc(window.currentLobbyId).update({ status: 'playing' });
            }
        }, 3000); 
    }
};

window.autoFetchLyrics = async function() {
    const title = document.getElementById('up-title').value.trim();
    if (!title) {
        return notify("Primero escribe el Título (Ej: Artista - Canción) para buscar.", "error");
    }

    const btn = document.getElementById('btn-fetch-lyrics');
    btn.innerText = "⏳ BUSCANDO...";
    btn.style.pointerEvents = "none";

    try {
        // Hacemos la petición a la API gratuita de LRCLIB
        const response = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(title)}`);
        const data = await response.json();

        if (data && data.length > 0) {
            // Buscamos el primer resultado que tenga letras SINCRONIZADAS (syncedLyrics)
            const bestMatch = data.find(song => song.syncedLyrics);
            
            if (bestMatch && bestMatch.syncedLyrics) {
                document.getElementById('up-lyrics').value = bestMatch.syncedLyrics;
                notify("¡Letra sincronizada encontrada!", "success");
            } else {
                notify("Encontré la canción, pero no tiene tiempos exactos. Usa formato normal.", "error");
            }
        } else {
            notify("No se encontró la letra en la base de datos.", "error");
        }
    } catch (error) {
        console.error("Error buscando letras:", error);
        notify("Error al conectar con el servidor de letras.", "error");
    } finally {
        btn.innerText = "🔍 BUSCAR LRC AUTOMÁTICO";
        btn.style.pointerEvents = "auto";
    }
};

// 2. Función auxiliar para manejar el inicio (llámala desde tu onSnapshot)
window.checkGameStart = function(lobbyData) {
    // Si el estado es 'playing' y yo aún no he empezado
    if (lobbyData.status === 'playing' && !window.hasGameStarted) {
        console.log(">> GO! Iniciando partida.");
        window.hasGameStarted = true;
        
        // Ocultar UI del Lobby
        const m = document.getElementById('modal-lobby-room');
        if(m) m.style.display = 'none';
        
        // Usar la canción que preparamos en el PASO 2
        if (window.preparedSong) {
            if(typeof window.playSongInternal === 'function') {
                window.playSongInternal(window.preparedSong);
            }
        } else {
            // Si por alguna razón no estaba lista, intentar cargarla de emergencia
            console.warn("Canción no estaba lista, forzando carga...");
            if(typeof window.prepareAndPlaySong === 'function') {
                window.prepareAndPlaySong(window.keys || 4);
            }
        }
    }
};

// Carga principal al abrir el juego
window.currentFilters = { type: 'all', key: 'all' };
window.unifiedSongs = [];
window.searchTimeout = null;

window.setFilter = function(category, val) {
    window.currentFilters[category] = val;
    document.querySelectorAll(`.filter-btn[data-type="${category}"]`).forEach(btn => {
        btn.classList.remove('active');
        if(btn.getAttribute('data-val') === val) btn.classList.add('active');
    });
    renderUnifiedGrid();
};

window.debounceSearch = function(val) {
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => fetchUnifiedData(val), 500);
};

// --- CARGA DE CANCIONES (FIREBASE + OSU POR DEFECTO) ---
// --- CARGA BLINDADA (TODOS LOS MAPAS POR DEFECTO) ---
// --- CARGA BLINDADA (TODAS LAS CANCIONES POR DEFECTO) ---
window.fetchUnifiedData = async function(query = "") {
    const grid = document.getElementById('song-grid');
    grid.innerHTML = '<div style="width:100%; text-align:center; padding:50px; color:#ff66aa; font-size:1.5rem; font-weight:bold;">Cargando Galería Global... ⏳</div>';
    
    let fbSongs = [];
    let osuSongs = [];

    // 1. Firebase (Tus canciones de la comunidad)
    try {
        if(window.db) {
            let snapshot = await window.db.collection("globalSongs").limit(50).get();
            snapshot.forEach(doc => {
                let data = doc.data();
                if (!query || data.title.toLowerCase().includes(query.toLowerCase())) {
                    fbSongs.push({
                        id: doc.id, title: data.title, artist: `Subido por: ${data.uploader}`,
                        imageURL: data.imageURL || 'icon.png', isOsu: false,
                        keysAvailable: [4, 6, 7, 9], raw: { ...data, id: doc.id }
                    });
                }
            });
        }
    } catch(e) { console.warn("Error DB Local"); }

    // 2. Osu! Mania (Carga Masiva Automática)
    try {
        // TRUCO MAESTRO: Si la barra está vacía, elegimos una categoría popular al azar.
        // Esto evita que la API devuelva "0 resultados" y hace que el menú principal siempre esté vivo.
        let safeQuery = query.trim();
        if (safeQuery === "") {
            const secretTerms = ["anime", "fnf", "vocaloid", "camellia", "remix", "nightcore", "a", "e"];
            safeQuery = secretTerms[Math.floor(Math.random() * secretTerms.length)];
        }
        
        const res = await fetch(`https://api.nerinyan.moe/search?q=${encodeURIComponent(safeQuery)}&m=3`);
        const data = await res.json();
        
        if (data && data.length > 0) {
            data.forEach(set => {
                // Confirmamos que el mapa sea de modo Mania
                const maniaBeatmaps = set.beatmaps.filter(b => b.mode_int === 3 || b.mode === 3 || b.mode === 'mania');
                
                if(maniaBeatmaps.length > 0) {
                    let keys = [...new Set(maniaBeatmaps.map(b => Math.floor(b.cs)))].sort((a,b)=>a-b);
                    osuSongs.push({
                        id: set.id, title: set.title, 
                        artist: `Subido por: ${set.creator}`, 
                        imageURL: `https://assets.ppy.sh/beatmaps/${set.id}/covers/list@2x.jpg`,
                        isOsu: true, keysAvailable: keys, raw: set
                    });
                }
            });
        }
    } catch(e) { console.warn("Error Osu API"); }

    // Juntamos las canciones de Osu y las tuyas, y las mandamos a dibujar
    window.unifiedSongs = [...osuSongs, ...fbSongs];
    renderUnifiedGrid();
};
// --- DIBUJAR LAS TARJETAS CON TU DISEÑO EXACTO ---
window.renderUnifiedGrid = function() {
    const grid = document.getElementById('song-grid');
    grid.innerHTML = '';

    let filtered = window.unifiedSongs.filter(song => {
        if (window.currentFilters.type === 'osu' && !song.isOsu) return false;
        if (window.currentFilters.type === 'com' && song.isOsu) return false;
        if (window.currentFilters.key !== 'all') {
            let reqKey = parseInt(window.currentFilters.key);
            if (!song.keysAvailable.includes(reqKey)) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<div style="width:100%; text-align:center; padding:50px; color:#ff66aa; font-weight:bold; font-size:1.5rem;">No se encontraron mapas. 🌸</div>';
        return;
    }

    filtered.forEach(song => {
        const card = document.createElement('div');
        card.className = 'song-card';
        if(song.isOsu) card.classList.add('osu-card-style'); // Aplica el aura rosa
        
        // Construimos los botones de K exactamente como en tu captura
        let badgesHTML = song.keysAvailable.map(k => `<div class="diff-badge">${k}K</div>`).join('');
        
        // Agregamos la etiqueta de Osu! si es necesario
        if(song.isOsu) {
            badgesHTML += `<div class="diff-badge badge-osu" style="margin-left:auto;">🌸 OSU!</div>`;
        }

        card.innerHTML = `
            <div class="song-bg" style="background-image: url('${song.imageURL}'), url('icon.png');"></div>
            <div class="song-info">
                <div class="song-title">${song.title}</div>
                <div class="song-author">${song.artist}</div>
                <div style="display:flex; gap:5px; margin-top:10px; flex-wrap:wrap; align-items:center;">
                    ${badgesHTML}
                </div>
            </div>
        `;
        
        // Al hacer clic, abre el menú de dificultad en lugar de iniciar
        card.onclick = () => openUnifiedDiffModal(song);
        grid.appendChild(card);
    });
};

window.currentFilters = { type: 'all', key: 'all' };
window.unifiedSongs = [];
window.searchTimeout = null;

window.setFilter = function(category, val) {
    window.currentFilters[category] = val;
    document.querySelectorAll(`.filter-btn[data-type="${category}"]`).forEach(btn => {
        btn.classList.remove('active');
        if(btn.getAttribute('data-val') === val) btn.classList.add('active');
    });
    renderUnifiedGrid();
};

window.debounceSearch = function(val) {
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => fetchUnifiedData(val), 500);
};

// --- CARGA BLINDADA (ESPERA A FIREBASE Y EVITA CRASHEOS) ---
// --- CARGA MASIVA: DOUBLE FETCH Y MEZCLA ALEATORIA ---
window.fetchUnifiedData = async function(query = "") {
    const grid = document.getElementById('song-grid');
    if(!grid) return;
    grid.innerHTML = '<div style="width:100%; text-align:center; padding:50px; color:#00ffff; font-size:1.5rem; font-weight:bold;">Descargando Galería Masiva... ⏳</div>';
    
    let fbSongs = [];
    let osuSongs = [];

    // 1. ESPERA A FIREBASE
    let retries = 0;
    while(!window.db && retries < 15) {
        await new Promise(r => setTimeout(r, 100));
        retries++;
    }

    // 2. Traer canciones de tu Comunidad (Aumentado a 100)
    try {
        if(window.db) {
            let snapshot = await window.db.collection("globalSongs").limit(100).get();
            snapshot.forEach(doc => {
                let data = doc.data();
                if (!query || data.title.toLowerCase().includes(query.toLowerCase())) {
                    fbSongs.push({
                        id: doc.id, title: data.title, artist: `Subido por: ${data.uploader}`,
                        imageURL: data.imageURL || 'icon.png', isOsu: false,
                        keysAvailable: [4, 6, 7, 9], raw: { ...data, id: doc.id }
                    });
                }
            });
        }
    } catch(e) { console.warn("Error DB Local", e); }

    // 3. Traer mapas de Osu! (MODO DOUBLE FETCH)
    try {
        let safeQuery = query.trim();
        let rawOsuData = [];
        
        if (safeQuery === "") {
            // Palabras clave para llenar la pantalla
            const terms = ["camellia", "miku", "fnf", "vocaloid", "touhou", "remix", "nightcore", "osu", "kpop", "rock", "pop", "electronic"];
            // Las revolvemos para elegir 2 al azar diferentes cada vez que abres el juego
            const shuffled = terms.sort(() => 0.5 - Math.random());
            
            // Hacemos 2 búsquedas AL MISMO TIEMPO para traer el doble de resultados
            const [res1, res2] = await Promise.all([
                fetch(`https://api.nerinyan.moe/search?q=${encodeURIComponent(shuffled[0])}&m=3`),
                fetch(`https://api.nerinyan.moe/search?q=${encodeURIComponent(shuffled[1])}&m=3`)
            ]);
            
            const d1 = await res1.json();
            const d2 = await res2.json();
            
            if(Array.isArray(d1)) rawOsuData = rawOsuData.concat(d1);
            if(Array.isArray(d2)) rawOsuData = rawOsuData.concat(d2);
            
        } else {
            // Si el jugador escribió algo específico, busca normal
            const res = await fetch(`https://api.nerinyan.moe/search?q=${encodeURIComponent(safeQuery)}&m=3`);
            const d = await res.json();
            if(Array.isArray(d)) rawOsuData = d;
        }

        // Limpiar canciones repetidas (por si las dos búsquedas traen la misma)
        const uniqueOsuData = Array.from(new Map(rawOsuData.map(item => [item.id, item])).values());
        
        uniqueOsuData.forEach(set => {
            const maniaBeatmaps = set.beatmaps.filter(b => b.mode_int === 3 || b.mode === 3 || b.mode === 'mania');
            if(maniaBeatmaps.length > 0) {
                let keys = [...new Set(maniaBeatmaps.map(b => Math.floor(b.cs)))].sort((a,b)=>a-b);
                osuSongs.push({
                    id: set.id, title: set.title, 
                    artist: `Subido por: ${set.creator}`, 
                    imageURL: `https://assets.ppy.sh/beatmaps/${set.id}/covers/list@2x.jpg`,
                    isOsu: true, keysAvailable: keys, raw: set
                });
            }
        });
    } catch(e) { console.warn("Error Osu API", e); }

    // 4. EL TOQUE MÁGICO: Unimos tus canciones y las de Osu, ¡y las REVOLVEMOS!
    let finalMix = [...fbSongs, ...osuSongs];
    
    // Si el usuario NO está buscando nada específico, revolvemos toda la galería para que luzca épico
    if (query.trim() === "") {
        finalMix = finalMix.sort(() => 0.5 - Math.random());
    }

    window.unifiedSongs = finalMix; 
    renderUnifiedGrid();
};

// --- DIBUJADO DE TARJETAS (ESTILO FORZADO INQUEBRANTABLE) ---
window.renderUnifiedGrid = function() {
    const grid = document.getElementById('song-grid');
    if(!grid) return;
    grid.innerHTML = '';

    let filtered = window.unifiedSongs.filter(song => {
        if (window.currentFilters.type === 'osu' && !song.isOsu) return false;
        if (window.currentFilters.type === 'com' && song.isOsu) return false;
        if (window.currentFilters.key !== 'all') {
            let reqKey = parseInt(window.currentFilters.key);
            if (!song.keysAvailable.includes(reqKey)) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<div style="width:100%; text-align:center; padding:50px; color:#ff66aa; font-weight:bold; font-size:1.5rem;">No se encontraron mapas con estos filtros. 🌸</div>';
        return;
    }

    filtered.forEach(song => {
        const card = document.createElement('div');
        card.className = 'song-card'; 
        card.style.cssText = 'position: relative; height: 180px; border-radius: 12px; overflow: hidden; cursor: pointer; border: 2px solid transparent; transition: transform 0.2s, box-shadow 0.2s; background: #111;';
        
        if(song.isOsu) {
            card.style.borderColor = '#ff66aa';
            card.style.boxShadow = '0 0 15px rgba(255, 102, 170, 0.2)';
        }
        
        let badgesHTML = song.keysAvailable.map(k => `<div class="diff-badge" style="padding: 2px 8px; border: 1px solid #00ffff; color: #00ffff; border-radius: 5px; font-size: 0.8rem; font-weight: bold;">${k}K</div>`).join('');
        
        if(song.isOsu) {
            badgesHTML += `<div class="diff-badge" style="margin-left:auto; border: 1px solid #ff66aa; color: #ff66aa; padding: 2px 8px; border-radius: 5px; font-size: 0.8rem; font-weight: bold; background: rgba(255,102,170,0.1); box-shadow:0 0 8px rgba(255,102,170,0.4);">🌸 OSU!</div>`;
        }

        card.innerHTML = `
            <div class="song-bg" style="position: absolute; top:0; left:0; width:100%; height:100%; background-image: url('${song.imageURL}'), url('icon.png'); background-size: cover; background-position: center; opacity: 0.7;"></div>
            <div class="song-info" style="position: absolute; bottom: 0; left: 0; width: 100%; padding: 15px; background: linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.7), transparent);">
                <div class="song-title" style="font-size: 1.2rem; font-weight: 900; color: white; text-shadow: 0 2px 4px black; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.title}</div>
                <div class="song-author" style="font-size: 0.9rem; color: #ccc; font-weight: bold; margin-bottom: 10px;">${song.artist}</div>
                <div style="display:flex; gap:5px; flex-wrap:wrap; align-items:center;">
                    ${badgesHTML}
                </div>
            </div>
        `;
        
        card.onmouseenter = () => { card.style.transform = 'scale(1.03)'; card.style.boxShadow = song.isOsu ? '0 0 25px rgba(255, 102, 170, 0.5)' : '0 0 20px rgba(0, 255, 255, 0.3)'; };
        card.onmouseleave = () => { card.style.transform = 'scale(1)'; card.style.boxShadow = song.isOsu ? '0 0 15px rgba(255, 102, 170, 0.2)' : 'none'; };
        
        card.onclick = () => openUnifiedDiffModal(song);
        grid.appendChild(card);
    });
};

// --- MENÚ DE DIFICULTADES UNIFICADO (CON CANDADOS) ---
// --- MENÚ DE DIFICULTADES UNIFICADO (CON CANDADOS Y EDITOR) ---
window.openUnifiedDiffModal = function(song) {
    const titleEl = document.getElementById('diff-song-title');
    const coverEl = document.getElementById('diff-song-cover');
    titleEl.innerText = song.title;
    coverEl.style.backgroundImage = `url('${song.imageURL}')`;
    
    const grid = document.querySelector('.diff-grid');
    grid.innerHTML = ''; 
    
const colors = {1: '#ffffff', 2: '#55ff55', 3: '#5555ff', 4: '#00FFFF', 5: '#a200ff', 6: '#12FA05', 7: '#FFD700', 8: '#ff8800', 9: '#F9393F', 10: '#ff0000'};
    const labels = {1: 'RHYTHM', 2: 'BASIC', 3: 'EASY', 4: 'EASY', 5: 'NORMAL', 6: 'NORMAL', 7: 'INSANE', 8: 'EXPERT', 9: 'DEMON', 10: 'IMPOSSIBLE'};
    
    // 1. DIBUJAR LOS BOTONES Y CANDADOS
    const standardModes = [4, 6, 7, 9];
    let allModes = [...new Set([...standardModes, ...song.keysAvailable])].sort((a,b) => a - b);
    
    allModes.forEach(k => {
        let c = colors[k] || '#ff66aa';
        let l = labels[k] || 'CUSTOM';
        let btn = document.createElement('div');
        btn.className = 'diff-card';
        
        if (song.keysAvailable.includes(k)) {
            // Botón jugable
            btn.style.borderColor = c; 
            btn.style.color = c;
            btn.innerHTML = `<div class="diff-bg-icon">${k}K</div><div class="diff-num">${k}K</div><div class="diff-label">${l}</div>`;
            btn.onclick = () => {
                closeModal('diff');
                if(song.isOsu) {
                    if(typeof downloadAndPlayOsu === 'function') downloadAndPlayOsu(song.id, song.title, song.imageURL, k);
                    else alert("Error: osu.js no conectado");
                } else {
                    window.curSongData = song.raw; startGame(k);
                }
            };
        } else {
            // Botón con candado
            btn.style.borderColor = '#333';
            btn.style.color = '#555';
            btn.style.background = 'rgba(0,0,0,0.6)';
            btn.style.cursor = 'not-allowed';
            btn.style.boxShadow = 'none';
            btn.innerHTML = `<div class="diff-bg-icon" style="opacity: 0.1;">${k}K</div><div class="diff-num">🔒 ${k}K</div><div class="diff-label">NO DISPONIBLE</div>`;
        }
        grid.appendChild(btn);
    });

    // 2. EL BOTÓN DEL EDITOR (SOLO PARA TUS CANCIONES)
    if (!song.isOsu) {
        let editBtn = document.createElement('div');
        editBtn.className = 'diff-card';
        editBtn.style.gridColumn = "1 / -1"; // Hace que el botón abarque todo lo ancho de la cuadrícula
        editBtn.style.borderColor = "#ff66aa";
        editBtn.style.color = "#ff66aa";
        editBtn.style.marginTop = "10px";
        editBtn.innerHTML = `
            <div class="diff-bg-icon">✏️</div>
            <div class="diff-num">✏️ EDITOR STUDIO</div>
            <div class="diff-label">Crea y edita tu propio mapa</div>
        `;
        editBtn.onclick = () => {
            closeModal('diff');
            if(typeof openEditor === 'function') openEditor(song.raw, 4);
            else alert("Error: El archivo editor.js no está conectado en el index.html");
        };
        grid.appendChild(editBtn);
    }

    openModal('diff');
};

// === MOTOR DEL CREATOR STUDIO ===
// === MOTOR DEL CREATOR STUDIO (CON DETECTOR DE SESIÓN BLINDADO) ===
// === MOTOR DEL CREATOR STUDIO (100% SEGURO Y SILENCIOSO) ===
window.openStudioDashboard = async function() {
    openModal('studio');
    const grid = document.getElementById('studio-grid');
    const loader = document.getElementById('studio-loading');
    grid.innerHTML = '';
    loader.style.display = 'block';

    // === 1. VERIFICACIÓN DE SEGURIDAD ESTRICTA ===
    let myUsername = null;

    // A) Buscar directamente en el núcleo de Firebase (Lo más seguro)
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        myUsername = firebase.auth().currentUser.displayName;
    }

    // B) Buscar en la memoria de tu juego (Por si usas login personalizado)
    if (!myUsername) {
        myUsername = window.username || 
                     (window.user && window.user.username) || 
                     localStorage.getItem('username');
    }

    // C) Si no hay sesión válida, BLOQUEAMOS EL ACCESO. Sin ventanitas falsas.
    if (!myUsername || myUsername === "Guest" || myUsername.trim() === "") {
        loader.innerHTML = "⚠️ <b>ACCESO DENEGADO</b><br><br>Debes iniciar sesión en la barra lateral para ver y editar tus mapas.";
        loader.style.color = "var(--miss)";
        return;
    }

    // === 2. OBTENER MAPAS ===
    try {
        // Le pedimos a Firebase SOLO las canciones de tu usuario verificado
        let snapshot = await window.db.collection("globalSongs").where("uploader", "==", myUsername).get();
        loader.style.display = 'none';

        if (snapshot.empty) {
            grid.innerHTML = `<div style="width:100%; text-align:center; padding:50px; color:#aaa; font-size:1.2rem; font-weight:bold;">Aún no has subido ninguna canción. <br><br> ¡Sube tu primer MP3 en la barra lateral para empezar a mapear! ☁️</div>`;
            return;
        }

        // === 3. DIBUJAR TARJETAS ===
        snapshot.forEach(doc => {
            let song = doc.data();
            song.id = doc.id; 

            const card = document.createElement('div');
            card.className = 'song-card'; 
            card.style.cssText = 'position: relative; height: 180px; border-radius: 12px; overflow: hidden; border: 2px solid #00ffff; box-shadow: 0 0 15px rgba(0, 255, 255, 0.2); display:flex; flex-direction:column; background:#111;';
            
            card.innerHTML = `
                <div class="song-bg" style="position: absolute; top:0; left:0; width:100%; height:100%; background-image: url('${song.imageURL || 'icon.png'}'); background-size: cover; background-position: center; opacity: 0.4;"></div>
                
                <div style="position:relative; z-index:2; padding:15px; flex:1;">
                    <div style="font-size: 1.2rem; font-weight: 900; color: white; text-shadow: 0 2px 4px black; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.title}</div>
                    <div style="font-size: 0.8rem; color: #ccc; margin-top:5px; font-weight:bold;">Artista: ${song.author || 'Desconocido'}</div>
                </div>
                
                <div style="position:relative; z-index:2; display:flex; gap:10px; padding:10px; background:rgba(0,0,0,0.85); border-top:1px solid #333;">
                    <button class="action btn-edit" style="flex:1; padding:5px; font-size:0.8rem; background:#ff66aa; color:black; width:auto; margin:0; box-shadow:0 0 10px rgba(255,102,170,0.4);">✏️ EDITAR MAPA</button>
                    <button class="action btn-del" style="flex:1; padding:5px; font-size:0.8rem; border-color:#F9393F; color:#F9393F; background:transparent; width:auto; margin:0;">🗑️ BORRAR</button>
                </div>
            `;
            
            // Botón de Editar
            card.querySelector('.btn-edit').onclick = () => {
                closeModal('studio');
                if(typeof openEditor === 'function') openEditor(song, 4); 
                else alert("Error: El archivo editor.js no está conectado.");
            };
            
            // Botón de Borrar
            card.querySelector('.btn-del').onclick = async () => {
                if(confirm(`¿Seguro que quieres borrar "${song.title}" para siempre?`)) {
                    card.style.opacity = '0.5';
                    await window.db.collection('globalSongs').doc(song.id).delete();
                    openStudioDashboard(); // Recargar la lista
                }
            };

            grid.appendChild(card);
        });

    } catch(e) {
        console.error(e);
        loader.innerText = "Error al conectar con tu Nube.";
        loader.style.color = "var(--miss)";
    }
};

// === MOTOR DEL MENÚ DE TECLAS DINÁMICO ===
window.renderKeyInputs = function() {
    const k = parseInt(document.getElementById('k-selector').value);
    const container = document.getElementById('key-inputs-container');
    if (!container) return;
    container.innerHTML = '';
    
    // Dibujamos tantos botones como K hayamos elegido
    for(let i = 0; i < k; i++) {
        let btn = document.createElement('button');
        
        // Limpiamos el texto para que "KeyD" se vea como "D" y "Space" como "ESPACIO"
        let keyName = window.cfg.keys[k][i].replace('Key', '').replace('Space', 'ESPACIO');
        
        btn.style.cssText = 'padding:10px 15px; background:#333; color:white; border:2px solid #555; border-radius:8px; cursor:pointer; font-weight:bold; min-width:45px; transition:0.2s;';
        btn.innerText = keyName;
        
        // Al darle clic al botón, espera la siguiente tecla
        btn.onclick = function() {
            btn.innerText = 'PRESIONA...';
            btn.style.borderColor = '#ff66aa';
            btn.style.boxShadow = '0 0 10px #ff66aa';
            
            const handler = (e) => {
                e.preventDefault();
                window.cfg.keys[k][i] = e.code; // Guarda el código de la tecla real
                btn.innerText = e.code.replace('Key', '').replace('Space', 'ESPACIO');
                btn.style.borderColor = '#00ffff';
                btn.style.boxShadow = 'none';
                document.removeEventListener('keydown', handler);
            };
            document.addEventListener('keydown', handler);
        };
        container.appendChild(btn);
    }
};

window.saveNewKeys = function() {
    localStorage.setItem('cfg', JSON.stringify(window.cfg));
    alert("¡Teclas guardadas exitosamente para este modo!");
};

// Asegurarnos de que dibuje los botones al abrir el modal de ajustes
const oldOpenModal = window.openModal;
window.openModal = function(id) {
    if(oldOpenModal) oldOpenModal(id);
    else document.getElementById('modal-' + id).style.display = 'flex'; // Tu lógica base

    if(id === 'settings' || id === 'ajustes') {
        setTimeout(renderKeyInputs, 100); // Llama a dibujar los botones
    }
};
