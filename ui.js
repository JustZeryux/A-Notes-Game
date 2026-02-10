/* === UI LOGIC & INTERACTION (ULTRA UPDATE V2) === */

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

function updUI() {
    if(!user || !cfg) return;

    // Inicializar valores por defecto si no existen
    if (typeof cfg.middleScroll === 'undefined') cfg.middleScroll = false;
    if (typeof cfg.showMean === 'undefined') cfg.showMean = false;
    if (typeof cfg.showFC === 'undefined') cfg.showFC = true;
    if (typeof cfg.noteSize === 'undefined') cfg.noteSize = 100;

    // Datos de Usuario
    document.getElementById('m-name').innerText = user.name;
    document.getElementById('p-name').innerText = user.name;
    document.getElementById('ig-name').innerText = user.name;
    document.getElementById('h-pp').innerText = user.pp;
    document.getElementById('h-sp').innerText = (user.sp || 0).toLocaleString();
    document.getElementById('p-score').innerText = user.score.toLocaleString();
    document.getElementById('p-plays').innerText = user.plays;
    document.getElementById('p-pp-display').innerText = user.pp;
    document.getElementById('p-sp-display').innerText = (user.sp || 0).toLocaleString();
    document.getElementById('m-rank').innerText = "LVL " + user.lvl;
    document.getElementById('p-lvl-txt').innerText = "LVL " + user.lvl;
    
    // XP Bar
    let xpReq = 1000 * Math.pow(1.05, user.lvl - 1);
    if(user.lvl >= 10) xpReq = 1000 * Math.pow(1.02, user.lvl - 1);
    xpReq = Math.floor(xpReq);
    const pct = Math.min(100, (user.xp / xpReq) * 100);
    document.getElementById('p-xp-bar').style.width = pct + "%";
    document.getElementById('p-xp-txt').innerText = `${Math.floor(user.xp)} / ${xpReq} XP`;
    document.getElementById('p-global-rank').innerText = "#--"; 
    
    if(user.avatarData) { 
        const url = `url(${user.avatarData})`;
        document.getElementById('m-av').style.backgroundImage = url; 
        document.getElementById('m-av').innerText = ""; 
        document.getElementById('p-av-big').style.backgroundImage = url; 
        document.getElementById('ig-av').style.backgroundImage = url; 
    }
    
    if(user.bg) { 
        document.getElementById('bg-image').src = user.bg; 
        document.getElementById('bg-image').style.opacity = 0.3; 
    }

    // APLICAR AJUSTES VISUALES EN TIEMPO REAL
    const track = document.getElementById('track');
    if (track) {
        if (cfg.middleScroll) track.classList.add('middle-scroll');
        else track.classList.remove('middle-scroll');
    }
    document.documentElement.style.setProperty('--track-alpha', (cfg.trackOp || 10) / 100); 
    document.documentElement.style.setProperty('--judge-y', cfg.judgeY + '%'); 
    document.documentElement.style.setProperty('--judge-x', cfg.judgeX + '%'); 
    document.documentElement.style.setProperty('--judge-scale', cfg.judgeS/10); 
    document.documentElement.style.setProperty('--judge-op', cfg.judgeVis ? 1 : 0);

    // INYECTAR HUD EXTRA SI NO EXISTE
    if (!document.getElementById('hud-fc-display') && document.getElementById('game-layer')) {
        const hud = document.getElementById('hud');
        if (hud) {
            const fcDiv = document.createElement('div');
            fcDiv.id = 'hud-fc-display';
            fcDiv.className = 'hud-extra';
            fcDiv.innerHTML = `<div id="val-fc" class="hud-fc"></div><div id="val-mean" class="hud-mean"></div>`;
            document.getElementById('game-layer').appendChild(fcDiv);
        }
    }

    // Actualizar HUD Extra (Mean MS / FC)
    if (typeof st !== 'undefined') {
        const fcEl = document.getElementById('val-fc');
        const meanEl = document.getElementById('val-mean');
        if (fcEl && st.fcStatus) {
            fcEl.innerText = cfg.showFC ? st.fcStatus : "";
            fcEl.style.color = (st.fcStatus==="PFC"?"cyan":(st.fcStatus==="GFC"?"gold":(st.fcStatus==="FC"?"lime":"red")));
        }
        if (meanEl && cfg.showMean && st.hitCount > 0) {
            meanEl.innerText = (st.totalOffset / st.hitCount).toFixed(2) + "ms";
        } else if (meanEl) {
            meanEl.innerText = "";
        }
    }

    const isGoogle = user.pass === "google-auth";
    const localSet = document.getElementById('local-acc-settings');
    if(localSet) localSet.style.display = isGoogle ? 'none' : 'block';
    const googleSet = document.getElementById('google-acc-settings');
    if(googleSet) googleSet.style.display = isGoogle ? 'block' : 'none';
}

function changeSection(sec) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const map = { 
        'songs': 'nav-songs', 'multi': 'nav-multi', 'shop': 'nav-shop', 
        'settings': 'nav-settings', 'rank': 'nav-rank', 'friends': 'nav-friends' 
    };
    if(map[sec]) document.getElementById(map[sec]).classList.add('active');
}

function switchProfileTab(tab) {
    document.querySelectorAll('.settings-tabs .kb-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('ptab-'+tab).classList.add('active');
    document.getElementById('p-tab-content-resumen').style.display = tab === 'resumen' ? 'block' : 'none';
    document.getElementById('p-tab-content-cuenta').style.display = tab === 'cuenta' ? 'block' : 'none';
}

// === SISTEMA DE AJUSTES AVANZADO (ULTRA MENU) ===
function openSettingsMenu() {
    const modal = document.getElementById('modal-settings');
    const panel = modal.querySelector('.modal-panel');
    
    // Inyectar estructura nueva si no existe
    panel.innerHTML = `
        <div class="m-title" style="margin-bottom:20px;">CONFIGURACIÓN</div>
        <div class="settings-layout">
            <div class="settings-sidebar">
                <button class="set-tab-btn active" onclick="switchSetTab('gameplay')">🎮 GAMEPLAY</button>
                <button class="set-tab-btn" onclick="switchSetTab('visuals')">🎨 VISUALS</button>
                <button class="set-tab-btn" onclick="switchSetTab('audio')">🔊 AUDIO</button>
                <button class="set-tab-btn" onclick="switchSetTab('controls')">⌨️ CONTROLS</button>
            </div>
            <div class="settings-content" id="set-content-area">
                </div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
            <button class="action" style="width:auto; padding:10px 30px;" onclick="saveSettings()">GUARDAR</button>
            <button class="action secondary" style="width:auto; padding:10px 30px;" onclick="closeModal('settings')">CANCELAR</button>
        </div>
    `;
    
    modal.style.display = 'flex';
    switchSetTab('gameplay'); // Cargar primera pestaña
}

function switchSetTab(tab) {
    const content = document.getElementById('set-content-area');
    document.querySelectorAll('.set-tab-btn').forEach(b => b.classList.remove('active'));
    // Encontrar botón y activar (simple logic)
    const btns = document.querySelectorAll('.set-tab-btn');
    if(tab==='gameplay') btns[0].classList.add('active');
    if(tab==='visuals') btns[1].classList.add('active');
    if(tab==='audio') btns[2].classList.add('active');
    if(tab==='controls') btns[3].classList.add('active');

    let html = '';
    
    if (tab === 'gameplay') {
        html += renderToggle('Middlescroll', 'middleScroll');
        html += renderToggle('Downscroll', 'down');
        html += renderRange('Velocidad (Scroll Speed)', 'spd', 10, 40);
        html += renderRange('Dificultad IA', 'den', 1, 10);
        html += renderRange('Offset Global (ms)', 'off', -200, 200);
        html += `<div class="set-row"><span class="set-label">Input System</span><span style="color:#aaa; font-weight:bold;">FunkyFriday (Default)</span></div>`;
    } 
    else if (tab === 'visuals') {
        html += renderToggle('Vivid Lights', 'vivid');
        html += renderToggle('Screen Shake', 'shake');
        html += renderToggle('Mostrar Juez', 'judgeVis');
        html += renderToggle('Mostrar Mean MS', 'showMean');
        html += renderToggle('Mostrar FC Status', 'showFC');
        html += renderRange('Opacidad Carril (%)', 'trackOp', 0, 100);
        html += renderRange('Posición Juez Y', 'judgeY', 0, 100);
        html += `<div style="margin-top:20px;"><button class="action secondary" onclick="document.getElementById('bg-file').click()">🖼️ CAMBIAR FONDO</button></div>`;
        html += `<input type="file" id="bg-file" accept="image/*" style="display:none" onchange="handleBg(this)">`;
    } 
    else if (tab === 'audio') {
        html += renderRange('Volumen Música', 'vol', 0, 100);
        html += renderRange('Volumen Hits', 'hvol', 0, 100);
        html += `<div style="margin-top:20px;"><button class="action secondary" onclick="document.getElementById('hit-file').click()">🔊 CUSTOM HIT SOUND</button></div>`;
        html += `<input type="file" id="hit-file" accept="audio/*" style="display:none" onchange="loadHitSound(this)">`;
    }
    else if (tab === 'controls') {
        html += `<div class="kb-tabs">
            <div class="kb-tab active" id="tab-4" onclick="renderLaneConfig(4)">4K</div>
            <div class="kb-tab" id="tab-6" onclick="renderLaneConfig(6)">6K</div>
            <div class="kb-tab" id="tab-7" onclick="renderLaneConfig(7)">7K</div>
            <div class="kb-tab" id="tab-9" onclick="renderLaneConfig(9)">9K</div>
        </div>
        <div class="lane-cfg-box"><div id="lanes-container" class="lanes-view"></div></div>`;
        setTimeout(() => renderLaneConfig(4), 50); // Renderizar después de inyectar
    }

    content.innerHTML = html;
}

// Helpers para generar HTML de ajustes
function renderToggle(label, key) {
    const val = cfg[key];
    return `
    <div class="set-row">
        <span class="set-label">${label}</span>
        <button class="toggle-switch ${val ? 'on' : 'off'}" onclick="toggleCfg('${key}', this)">${val ? 'ON' : 'OFF'}</button>
    </div>`;
}

function renderRange(label, key, min, max) {
    let val = cfg[key];
    if (key === 'vol' || key === 'hvol') val = Math.round(val * 100);
    return `
    <div class="set-row">
        <span class="set-label">${label}</span>
        <div style="display:flex; gap:10px; align-items:center;">
            <input type="range" min="${min}" max="${max}" value="${val}" oninput="updateCfgVal('${key}', this.value)">
            <div id="disp-${key}" class="num-input">${val}</div>
        </div>
    </div>`;
}

function toggleCfg(key, btn) {
    cfg[key] = !cfg[key];
    btn.className = `toggle-switch ${cfg[key] ? 'on' : 'off'}`;
    btn.innerText = cfg[key] ? 'ON' : 'OFF';
}

function updateCfgVal(key, val) {
    document.getElementById('disp-'+key).innerText = val;
    // Guardar temporalmente para guardar al salir
    if (key === 'vol' || key === 'hvol') cfg[key] = val / 100;
    else cfg[key] = parseInt(val);
}

// Sobrescribimos openModal para usar el nuevo menu
const originalOpenModal = window.openModal || function(){};
function openModal(id) {
    if (id === 'settings') {
        openSettingsMenu();
    } else {
        document.getElementById('modal-'+id).style.display='flex';
        // Lógica original preservada para otros modales
        if(id==='profile'){ 
            document.getElementById('login-view').style.display=user.name==='Guest'?'block':'none'; 
            document.getElementById('profile-view').style.display=user.name==='Guest'?'none':'block'; 
            switchProfileTab('resumen'); 
        }
        if(id==='upload') { document.getElementById('upload-status').innerText = ""; } 
        if(id==='diff' && curSongData) { document.getElementById('diff-song-title').innerText = curSongData.title; const cover = document.getElementById('diff-song-cover'); if(curSongData.imageURL) cover.style.backgroundImage = `url(${curSongData.imageURL})`; else cover.style.backgroundImage = ''; }
    }
}

function saveSettings() {
    applyCfg();
    if(typeof save === 'function') { save(); notify("Ajustes guardados"); }
    document.getElementById('modal-settings').style.display='none';
    updUI(); // Refrescar UI inmediatamente
}

// === TIENDA E INVENTARIO ===
function openShop() {
    const grid = document.getElementById('shop-items');
    if(!grid) return;
    
    document.getElementById('shop-sp').innerText = (user.sp || 0).toLocaleString();
    grid.innerHTML = '';

    SHOP_ITEMS.forEach(item => {
        const owned = user.inventory && user.inventory.includes(item.id);
        const isEquipped = user.equipped && user.equipped[item.type] === item.id;

        const div = document.createElement('div');
        div.className = 'shop-item';
        if (owned) div.style.borderColor = "var(--blue)"; 

        div.innerHTML = `
            <div class="shop-icon" style="background-color:${item.color || '#333'}"></div>
            <div class="shop-name">${item.name}</div>
            <div style="font-size:0.8rem; color:#aaa; margin-bottom:10px;">${item.desc}</div>
            <div class="shop-price">${owned ? 'ADQUIRIDO' : item.price + ' SP'}</div>
            
            ${!owned 
                ? `<button class="btn-small btn-add" onclick="buyItem('${item.id}', ${item.price})">COMPRAR</button>`
                : `<button class="btn-small ${isEquipped ? 'btn-acc' : 'btn-chat'}" onclick="equipItem('${item.id}', '${item.type}')">
                    ${isEquipped ? 'EQUIPADO' : 'EQUIPAR'}
                   </button>`
            }
        `;
        grid.appendChild(div);
    });
    openModal('shop');
}

function buyItem(id, price) {
    if ((user.sp || 0) < price) {
        return notify("No tienes suficientes SP", "error");
    }
    user.sp -= price;
    if (!user.inventory) user.inventory = [];
    user.inventory.push(id);
    save(); 
    notify("¡Ítem comprado!", "success");
    openShop(); 
    updUI(); 
}

function equipItem(id, type) {
    if (!user.equipped) user.equipped = {};
    if (user.equipped[type] === id) {
        user.equipped[type] = 'default';
        notify("Ítem desequipado");
    } else {
        user.equipped[type] = id;
        notify("¡Equipado!");
    }
    save();
    openShop();
}

function openFriends() {
    if(user.name === "Guest") return notify("Debes iniciar sesión", "error");
    if(!db) return notify("Error de conexión", "error");
    
    const friL = document.getElementById('friend-list');
    db.collection("users").doc(user.name).onSnapshot(doc => {
        const data = doc.data();
        if(data && data.friends && data.friends.length > 0) {
            friL.innerHTML = '';
            data.friends.forEach(f => {
                db.collection("users").doc(f).get().then(fDoc => {
                    if(!fDoc.exists) return;
                    const fData = fDoc.data();
                    
                    const d = document.createElement('div'); d.className = 'friend-row';
                    d.onclick = function() { showFriendProfile(f, fData, true); };
                    
                    let avStyle = fData.avatarData ? `background-image:url(${fData.avatarData})` : '';
                    d.innerHTML = `<div style="display:flex;align-items:center; pointer-events:none;"><div class="f-row-av" style="${avStyle}"></div><span class="friend-row-name">${f}</span></div>`;
                    friL.appendChild(d);
                });
            });
        } else { friL.innerHTML = '<div style="color:#666; padding:20px;">No tienes amigos aún.</div>'; }
    });
    openModal('friends');
}

function showFriendProfile(fName, fData, isOnline) {
    selectedFriend = fName;
    document.getElementById('fp-name').innerText = fName;
    document.getElementById('fp-lvl').innerText = "LVL " + fData.lvl;
    document.getElementById('fp-score').innerText = fData.score.toLocaleString();
    document.getElementById('fp-pp').innerText = fData.pp;
    document.getElementById('fp-plays').innerText = fData.plays || 0;
    document.getElementById('fp-rank').innerText = "#?"; 

    if(fData.avatarData) document.getElementById('fp-av').style.backgroundImage = `url(${fData.avatarData})`;
    else document.getElementById('fp-av').style.backgroundImage = '';

    const statusTxt = document.getElementById('fp-status-text');
    const chalBtn = document.getElementById('btn-challenge');
    
    statusTxt.innerText = "Jugador"; 
    chalBtn.disabled = false;
    
    chalBtn.onclick = () => { challengeFriend(fName); closeModal('friend-profile'); };
    closeModal('friends');
    openModal('friend-profile');
}

/* CHATS */
let activeChats = [];
function openFloatingChat(friendName) {
    const target = friendName || selectedFriend;
    if(!target) return;
    if(activeChats.includes(target)) return; 
    if(activeChats.length >= 3) { closeFloatingChat(activeChats[0]); }
    closeModal('friend-profile');
    activeChats.push(target);
    const container = document.getElementById('chat-overlay-container');
    const div = document.createElement('div');
    div.className = 'chat-window';
    div.id = 'chat-w-' + target;
    div.innerHTML = `<div class="cw-header" onclick="toggleMinChat('${target}')"><span>${target}</span><span style="font-size:0.8rem; color:#888;" onclick="event.stopPropagation(); closeFloatingChat('${target}')">✕</span></div><div class="cw-body" id="cw-body-${target}"></div><div class="cw-input-area"><input type="text" class="cw-input" placeholder="Mensaje..." onkeydown="if(event.key==='Enter') sendFloatChat('${target}', this)"></div>`;
    container.appendChild(div);
    initFloatChatListener(target);
}
function closeFloatingChat(target) { const el = document.getElementById('chat-w-' + target); if(el) el.remove(); activeChats = activeChats.filter(c => c !== target); }
function toggleMinChat(target) { const el = document.getElementById('chat-w-' + target); if(el) el.classList.toggle('minimized'); }
function sendFloatChat(target, inp) { const txt = inp.value.trim(); if(!txt) return; const room = [user.name, target].sort().join("_"); db.collection("chats").doc(room).collection("messages").add({ user: user.name, text: txt, timestamp: firebase.firestore.FieldValue.serverTimestamp() }); inp.value = ""; }
function initFloatChatListener(target) {
    const room = [user.name, target].sort().join("_");
    const body = document.getElementById(`cw-body-${target}`);
    db.collection("chats").doc(room).collection("messages").orderBy("timestamp", "desc").limit(20).onSnapshot(snapshot => {
        if(!document.getElementById(`cw-body-${target}`)) return; 
        body.innerHTML = '';
        const msgs = [];
        snapshot.forEach(doc => msgs.push(doc.data()));
        msgs.reverse().forEach(m => {
            const d = document.createElement('div'); d.className = 'cw-msg';
            d.innerHTML = `<b>${m.user}:</b> ${m.text}`;
            body.appendChild(d);
        });
        body.scrollTop = body.scrollHeight;
    });
}

/* NOTIFICATIONS */
function setupNotificationsListener() {
    if(user.name === "Guest" || !db) return;
    db.collection("users").doc(user.name).collection("notifications").where("read", "==", false)
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if(change.type === "added") {
                    const n = change.doc.data();
                    handleNotification(change.doc.id, n);
                }
            });
        });
}
function handleNotification(id, data) {
    db.collection("users").doc(user.name).collection("notifications").doc(id).update({read:true});
    let html = data.body;
    let duration = 8000;
    if(data.type === 'friend_req') {
        html += `<div class="notify-actions"><button class="notify-btn btn-accept" onclick="respondFriend('${data.from}', true, '${id}')">ACEPTAR</button><button class="notify-btn btn-deny" onclick="respondFriend('${data.from}', false, '${id}')">RECHAZAR</button></div>`;
        duration = 15000;
    } else if (data.type === 'challenge') {
        html += `<div class="notify-actions"><button class="notify-btn btn-accept" onclick="acceptChallenge('${data.from}', '${id}')">ACEPTAR</button><button class="notify-btn btn-deny" onclick="closeNotification('${id}')">RECHAZAR</button></div>`;
        duration = 10000;
    }
    notifyInteractive(id, data.title, html, duration);
}
function notifyInteractive(id, title, html, duration) {
    const area = document.getElementById('notification-area');
    const card = document.createElement('div'); card.className = 'notify-card'; card.id = 'notif-'+id;
    card.innerHTML = `<div class="notify-content"><div class="notify-title">${title}</div><div class="notify-body">${html}</div></div><div class="notify-progress" style="transition-duration:${duration}ms"></div>`;
    area.appendChild(card);
    setTimeout(() => { const prog = card.querySelector('.notify-progress'); if(prog) prog.style.width = '0%'; }, 50);
    setTimeout(() => closeNotification(id), duration);
}
function notify(msg, type="info", duration=3000) {
    const area = document.getElementById('notification-area');
    const id = Date.now();
    const card = document.createElement('div'); card.className = 'notify-card'; card.id = 'notif-'+id;
    if(type==="error") card.style.borderLeftColor = "#F9393F"; else if(type==="success") card.style.borderLeftColor = "#12FA05";
    card.innerHTML = `<div class="notify-content"><div class="notify-title">${type.toUpperCase()}</div><div class="notify-body">${msg}</div></div><div class="notify-progress" style="transition-duration:${duration}ms"></div>`;
    area.appendChild(card);
    setTimeout(() => { const prog = card.querySelector('.notify-progress'); if(prog) prog.style.width = '0%'; }, 50);
    setTimeout(() => closeNotification(id), duration);
}
function closeNotification(id) { const card = document.getElementById('notif-'+id); if(card) { card.classList.add('closing'); setTimeout(()=>card.remove(), 300); } }

/* GLOBAL MENU */
let globalSongsListener = null;
function renderMenu(filter="") {
    if(!db) return;
    const grid = document.getElementById('song-grid');
    if(globalSongsListener) globalSongsListener();
    globalSongsListener = db.collection("globalSongs").orderBy("createdAt", "desc").limit(50).onSnapshot(snapshot => {
        grid.innerHTML = '';
        if(snapshot.empty) { grid.innerHTML = '<div style="color:#666; grid-column:1/-1; text-align:center;">No hay canciones globales aún. ¡Sube una!</div>'; return; }
        snapshot.forEach(doc => {
            const s = doc.data();
            const songId = doc.id;
            if(filter && !s.title.toLowerCase().includes(filter.toLowerCase())) return;
            const c = document.createElement('div'); c.className = 'beatmap-card';
            const bgStyle = s.imageURL ? `background-image:url(${s.imageURL})` : `background-image:linear-gradient(135deg,hsl(${(songId.length*40)%360},60%,20%),black)`;
            let scoreTag = '';
            if(user.scores && user.scores[songId]) {
                const us = user.scores[songId];
                scoreTag = `<div style="margin-top:10px; display:flex; gap:5px; align-items:center;"><span class="tag rank-tag" style="color:${getRankColor(us.rank)}; background:rgba(0,0,0,0.5);">${us.rank}</span><span class="tag score-tag">${us.score.toLocaleString()}</span></div>`;
            }
            c.innerHTML = `<div class="bc-bg" style="${bgStyle}"></div><div class="bc-info"><div class="bc-title">${s.title}</div><div class="bc-meta" style="font-size:0.8rem; color:#aaa;">Subido por: ${s.uploader}</div>${scoreTag}<div class="bc-meta"><span class="tag keys">4K | 6K | 7K | 9K</span></div></div>`;
            c.onclick = () => { 
                curSongData = { id: songId, ...s }; 
                openModal('diff'); 
                const lobbyBtn = document.getElementById('create-lobby-opts');
                if(lobbyBtn) lobbyBtn.style.display = 'none'; 
            };
            grid.appendChild(c);
        });
    });
}
function getRankColor(r) { if(r==="SS") return "cyan"; if(r==="S") return "gold"; if(r==="A") return "lime"; if(r==="B") return "yellow"; if(r==="C") return "orange"; return "red"; }

/* UPLOADCARE */
function autoFillTitle(input) { if(input.files[0]) { let name = input.files[0].name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "); document.getElementById('up-title').value = name; document.getElementById('upload-status').innerText = ""; } }
function uploadFileToUC(file) { return new Promise((resolve, reject) => { const u = uploadcare.fileFrom('object', file); u.done(info => resolve(info.cdnUrl)).fail(err => reject(err)); }); }
async function startGlobalUpload() {
    if(!db) return notify("Error DB", "error");
    const titleInp = document.getElementById('up-title'); const audioInp = document.getElementById('up-audio'); const imageInp = document.getElementById('up-image'); const status = document.getElementById('upload-status'); const btn = document.getElementById('btn-upload-start');
    const title = titleInp.value.trim(); const audioFile = audioInp.files[0]; const imageFile = imageInp.files[0];
    if(!title || !audioFile) return notify("Audio y título requeridos", "error");
    if(audioFile.size > 20 * 1024 * 1024) return notify("Audio max 20MB", "error");
    btn.disabled = true; btn.innerText = "PROCESANDO..."; status.innerText = "Subiendo...";
    try {
        const audioURL = await uploadFileToUC(audioFile);
        let imageURL = null; if(imageFile) { status.innerText = "Subiendo imagen..."; imageURL = await uploadFileToUC(imageFile); }
        status.innerText = "Guardando...";
        const songId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        await db.collection("globalSongs").doc(songId).set({ title: title, uploader: user.name === "Guest" ? "Anónimo" : user.name, audioURL: audioURL, imageURL: imageURL, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        notify("¡Subida Éxito!", "success"); closeModal('upload'); titleInp.value = ""; audioInp.value = ""; imageInp.value = "";
    } catch(e) { console.error(e); notify("Error: " + e, "error"); status.innerText="Error"; } finally { btn.disabled = false; btn.innerText = "☁️ PUBLICAR AHORA"; status.innerText = ""; }
}

async function loadHitSound(i){ if(i.files[0]){ const buf = await i.files[0].arrayBuffer(); hitBuf = await st.ctx.decodeAudioData(buf); notify("Hit Sound Actualizado!"); i.value = ""; } }
function closeModal(id){ document.getElementById('modal-'+id).style.display='none'; }

function handleBg(i){ if(i.files[0]){ const r=new FileReader(); r.onload=e=>{user.bg=e.target.result;save();}; r.readAsDataURL(i.files[0]); i.value=""; }}
function uploadAvatar(i){ if(i.files[0]){ const r=new FileReader(); r.onload=e=>{user.avatar=e.target.result;user.avatarData=e.target.result;save(); updUI(); updateFirebaseScore();}; r.readAsDataURL(i.files[0]); i.value=""; }}
function renderLaneConfig(k){ document.querySelectorAll('.kb-tab').forEach(t=>t.classList.remove('active')); document.getElementById('tab-'+k).classList.add('active'); const c=document.getElementById('lanes-container'); c.innerHTML=''; for(let i=0; i<k; i++){ const l = cfg.modes[k][i]; const d=document.createElement('div'); d.className='l-col'; const shapePath = PATHS[l.s] || PATHS['circle']; d.innerHTML=`<div class="key-bind ${remapIdx===i && remapMode===k?'listening':''}" onclick="remapKey(${k},${i})">${l.k.toUpperCase()}</div><div class="shape-indicator" onclick="cycleShape(${k},${i})"><svg class="shape-svg-icon" viewBox="0 0 100 100"><path d="${shapePath}"/></svg></div><input type="color" class="col-pk" value="${l.c}" onchange="updateLaneColor(${k},${i},this.value)">`; c.appendChild(d); } }
function remapKey(k,i){ if(document.activeElement) document.activeElement.blur(); remapMode=k; remapIdx=i; renderLaneConfig(k); }
function updateLaneColor(k,i,v){ cfg.modes[k][i].c=v; }
function cycleShape(k,i){ const shapes=['circle','arrow','square','diamond']; const cur=shapes.indexOf(cfg.modes[k][i].s); cfg.modes[k][i].s = shapes[(cur+1)%4]; renderLaneConfig(k); }