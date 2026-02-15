/* === UI LOGIC & INTERACTION (FULL MASTER VERSION V17) === */

// ==========================================
// 1. HELPERS & NOTIFICACIONES
// ==========================================

// ==========================================
// 3. NOTIFICACIONES PERSISTENTES (DESAFÍOS)
// ==========================================

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
// PANEL DE HOST CON SISTEMA READY
// ==========================================

// 1. Abrir el panel (Configuración inicial)
window.openHostPanel = function(songData, isClient = false) {
    if(!songData) return;
    curSongData = songData; 
    
    // Asegurar que el juego está detenido
    if(typeof st !== 'undefined') st.act = false;
    document.getElementById('game-layer').style.display = 'none';

    const modal = document.getElementById('modal-host');
    const panel = modal.querySelector('.modal-panel');
    panel.className = "modal-panel host-panel-compact";
    
    // Si soy cliente, muestro boton de Ready. Si soy host, boton de Start.
    const iamHost = !isClient;
    window.isLobbyHost = iamHost;

    const bgStyle = songData.imageURL ? `background-image:url(${songData.imageURL})` : 'background: #222';

    panel.innerHTML = `
        <div class="hp-header" style="${bgStyle}">
            <div class="hp-title-info">
                <div class="hp-song-title">${songData.title}</div>
                <div class="hp-meta">By ${songData.uploader}</div>
            </div>
        </div>
        <div class="hp-body">
            <div class="hp-config-col">
                <div class="hp-section-title">CONFIGURACIÓN</div>
                <div class="set-row">
                    <span>Modo</span>
                    <strong style="color:var(--blue)" id="hp-mode-disp">4K</strong>
                </div>
                <div class="set-row">
                    <span>Dificultad</span>
                    <strong style="color:var(--good)" id="hp-den-disp">5</strong>
                </div>
            </div>
            <div class="hp-players-col">
                <div class="hp-section-title">JUGADORES (<span id="hp-count">1</span>/8)</div>
                <div id="hp-players-list"></div>
            </div>
        </div>
        <div class="hp-footer">
            <button class="action secondary" style="width:auto; padding:12px 25px;" onclick="closeModal('host'); leaveLobbyData();">SALIR</button>
            
            ${iamHost 
                ? `<button id="btn-start-match" class="action btn-add" style="width:auto; padding:12px 35px; opacity:0.5; pointer-events:none;" onclick="startLobbyMatchData()">ESPERANDO...</button>` 
                : `<button id="btn-ready-toggle" class="action" style="width:auto; padding:12px 35px; background:#444;" onclick="toggleReadyData()">NO LISTO</button>`
            }
        </div>
    `;
    
    modal.style.display = 'flex';
};

// 2. Actualizar lista de jugadores y estados (Se llama cada vez que alguien cambia)
window.updateHostPanelUI = function(players, hostName) {
    const list = document.getElementById('hp-players-list');
    const count = document.getElementById('hp-count');
    const btnStart = document.getElementById('btn-start-match');
    const btnReady = document.getElementById('btn-ready-toggle');
    
    if(!list || !count) return;
    
    count.innerText = players.length;
    list.innerHTML = '';
    
    let allReady = true;
    let meReady = false;

    players.forEach(p => {
        const isHost = (p.name === hostName);
        const isReady = p.status === 'ready';
        
        if(!isReady) allReady = false;
        if(p.name === user.name && isReady) meReady = true;

        const statusColor = isReady ? 'var(--good)' : '#666';
        const statusText = isReady ? 'LISTO' : 'ESPERANDO';

        list.innerHTML += `
            <div class="hp-player-row ${isHost ? 'is-host' : ''}" style="border-left: 4px solid ${statusColor};">
                <div class="hp-p-av" style="background-image:url(${p.avatar||''})"></div>
                <div class="hp-p-name">${p.name} ${isHost ? '<span style="color:gold">★</span>' : ''}</div>
                <div class="hp-p-status" style="color:${statusColor}; font-weight:900;">${statusText}</div>
            </div>`;
    });

    // Lógica del botón de Host (Start)
    if(btnStart) {
        if(allReady && players.length > 1) { // Debe haber al menos 2 y todos listos
            btnStart.style.opacity = '1';
            btnStart.style.pointerEvents = 'auto';
            btnStart.innerText = "COMENZAR PARTIDA";
            btnStart.classList.add('pulse');
        } else {
            btnStart.style.opacity = '0.5';
            btnStart.style.pointerEvents = 'none';
            btnStart.innerText = players.length === 1 ? "ESPERANDO RIVAL..." : "ESPERANDO A TODOS...";
            btnStart.classList.remove('pulse');
        }
    }

    // Lógica del botón de Cliente (Ready)
    if(btnReady) {
        if(meReady) {
            btnReady.innerText = "¡ESTOY LISTO!";
            btnReady.style.background = "var(--good)";
            btnReady.style.color = "black";
        } else {
            btnReady.innerText = "MARCAR LISTO";
            btnReady.style.background = "#444";
            btnReady.style.color = "white";
        }
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
window.confirmCreateLobby = function() {
    if(!curSongData) return;
    
    // Crear configuración de sala
    const config = {
        difficulty: 'Normal', // Puedes hacerlo dinámico
        keys: [4], // Por defecto 4K, deberías capturar la selección del usuario
        density: cfg.den || 5,
        ranked: document.getElementById('chk-ranked').checked
    };
    
    notify("Creando sala...", "info");
    
    // Llamar a online.js
    if(window.createLobbyData) {
        window.createLobbyData(curSongData.id, config).then(() => {
            closeModal('diff');
            openModal('host'); // Asumiendo que existe un modal 'host' o 'lobby-room'
        });
    }
};
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

window.renderLobbySongList = function(filter="") {
    const grid = document.getElementById('lobby-song-grid');
    if(!grid || !db) return;

    grid.innerHTML = '<div style="color:#888; text-align:center;">Cargando canciones...</div>';

    db.collection("globalSongs").orderBy("createdAt", "desc").limit(20).get().then(snapshot => {
        grid.innerHTML = '';
        if(snapshot.empty) {
            grid.innerHTML = '<div style="padding:20px; text-align:center;">No hay canciones.</div>';
            return;
        }

        snapshot.forEach(doc => {
            const s = doc.data();
            // Filtrado simple por texto
            if(filter && !s.title.toLowerCase().includes(filter.toLowerCase())) return;

            const div = document.createElement('div');
            // Usamos un estilo de lista más compacto para este modal
            div.style.cssText = "display:flex; align-items:center; gap:10px; background:#111; padding:10px; margin-bottom:5px; border-radius:8px; cursor:pointer; border:1px solid #333; transition:0.2s;";
            div.onmouseover = function(){ this.style.borderColor = 'var(--accent)'; this.style.background = '#222'; };
            div.onmouseout = function(){ this.style.borderColor = '#333'; this.style.background = '#111'; };
            
            // Imagen pequeña
            const bg = s.imageURL ? `url(${s.imageURL})` : 'linear-gradient(45deg, #333, #000)';
            
            div.innerHTML = `
                <div style="width:50px; height:50px; border-radius:6px; background:${bg}; background-size:cover; background-position:center; flex-shrink:0;"></div>
                <div style="flex:1; overflow:hidden;">
                    <div style="font-weight:900; color:white; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${s.title}</div>
                    <div style="font-size:0.8rem; color:#888;">${s.uploader}</div>
                </div>
                <button class="btn-small btn-add">ELEGIR</button>
            `;

            div.onclick = () => selectSongForLobby(doc.id, s);
            grid.appendChild(div);
        });
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
window.confirmCreateLobby = function() {
    if(!curSongData) return notify("Error: Sin canción", "error");
    
    const densityVal = document.getElementById('lobby-density-input') ? document.getElementById('lobby-density-input').value : 5;
    const isRanked = document.getElementById('chk-ranked') ? document.getElementById('chk-ranked').checked : false;
    
    // DETECTAR SI ES DESAFÍO PRIVADO
    const isPrivate = (window.lobbyTargetFriend !== null);

    const config = {
        keys: [window.selectedLobbyKeys || 4], 
        density: parseInt(densityVal),
        ranked: isRanked
    };

    notify("Conectando con servidor...", "info");

    // Pasamos isPrivate a createLobbyData
    if (window.createLobbyData) {
        window.createLobbyData(curSongData.id, config, isPrivate)
            .then((lobbyId) => {
                notify("Sala creada", "success");
                closeModal('diff');
                
                // ENVIAR NOTIFICACIÓN
                if(window.lobbyTargetFriend) {
                    sendChallengeNotification(window.lobbyTargetFriend, lobbyId, curSongData.title);
                }

                if(window.openHostPanel) window.openHostPanel(curSongData); 
                
                window.isCreatingLobby = false;
                window.lobbyTargetFriend = null;
            })
            .catch(err => notify("Error: " + err, "error"));
    }
};

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

// Resetear el modo cuando se cierra el modal manualmente
const originalCloseModal = window.closeModal;
window.closeModal = function(id) {
    if(id === 'diff') {
        window.isCreatingLobby = false;
        window.lobbyTargetFriend = null;
        // Ocultar opciones de lobby para la próxima vez que se abra en modo solo
        const opts = document.getElementById('create-lobby-opts');
        if(opts) opts.style.display = 'none';
        
        // Restaurar estilos de tarjetas
        document.querySelectorAll('.diff-card').forEach(c => {
             c.style.border = "2px solid #333";
        });
    }
    // Llamar a la función original de cierre (definida en el UI original)
    document.getElementById('modal-'+id).style.display = 'none';
};

// === TIENDA ===
function openShop() {
    setText('shop-sp', (user.sp || 0).toLocaleString());
    const grid = document.getElementById('shop-items');
    if(grid && typeof SHOP_ITEMS !== 'undefined') {
        grid.innerHTML = '';
        SHOP_ITEMS.forEach(item => {
            const owned = user.inventory && user.inventory.includes(item.id);
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
