/* === UI LOGIC & INTERACTION (MASTER VERSION V13) === */

// === 1. HELPERS & SISTEMA DE NOTIFICACIONES ===

function notify(msg, type="info", duration=4000) {
    const area = document.getElementById('notification-area');
    if(!area) return console.log(msg); // Fallback
    
    const card = document.createElement('div');
    card.className = 'notify-card';
    
    // Colores por tipo
    if(type==="error") card.style.borderLeftColor = "#F9393F";
    else if(type==="success") card.style.borderLeftColor = "#12FA05";
    else card.style.borderLeftColor = "#44ccff";
    
    card.innerHTML = `
        <div class="notify-title">${type.toUpperCase()}</div>
        <div class="notify-body">${msg}</div>
    `;
    
    area.appendChild(card);
    
    // Animación de salida
    setTimeout(() => {
        card.style.animation = "slideOut 0.3s forwards";
        setTimeout(() => card.remove(), 300);
    }, duration);
}

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

// === 2. ACTUALIZACIÓN DE LA INTERFAZ (CORE) ===

function updUI() {
    if(!user || !cfg) return;

    // Inicializar valores si faltan
    if(cfg.middleScroll === undefined) cfg.middleScroll = false;
    if(cfg.trackOp === undefined) cfg.trackOp = 10;
    if(cfg.noteOp === undefined) cfg.noteOp = 100;
    if(cfg.noteScale === undefined) cfg.noteScale = 1;

    // Textos del Perfil
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

    // HUD EN JUEGO (Indicadores FC, Mean, Combo)
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

    // Mostrar/Ocultar paneles de Login
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
            if(doc.id === user.name) rank = "#" + (index + 1);
        });
        setText('p-global-rank', rank);
    }).catch(()=>{});
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
        if (cfg.middleScroll) track.classList.add('middle-scroll');
        else track.classList.remove('middle-scroll');
    }
}

// === 3. MENÚ DE AJUSTES (ESTILO MODERNO 3 COLUMNAS) ===

function openSettingsMenu() {
    const modal = document.getElementById('modal-settings');
    if(!modal) return;
    
    // Aseguramos que tenga la clase ancha
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
                <button class="set-tab-btn" onclick="switchSetTab('visuals')">🎨 VISUALS</button>
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
        html += renderRange('Velocidad (Scroll Speed)', 'spd', 10, 40);
        html += renderRange('Dificultad IA (Random)', 'den', 1, 10);
        html += renderRange('Offset Global (ms)', 'off', -200, 200);
    } 
    else if (tab === 'visuals') {
        html += renderToggle('Vivid Lights', 'vivid');
        html += renderToggle('Screen Shake', 'shake');
        html += renderToggle('Mostrar Juez', 'judgeVis');
        html += renderToggle('Mostrar FC Status', 'showFC');
        html += renderToggle('Mostrar Mean MS', 'showMean');
        html += renderRange('Opacidad Carril (%)', 'trackOp', 0, 100);
        html += renderRange('Opacidad Notas (%)', 'noteOp', 10, 100);
        html += renderRange('Tamaño Nota (Escala)', 'noteScale', 0.5, 1.5, 0.1);
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
        html += `<div class="kb-tabs">
            <div class="kb-tab active" id="tab-4" onclick="renderLaneConfig(4)">4K</div>
            <div class="kb-tab" id="tab-6" onclick="renderLaneConfig(6)">6K</div>
            <div class="kb-tab" id="tab-7" onclick="renderLaneConfig(7)">7K</div>
            <div class="kb-tab" id="tab-9" onclick="renderLaneConfig(9)">9K</div>
        </div>
        <div class="lane-cfg-box"><div id="lanes-container" class="lanes-view"></div></div>`;
        // Renderizar carriles después de inyectar HTML
        setTimeout(() => renderLaneConfig(4), 50);
    }

    content.innerHTML = html;
    updatePreview(); // Actualizar la nota de ejemplo
}

function updatePreview() {
    const box = document.getElementById('preview-box');
    if (!box) return;
    
    // Obtener la configuración actual para la nota
    // Usamos el carril 0 del modo 4K como ejemplo
    const sampleLane = cfg.modes[4][0];
    const shapePath = (typeof PATHS !== 'undefined') ? (PATHS[sampleLane.s] || PATHS['circle']) : "";
    const scale = cfg.noteScale || 1;
    const opacity = (cfg.noteOp || 100) / 100;
    
    box.innerHTML = `
        <div class="preview-note" style="transform: scale(${scale}); opacity: ${opacity}; transition: 0.1s;">
            <svg viewBox="0 0 100 100" style="width:100%; height:100%; filter: drop-shadow(0 0 15px ${sampleLane.c});">
                <path d="${shapePath}" fill="${sampleLane.c}" stroke="white" stroke-width="5" />
            </svg>
        </div>
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

// === 4. HANDLERS GLOBALES (MODALES) ===
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
                // Color fallback si no hay imagen
                let hash = 0;
                for (let i = 0; i < curSongData.id.length; i++) hash = curSongData.id.charCodeAt(i) + ((hash << 5) - hash);
                const hue = Math.abs(hash % 360);
                cover.style.backgroundImage = `linear-gradient(135deg, hsl(${hue}, 60%, 20%), #000)`;
            }
        }
    }
};

function closeModal(id){ document.getElementById('modal-'+id).style.display='none'; }

// === 5. CANCIONES Y MENÚ (CON REINTENTO) ===
let globalSongsListener = null;
function renderMenu(filter="") {
    if(!db) {
        // Si la DB no está lista, esperar y reintentar
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
            
            let scoreTag = '';
            if(user.scores && user.scores[songId]) {
                const us = user.scores[songId];
                scoreTag = `<span class="tag rank-tag" style="color:gold; margin-left:5px;">${us.rank}</span>`;
            }

            c.innerHTML = `
                <div class="bc-bg" style="${bgStyle}"></div>
                <div class="bc-info">
                    <div class="bc-title">${s.title}</div>
                    <div class="bc-meta">Subido por: ${s.uploader} ${scoreTag}</div>
                </div>`;
            c.onclick = () => { 
                curSongData = { id: songId, ...s }; 
                openModal('diff'); 
            };
            grid.appendChild(c);
        });
    });
}

function openFriends() {
    if(user.name === "Guest") return notify("Inicia sesión primero", "error");
    if(!db) return notify("Error de conexión", "error");
    
    const reqList = document.getElementById('req-list');
    const friList = document.getElementById('friend-list');
    
    db.collection("users").doc(user.name).onSnapshot(doc => {
        if(!doc.exists) return;
        const data = doc.data();
        
        // 1. Solicitudes
        if(reqList) {
            reqList.innerHTML = '';
            if(data.requests && data.requests.length > 0) {
                data.requests.forEach(reqName => {
                    const row = document.createElement('div');
                    row.className = 'friend-row';
                    // Usamos onclick inline con comillas simples escapadas si fuera necesario, 
                    // pero nombres de usuario simples no dan problema.
                    row.innerHTML = `
                        <span class="friend-row-name" style="color:white">${reqName}</span>
                        <div style="display:flex; gap:10px;">
                            <button class="btn-small btn-acc" onclick="window.respondFriend('${reqName}', true)">✔</button>
                            <button class="btn-small" style="background:#F9393F" onclick="window.respondFriend('${reqName}', false)">✕</button>
                        </div>`;
                    reqList.appendChild(row);
                });
            } else {
                reqList.innerHTML = '<div style="color:#666; font-size:0.8rem; padding:10px;">Sin solicitudes.</div>';
            }
        }

        // 2. Amigos
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
                    // Cargar foto
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

// === ACTUALIZACIÓN DEL PANEL DE HOST (DESDE ONLINE.JS) ===
window.updateHostPanelUI = function(players) {
    const list = document.getElementById('hp-players-list');
    const count = document.getElementById('hp-count');
    const btnStart = document.getElementById('btn-start-match');
    
    if(!list || !count) return;
    
    count.innerText = players.length;
    list.innerHTML = '';
    
    players.forEach(p => {
        const isHost = (p.name === players[0].name); // Asumimos el primero es host
        list.innerHTML += `
            <div class="hp-player-row ${isHost ? 'is-host' : ''}">
                <div class="hp-p-av" style="background-image:url(${p.avatar||''})"></div>
                <div class="hp-p-name">${p.name} ${isHost ? '<span style="color:gold">★</span>' : ''}</div>
                <div class="hp-p-status" style="color:lime">LISTO</div>
            </div>`;
    });

    // Solo el host ve el botón de iniciar
    if(btnStart) {
        // Chequeo simple: si soy el primero de la lista, soy host
        if(players.length > 0 && players[0].name === user.name) {
            btnStart.style.display = 'block';
        } else {
            btnStart.style.display = 'none';
        }
    }
};

// Función para abrir el panel (Host o Cliente)
window.openHostPanel = function(songData) {
    if(!songData) return;
    curSongData = songData; 
    
    const modal = document.getElementById('modal-host');
    const panel = modal.querySelector('.modal-panel');
    panel.className = "modal-panel host-panel-compact";
    
    let bgStyle = songData.imageURL ? `background-image:url(${songData.imageURL})` : 'background: linear-gradient(to right, #222, #111)';

    panel.innerHTML = `
        <div class="hp-header" style="${bgStyle}">
            <div class="hp-title-info">
                <div class="hp-song-title">${songData.title}</div>
                <div class="hp-meta">By ${songData.uploader}</div>
            </div>
        </div>
        <div class="hp-body">
            <div class="hp-config-col">
                <div>
                    <div class="hp-section-title">Modos Permitidos</div>
                    <div class="hp-checkbox-group">
                        <label class="hp-chk-label"><input type="checkbox" id="chk-4k" checked disabled> <span>4K</span></label>
                        <label class="hp-chk-label"><input type="checkbox" id="chk-6k" disabled> <span>6K</span></label>
                    </div>
                </div>
                <div>
                    <div class="hp-section-title">Dificultad IA</div>
                    <div class="set-row">
                        <span class="set-label">Densidad</span>
                        <div class="num-input" style="width:100%">${cfg.lobbyDen || 5}</div>
                    </div>
                </div>
            </div>
            <div class="hp-players-col">
                <div class="hp-section-title">Jugadores (<span id="hp-count">1</span>/8)</div>
                <div id="hp-players-list"></div>
            </div>
        </div>
        <div class="hp-footer">
            <button class="action secondary" style="width:auto; padding:12px 25px;" onclick="closeModal('host'); leaveLobby();">SALIR</button>
            <button id="btn-start-match" class="action btn-add" style="width:auto; padding:12px 35px; display:none;" onclick="startLobbyMatch()">COMENZAR</button>
        </div>
    `;
    
    modal.style.display = 'flex';
};
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
                    
                    // Cargar avatar
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
function openHostPanel(songData) {
    if(!songData) return;
    curSongData = songData; // Asegurar que la canción actual es esta
    
    const modal = document.getElementById('modal-host');
    const panel = modal.querySelector('.modal-panel');
    panel.className = "modal-panel host-panel-compact";
    
    let bgStyle = songData.imageURL ? `background-image:url(${songData.imageURL})` : 'background: linear-gradient(to right, #222, #111)';

    panel.innerHTML = `
        <div class="hp-header" style="${bgStyle}">
            <div class="hp-title-info">
                <div class="hp-song-title">${songData.title}</div>
                <div class="hp-meta">By ${songData.uploader}</div>
            </div>
        </div>
        <div class="hp-body">
            <div class="hp-config-col">
                <div>
                    <div class="hp-section-title">Modos Permitidos</div>
                    <div class="hp-checkbox-group">
                        <label class="hp-chk-label"><input type="checkbox" id="chk-4k" checked> <span>4K</span></label>
                        <label class="hp-chk-label"><input type="checkbox" id="chk-6k" checked> <span>6K</span></label>
                        <label class="hp-chk-label"><input type="checkbox" id="chk-7k" checked> <span>7K</span></label>
                    </div>
                </div>
                <div>
                    <div class="hp-section-title">Densidad IA (Dificultad)</div>
                    ${renderRange('Densidad', 'lobbyDen', 1, 10)}
                </div>
                 <div>
                    <div class="hp-section-title">Apuesta (Ranked)</div>
                     ${renderToggle('Ranked Match (PP Bet)', 'lobbyRanked')}
                </div>
            </div>
            <div class="hp-players-col">
                <div class="hp-section-title">Jugadores (<span id="hp-count">1</span>/8)</div>
                <div id="hp-players-list">
                    <div class="hp-player-row is-host">
                        <div class="hp-p-av" style="background-image:url(${user.avatarData||''})"></div>
                        <div class="hp-p-name">${user.name} (Host)</div>
                    </div>
                </div>
            </div>
        </div>
        <div class="hp-footer">
            <button class="action secondary" style="width:auto; padding:12px 25px;" onclick="closeModal('host'); leaveLobby();">CANCELAR</button>
            <button class="action btn-add" style="width:auto; padding:12px 35px;" onclick="startLobbyMatch()">COMENZAR PARTIDA</button>
        </div>
    `;
    
    // Valores por defecto para el lobby
    cfg.lobbyDen = 5;
    cfg.lobbyRanked = false;
    applyCfg(); // Para actualizar los sliders visualmente

    modal.style.display = 'flex';
    createLobby(songData.id); // Crear el lobby en Firebase
}

function showFriendProfile(targetName) {
    if(!targetName) return;
    setText('fp-name', targetName);
    setText('fp-lvl', "Cargando...");
    document.getElementById('fp-av').style.backgroundImage = '';
    
    db.collection("users").doc(targetName).get().then(doc => {
        if(doc.exists) {
            const d = doc.data();
            setText('fp-lvl', "LVL " + (d.lvl || 1));
            setText('fp-score', (d.score || 0).toLocaleString());
            if(d.avatarData) document.getElementById('fp-av').style.backgroundImage = `url(${d.avatarData})`;
            
            const btn = document.getElementById('btn-challenge');
            if(btn) {
                btn.disabled = false;
                // El desafío usa una versión simplificada del host
                btn.onclick = () => { 
                    closeModal('friend-profile');
                    notify("Función de desafío directo en desarrollo. Usa el Host normal por ahora.", "info");
                    // TODO: Implementar challengeDirecto(targetName)
                };
            }
            closeModal('friends');
            openModal('friend-profile');
        }
    });
}

// === 7. FUNCIONES VARIAS ===
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

// === TIENDA ===
function openShop() {
    setText('shop-sp', (user.sp || 0).toLocaleString());
    const grid = document.getElementById('shop-items');
    if(grid && typeof SHOP_ITEMS !== 'undefined') {
        grid.innerHTML = '';
        SHOP_ITEMS.forEach(item => {
            const owned = user.inventory && user.inventory.includes(item.id);
            const equipped = user.equipped && user.equipped[item.type] === item.id;
            const div = document.createElement('div');
            div.className = 'shop-item';
            if (owned) div.style.borderColor = "var(--blue)";
            div.innerHTML = `
                <div class="shop-icon" style="background-color:${item.color || '#333'}"></div>
                <div class="shop-name">${item.name}</div>
                <div class="shop-price">${owned ? 'ADQUIRIDO' : item.price + ' SP'}</div>
                <button class="btn-small ${owned?'btn-chat':'btn-add'}" onclick="${owned ? `equipItem('${item.id}','${item.type}')` : `buyItem('${item.id}',${item.price})`}">${owned ? (equipped?'EQUIPADO':'EQUIPAR') : 'COMPRAR'}</button>
            `;
            grid.appendChild(div);
        });
    }
    const m = document.getElementById('modal-shop');
    if(m) m.style.display='flex';
}

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
