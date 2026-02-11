/* === UI LOGIC & INTERACTION (MASTER V16) === */

function notify(msg, type="info", duration=4000) {
    const area = document.getElementById('notification-area');
    if(!area) return console.log(msg);
    const card = document.createElement('div');
    card.className = 'notify-card';
    if(type==="error") card.style.borderLeftColor = "#F9393F";
    else if(type==="success") card.style.borderLeftColor = "#12FA05";
    else card.style.borderLeftColor = "#44ccff";
    card.innerHTML = `<div class="notify-title">${type.toUpperCase()}</div><div class="notify-body">${msg}</div>`;
    area.appendChild(card);
    setTimeout(() => { card.style.animation = "slideOut 0.3s forwards"; setTimeout(() => card.remove(), 300); }, duration);
}

function playHover(){ 
    if(typeof st !== 'undefined' && st.ctx && typeof cfg !== 'undefined' && cfg.hvol > 0 && st.ctx.state==='running') { 
        try {
            const o=st.ctx.createOscillator(); const g=st.ctx.createGain(); 
            o.frequency.value=600; g.gain.value=0.05; 
            o.connect(g); g.connect(st.ctx.destination); 
            o.start(); o.stop(st.ctx.currentTime+0.05); 
        } catch(e){}
    } 
}

function setText(id, val) { const el = document.getElementById(id); if(el) el.innerText = val; }
function setStyle(id, prop, val) { const el = document.getElementById(id); if(el) el.style[prop] = val; }

function updUI() {
    if(!user || !cfg) return;
    if(cfg.middleScroll === undefined) cfg.middleScroll = false;
    if(cfg.trackOp === undefined) cfg.trackOp = 10;
    if(cfg.noteOp === undefined) cfg.noteOp = 100;
    if(cfg.noteScale === undefined) cfg.noteScale = 1;

    setText('m-name', user.name); setText('p-name', user.name); setText('ig-name', user.name);
    setText('h-pp', user.pp); setText('h-sp', (user.sp || 0).toLocaleString());
    setText('p-score', user.score.toLocaleString()); setText('p-plays', user.plays);
    setText('p-pp-display', user.pp); setText('p-sp-display', (user.sp || 0).toLocaleString());
    setText('m-rank', "LVL " + user.lvl); setText('p-lvl-txt', "LVL " + user.lvl);
    
    let xpReq = 1000 * Math.pow(1.05, user.lvl - 1);
    if(user.lvl >= 10) xpReq = 1000 * Math.pow(1.02, user.lvl - 1);
    xpReq = Math.floor(xpReq);
    const pct = Math.min(100, (user.xp / xpReq) * 100);
    setStyle('p-xp-bar', 'width', pct + "%");
    setText('p-xp-txt', `${Math.floor(user.xp)} / ${xpReq} XP`);
    
    if(user.avatarData) { 
        const url = `url(${user.avatarData})`;
        setStyle('m-av', 'backgroundImage', url); setText('m-av', ""); 
        setStyle('p-av-big', 'backgroundImage', url); setStyle('ig-av', 'backgroundImage', url);
    }
    if(user.bg) { const bg = document.getElementById('bg-image'); if(bg) { bg.src = user.bg; bg.style.opacity = 0.3; } }

    const rankEl = document.getElementById('p-global-rank');
    if(rankEl && rankEl.innerText === "#--") updateGlobalRank();

    applyCfg();

    if (typeof st !== 'undefined') {
        const fcEl = document.getElementById('hud-fc');
        const meanEl = document.getElementById('hud-mean');
        const comboEl = document.getElementById('g-combo');
        if (fcEl) {
            fcEl.innerText = (cfg.showFC && st.fcStatus) ? st.fcStatus : "";
            if(st.fcStatus==="PFC") fcEl.style.color = "cyan";
            else if(st.fcStatus==="GFC") fcEl.style.color = "gold";
            else if(st.fcStatus==="FC") fcEl.style.color = "#12FA05";
            else fcEl.style.color = "#F9393F";
        }
        if (meanEl) meanEl.innerText = (cfg.showMean && st.hitCount > 0) ? (st.totalOffset / st.hitCount).toFixed(2) + "ms" : "";
        if (comboEl) {
            if (st.cmb > 0) {
                comboEl.innerText = st.cmb;
                comboEl.style.opacity = '1';
                comboEl.classList.remove('pulse'); void comboEl.offsetWidth; comboEl.classList.add('pulse');
            } else comboEl.style.opacity = '0';
        }
    }

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
        snap.docs.forEach((doc, index) => { if(doc.id === user.name) rank = "#" + (index + 1); });
        setText('p-global-rank', rank);
    }).catch(()=>{});
}

function applyCfg() {
    document.documentElement.style.setProperty('--track-alpha', (cfg.trackOp || 10) / 100); 
    document.documentElement.style.setProperty('--note-op', (cfg.noteOp || 100) / 100);
    document.documentElement.style.setProperty('--note-scale', cfg.noteScale || 1);
    document.documentElement.style.setProperty('--judge-y', (cfg.judgeY || 40) + '%'); 
    document.documentElement.style.setProperty('--judge-x', (cfg.judgeX || 50) + '%'); 
    document.documentElement.style.setProperty('--judge-scale', (cfg.judgeS || 7)/10); 
    document.documentElement.style.setProperty('--judge-op', cfg.judgeVis ? 1 : 0);
    const track = document.getElementById('track');
    if (track) { if (cfg.middleScroll) track.classList.add('middle-scroll'); else track.classList.remove('middle-scroll'); }
}

function openSettingsMenu() {
    const modal = document.getElementById('modal-settings');
    const panel = modal.querySelector('.modal-panel');
    panel.className = "modal-panel settings-panel";
    panel.innerHTML = `
        <div class="settings-header">
            <div class="m-title" style="margin:0; font-size:1.8rem; border:none;">CONFIGURACIÓN</div>
            <div style="display:flex; gap:10px;">
                <button class="action" style="width:auto; padding:10px 20px;" onclick="saveSettings()">GUARDAR</button>
                <button class="action secondary" style="width:auto; padding:10px 20px;" onclick="closeModal('settings')">X</button>
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
            <div class="settings-preview"><div class="preview-title">VISTA PREVIA</div><div class="preview-box" id="preview-box"></div></div>
        </div>`;
    modal.style.display = 'flex';
    switchSetTab('gameplay');
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
    const btns = document.querySelectorAll('.set-tab-btn');
    const idx = ['gameplay', 'visuals', 'audio', 'controls'].indexOf(tab);
    if(idx !== -1 && btns[idx]) btns[idx].classList.add('active');

    let html = '';
    if (tab === 'gameplay') {
        html += renderToggle('Middlescroll', 'middleScroll') + renderToggle('Downscroll', 'down') + renderRange('Velocidad', 'spd', 10, 40) + renderRange('Dificultad IA', 'den', 1, 10) + renderRange('Offset (ms)', 'off', -200, 200);
    } else if (tab === 'visuals') {
        html += renderToggle('Vivid Lights', 'vivid') + renderToggle('Screen Shake', 'shake') + renderToggle('Mostrar Juez', 'judgeVis') + renderToggle('Mostrar FC', 'showFC') + renderRange('Opacidad Carril', 'trackOp', 0, 100) + renderRange('Opacidad Notas', 'noteOp', 10, 100) + renderRange('Tamaño Nota', 'noteScale', 0.5, 1.5, 0.1);
        html += `<div style="margin-top:20px;"><button class="btn-small btn-add" style="width:100%" onclick="document.getElementById('bg-file').click()">🖼️ FONDO</button><input type="file" id="bg-file" accept="image/*" style="display:none" onchange="handleBg(this)"></div>`;
    } else if (tab === 'audio') {
        html += renderRange('Volumen Música', 'vol', 0, 100) + renderRange('Volumen Hits', 'hvol', 0, 100);
    } else if (tab === 'controls') {
        html += `<div class="kb-tabs"><div class="kb-tab active" onclick="renderLaneConfig(4)">4K</div><div class="kb-tab" onclick="renderLaneConfig(6)">6K</div></div><div class="lane-cfg-box"><div id="lanes-container" class="lanes-view"></div></div>`;
        setTimeout(() => renderLaneConfig(4), 50);
    }
    content.innerHTML = html;
    updatePreview();
}

function updatePreview() {
    const box = document.getElementById('preview-box');
    if (!box) return;
    const sampleLane = cfg.modes[4][0];
    const shapePath = (typeof PATHS !== 'undefined') ? (PATHS[sampleLane.s] || PATHS['circle']) : "";
    const scale = cfg.noteScale || 1;
    const opacity = (cfg.noteOp || 100) / 100;
    box.innerHTML = `<div class="preview-note" style="transform: scale(${scale}); opacity: ${opacity};"><svg viewBox="0 0 100 100" style="width:100%; height:100%; filter: drop-shadow(0 0 10px ${sampleLane.c});"><path d="${shapePath}" fill="${sampleLane.c}" stroke="white" stroke-width="5" /></svg></div>`;
}

function renderToggle(lbl, k) { return `<div class="set-row"><span class="set-label">${lbl}</span><button class="toggle-switch ${cfg[k]?'on':'off'}" onclick="cfg['${k}']=!cfg['${k}']; toggleCfg('${k}')">${cfg[k]?'ON':'OFF'}</button></div>`; }
function renderRange(lbl, k, min, max, step=1) { let v=cfg[k]; if(k.includes('vol')) v=Math.round((v||0.5)*100); return `<div class="set-row"><span class="set-label">${lbl}</span><div style="display:flex;gap:10px;"><input type="range" min="${min}" max="${max}" step="${step}" value="${v}" oninput="updateCfgVal('${k}', this.value)"><div id="disp-${k}" class="num-input">${v}</div></div></div>`; }
function toggleCfg(key) { applyCfg(); updatePreview(); }
function updateCfgVal(key, val) { 
    const d = document.getElementById('disp-'+key); if(d) d.innerText = val;
    if (key.includes('vol')) cfg[key] = val / 100;
    else if (key === 'noteScale') cfg[key] = parseFloat(val);
    else cfg[key] = parseInt(val);
    applyCfg(); updatePreview();
}

function openFriends() {
    if(user.name === "Guest") return notify("Inicia sesión primero", "error");
    if(!db) return notify("Error de conexión", "error");
    
    const reqList = document.getElementById('req-list');
    const friList = document.getElementById('friend-list');
    
    db.collection("users").doc(user.name).onSnapshot(doc => {
        if(!doc.exists) return;
        const data = doc.data();
        
        if(reqList) {
            reqList.innerHTML = '';
            if(data.requests && data.requests.length > 0) {
                data.requests.forEach(reqName => {
                    const row = document.createElement('div');
                    row.className = 'friend-row';
                    row.innerHTML = `<span class="friend-row-name">${reqName}</span><div style="display:flex; gap:5px;"><button class="btn-small btn-acc" onclick="window.respondFriend('${reqName}', true)">✔</button><button class="btn-small" style="background:#F9393F" onclick="window.respondFriend('${reqName}', false)">✕</button></div>`;
                    reqList.appendChild(row);
                });
            } else reqList.innerHTML = '<div style="color:#666; font-size:0.8rem; padding:10px;">Sin solicitudes.</div>';
        }

        if(friList) {
            friList.innerHTML = '';
            if(data.friends && data.friends.length > 0) {
                data.friends.forEach(fName => {
                    const row = document.createElement('div');
                    row.className = 'friend-row';
                    row.onclick = () => showFriendProfile(fName);
                    row.innerHTML = `<div style="display:flex;align-items:center;"><div class="f-row-av" id="fav-${fName}"></div><span class="friend-row-name">${fName}</span></div>`;
                    friList.appendChild(row);
                    db.collection("users").doc(fName).get().then(fDoc => {
                        if(fDoc.exists && fDoc.data().avatarData) {
                            const av = document.getElementById(`fav-${fName}`);
                            if(av) av.style.backgroundImage = `url(${fDoc.data().avatarData})`;
                        }
                    });
                });
            } else friList.innerHTML = '<div style="padding:20px;color:#666;">Sin amigos aún.</div>';
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

window.updateHostPanelUI = function(players) {
    const list = document.getElementById('hp-players-list');
    const count = document.getElementById('hp-count');
    const btnStart = document.getElementById('btn-start-match');
    if(!list || !count) return;
    count.innerText = players.length;
    list.innerHTML = '';
    players.forEach(p => {
        const isHost = (p.name === players[0].name);
        list.innerHTML += `<div class="hp-player-row ${isHost ? 'is-host' : ''}"><div class="hp-p-av" style="background-image:url(${p.avatar||''})"></div><div class="hp-p-name">${p.name} ${isHost ? '<span style="color:gold">★</span>' : ''}</div><div class="hp-p-status" style="color:lime">LISTO</div></div>`;
    });
    if(btnStart) {
        if(players.length > 0 && players[0].name === user.name) btnStart.style.display = 'block';
        else btnStart.style.display = 'none';
    }
};

window.openHostPanel = function(songData) {
    if(!songData) return;
    curSongData = songData; 
    const modal = document.getElementById('modal-host');
    const panel = modal.querySelector('.modal-panel');
    panel.className = "modal-panel host-panel-compact";
    let bgStyle = songData.imageURL ? `background-image:url(${songData.imageURL})` : 'background: linear-gradient(to right, #222, #111)';
    panel.innerHTML = `<div class="hp-header" style="${bgStyle}"><div class="hp-title-info"><div class="hp-song-title">${songData.title}</div><div class="hp-meta">By ${songData.uploader}</div></div></div><div class="hp-body"><div class="hp-config-col"><div><div class="hp-section-title">Modos</div><div class="hp-checkbox-group"><label class="hp-chk-label"><input type="checkbox" id="chk-4k" checked disabled> <span>4K</span></label></div></div></div><div class="hp-players-col"><div class="hp-section-title">Jugadores (<span id="hp-count">1</span>/8)</div><div id="hp-players-list"></div></div></div><div class="hp-footer"><button class="action secondary" style="width:auto;" onclick="closeModal('host'); leaveLobby();">SALIR</button><button id="btn-start-match" class="action btn-add" style="width:auto; display:none;" onclick="startLobbyMatch()">COMENZAR</button></div>`;
    modal.style.display = 'flex';
};

window.openModal = function(id) { if (id === 'settings') openSettingsMenu(); else { const m = document.getElementById('modal-'+id); if(m) m.style.display='flex'; if(id==='profile') switchProfileTab('resumen'); if(id==='diff' && curSongData) setText('diff-song-title', curSongData.title); } };
function closeModal(id){ document.getElementById('modal-'+id).style.display='none'; }
function handleBg(i){ if(i.files[0]){ const r=new FileReader(); r.onload=e=>{user.bg=e.target.result;save();}; r.readAsDataURL(i.files[0]); i.value=""; }}
function renderLaneConfig(k){ const c=document.getElementById('lanes-container'); if(!c) return; c.innerHTML=''; for(let i=0; i<k; i++){ const l = cfg.modes[k][i]; const d=document.createElement('div'); d.className='l-col'; const shapePath = (typeof PATHS !== 'undefined') ? (PATHS[l.s] || PATHS['circle']) : ""; d.innerHTML=`<div class="key-bind ${remapIdx===i && remapMode===k?'listening':''}" onclick="remapKey(${k},${i})">${l.k.toUpperCase()}</div><div class="shape-indicator" onclick="cycleShape(${k},${i})"><svg class="shape-svg-icon" viewBox="0 0 100 100"><path d="${shapePath}"/></svg></div><input type="color" class="col-pk" value="${l.c}" onchange="updateLaneColor(${k},${i},this.value)">`; c.appendChild(d); } }
function remapKey(k,i){ if(document.activeElement) document.activeElement.blur(); remapMode=k; remapIdx=i; renderLaneConfig(k); }
function updateLaneColor(k,i,v){ cfg.modes[k][i].c=v; updatePreview(); }
function cycleShape(k,i){ const shapes=['circle','arrow','square','diamond']; const cur=shapes.indexOf(cfg.modes[k][i].s); cfg.modes[k][i].s = shapes[(cur+1)%4]; renderLaneConfig(k); updatePreview(); }
function openShop() { setText('shop-sp', (user.sp || 0).toLocaleString()); const m = document.getElementById('modal-shop'); if(m) m.style.display='flex'; }
function buyItem(id, price) { if ((user.sp || 0) < price) return notify("SP Insuficientes", "error"); user.sp -= price; if (!user.inventory) user.inventory = []; user.inventory.push(id); save(); notify("¡Comprado!", "success"); openShop(); updUI(); }
function equipItem(id, type) { if (!user.equipped) user.equipped = {}; if (user.equipped[type] === id) { user.equipped[type] = 'default'; notify("Desequipado"); } else { user.equipped[type] = id; notify("Equipado"); } save(); openShop(); }
function changeSection(sec) { document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active')); const map = { 'songs': 'nav-songs', 'multi': 'nav-multi', 'shop': 'nav-shop', 'settings': 'nav-settings', 'rank': 'nav-rank', 'friends': 'nav-friends' }; document.getElementById(map[sec]).classList.add('active'); }
function switchProfileTab(tab) { const r=document.getElementById('p-tab-content-resumen'); const c=document.getElementById('p-tab-content-cuenta'); if(r)r.style.display=tab==='resumen'?'block':'none'; if(c)c.style.display=tab==='cuenta'?'block':'none'; }
async function loadHitSound(i){ if(i.files[0]){ const buf = await i.files[0].arrayBuffer(); hitBuf = await st.ctx.decodeAudioData(buf); notify("Hit Sound cargado"); i.value = ""; } }
async function loadMissSound(i){ if(i.files[0]){ const buf = await i.files[0].arrayBuffer(); missBuf = await st.ctx.decodeAudioData(buf); notify("Miss Sound cargado"); i.value = ""; } }
