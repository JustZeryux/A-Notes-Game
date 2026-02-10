/* === UI LOGIC & INTERACTION (FINAL FIX V6) === */

// Helpers DOM seguros
function setText(id, val) { const el = document.getElementById(id); if(el) el.innerText = val; }
function setStyle(id, prop, val) { const el = document.getElementById(id); if(el) el.style[prop] = val; }

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

    if(cfg.middleScroll === undefined) cfg.middleScroll = false;
    if(cfg.trackOp === undefined) cfg.trackOp = 10;
    if(cfg.noteOp === undefined) cfg.noteOp = 100;

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
    if(user.bg) { 
        const bg = document.getElementById('bg-image');
        if(bg) { bg.src = user.bg; bg.style.opacity = 0.3; }
    }

    applyCfg();

    // Actualizar HUD Extra (Combo & FC) en tiempo real
    if (typeof st !== 'undefined') {
        const fcEl = document.getElementById('hud-fc');
        const meanEl = document.getElementById('hud-mean');
        const comboEl = document.getElementById('g-combo');
        
        if (fcEl) {
            fcEl.innerText = (cfg.showFC && st.fcStatus) ? st.fcStatus : "";
            fcEl.style.color = (st.fcStatus==="PFC"?"cyan":(st.fcStatus==="GFC"?"gold":(st.fcStatus==="FC"?"lime":"red")));
        }
        if (meanEl) {
            meanEl.innerText = (cfg.showMean && st.hitCount > 0) ? (st.totalOffset / st.hitCount).toFixed(2) + "ms" : "";
        }
        if (comboEl) {
            if (st.cmb > 0) {
                comboEl.innerText = st.cmb;
                comboEl.style.opacity = '1';
                comboEl.classList.remove('pulse'); 
                void comboEl.offsetWidth; 
                comboEl.classList.add('pulse');
            } else {
                comboEl.style.opacity = '0';
            }
        }
    }

    const isGoogle = user.pass === "google-auth";
    const locSet = document.getElementById('local-acc-settings');
    const gooSet = document.getElementById('google-acc-settings');
    if(locSet) locSet.style.display = isGoogle ? 'none' : 'block';
    if(gooSet) gooSet.style.display = isGoogle ? 'block' : 'none';
}

function applyCfg() {
    document.documentElement.style.setProperty('--track-alpha', (cfg.trackOp || 10) / 100); 
    document.documentElement.style.setProperty('--note-op', (cfg.noteOp || 100) / 100);
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

// === RENDER MENU DE CANCIONES (CON FALLBACK DE COLOR) ===
let globalSongsListener = null;
function renderMenu(filter="") {
    if(!db) return;
    const grid = document.getElementById('song-grid');
    if(!grid) return;

    if(globalSongsListener) globalSongsListener(); 
    
    globalSongsListener = db.collection("globalSongs").orderBy("createdAt", "desc").limit(50).onSnapshot(snapshot => {
        grid.innerHTML = '';
        if(snapshot.empty) { grid.innerHTML = '<div style="color:#666;">No hay canciones. ¡Sube una!</div>'; return; }
        
        snapshot.forEach(doc => {
            const s = doc.data();
            const songId = doc.id;
            if(filter && !s.title.toLowerCase().includes(filter.toLowerCase())) return;
            
            const c = document.createElement('div'); 
            c.className = 'beatmap-card';
            
            // LOGICA FALLBACK COLOR: Si no hay imagen, generar gradiente basado en el ID
            let bgStyle;
            if(s.imageURL) {
                bgStyle = `background-image:url(${s.imageURL})`;
            } else {
                // Generar HSL basado en el ID del string para que siempre sea el mismo color
                let hash = 0;
                for (let i = 0; i < songId.length; i++) hash = songId.charCodeAt(i) + ((hash << 5) - hash);
                const hue = Math.abs(hash % 360);
                bgStyle = `background-image: linear-gradient(135deg, hsl(${hue}, 60%, 20%), #000)`;
            }
            
            let scoreTag = '';
            if(user.scores && user.scores[songId]) {
                const us = user.scores[songId];
                scoreTag = `<span class="tag rank-tag" style="color:gold">${us.rank}</span>`;
            }

            c.innerHTML = `
                <div class="bc-bg" style="${bgStyle}"></div>
                <div class="bc-info">
                    <div class="bc-title">${s.title}</div>
                    <div class="bc-meta" style="font-size:0.8rem;color:#aaa;">${s.uploader} ${scoreTag}</div>
                </div>`;
            c.onclick = () => { 
                curSongData = { id: songId, ...s }; 
                openModal('diff'); 
            };
            grid.appendChild(c);
        });
    });
}

// === MENÚ DE AJUSTES (ESTRUCTURA ROBLOX) ===
function openSettingsMenu() {
    const modal = document.getElementById('modal-settings');
    if(!modal) return;
    
    const panel = modal.querySelector('.modal-panel');
    panel.className = "modal-panel settings-panel"; // Asegurar clase ancha
    
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
                <button class="set-tab-btn" onclick="switchSetTab('controls')">⌨️ CONTROLS</button>
            </div>
            <div class="settings-content" id="set-content-area"></div>
        </div>
    `;
    
    modal.style.display = 'flex';
    switchSetTab('gameplay');
}

function switchSetTab(tab) {
    const content = document.getElementById('set-content-area');
    document.querySelectorAll('.set-tab-btn').forEach(b => b.classList.remove('active'));
    
    const btns = document.querySelectorAll('.set-tab-btn');
    const idx = ['gameplay', 'visuals', 'audio', 'controls'].indexOf(tab);
    if(idx !== -1 && btns[idx]) btns[idx].classList.add('active');

    let html = '';
    
    if (tab === 'gameplay') {
        html += renderToggle('Middlescroll (Centrado)', 'middleScroll');
        html += renderToggle('Downscroll (Caída abajo)', 'down');
        html += renderRange('Velocidad (Scroll Speed)', 'spd', 10, 40);
        html += renderRange('Dificultad IA', 'den', 1, 10);
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
        html += renderRange('Posición Juez Y', 'judgeY', 0, 100);
        html += renderRange('Posición Juez X', 'judgeX', 0, 100);
        html += renderRange('Tamaño Juez', 'judgeS', 5, 20);
        html += `<div style="margin-top:20px;"><button class="btn-small btn-add" onclick="document.getElementById('bg-file').click()">🖼️ CAMBIAR FONDO</button></div>`;
        html += `<input type="file" id="bg-file" accept="image/*" style="display:none" onchange="handleBg(this)">`;
    } 
    else if (tab === 'audio') {
        html += renderRange('Volumen Música', 'vol', 0, 100);
        html += renderToggle('Hit Sounds', 'hitSound');
        html += renderRange('Volumen Hits', 'hvol', 0, 100);
        html += renderToggle('Miss Sounds', 'missSound');
        html += renderRange('Volumen Miss', 'missVol', 0, 100);
        html += `<div style="margin-top:20px;"><button class="action secondary" onclick="document.getElementById('hit-file').click()">🔊 CUSTOM HIT SOUND</button></div>`;
        html += `<input type="file" id="hit-file" accept="audio/*" style="display:none" onchange="loadHitSound(this)">`;
        html += `<div style="margin-top:10px;"><button class="action secondary" onclick="document.getElementById('miss-file').click()">🔇 CUSTOM MISS SOUND</button></div>`;
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
        setTimeout(() => renderLaneConfig(4), 50);
    }

    content.innerHTML = html;
}

function renderToggle(label, key) {
    const val = cfg[key];
    return `<div class="set-row"><span class="set-label">${label}</span><button id="tog-${key}" class="toggle-switch ${val ? 'on' : 'off'}" onclick="toggleCfg('${key}')">${val ? 'ON' : 'OFF'}</button></div>`;
}

function renderRange(label, key, min, max) {
    let val = cfg[key];
    if (key.includes('vol')) val = Math.round((val||0.5) * 100);
    return `<div class="set-row"><span class="set-label">${label}</span><div style="display:flex;gap:10px;align-items:center;"><input type="range" min="${min}" max="${max}" value="${val}" oninput="updateCfgVal('${key}', this.value)"><div id="disp-${key}" class="num-input">${val}</div></div></div>`;
}

function toggleCfg(key) {
    cfg[key] = !cfg[key];
    const btn = document.getElementById('tog-' + key);
    if(btn) {
        btn.className = `toggle-switch ${cfg[key] ? 'on' : 'off'}`;
        btn.innerText = cfg[key] ? 'ON' : 'OFF';
    }
    applyCfg();
}

function updateCfgVal(key, val) {
    const disp = document.getElementById('disp-'+key);
    if(disp) disp.innerText = val;
    if (key.includes('vol')) cfg[key] = val / 100;
    else cfg[key] = parseInt(val);
    applyCfg();
}

// === HANDLER GLOBAL MODAL ===
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
            // FIX: Renderizar portada o color si no tiene
            if(curSongData.imageURL) {
                cover.style.backgroundImage = `url(${curSongData.imageURL})`;
            } else {
                let hash = 0;
                for (let i = 0; i < curSongData.id.length; i++) hash = curSongData.id.charCodeAt(i) + ((hash << 5) - hash);
                const hue = Math.abs(hash % 360);
                cover.style.backgroundImage = `linear-gradient(135deg, hsl(${hue}, 60%, 20%), #000)`;
            }
        }
    }
};

function closeModal(id){ document.getElementById('modal-'+id).style.display='none'; }

function saveSettings() {
    applyCfg();
    if(typeof save === 'function') { save(); notify("Ajustes guardados"); }
    const m = document.getElementById('modal-settings');
    if(m) m.style.display='none';
    updUI();
}

// === AMIGOS ===
function openFriends() {
    if(user.name === "Guest") return notify("Inicia sesión primero", "error");
    if(!db) return notify("Error de conexión", "error");
    
    const friL = document.getElementById('friend-list');
    if(!friL) return;
    
    db.collection("users").doc(user.name).onSnapshot(doc => {
        const data = doc.data();
        friL.innerHTML = '';
        if(data && data.friends && data.friends.length > 0) {
            data.friends.forEach(f => {
                db.collection("users").doc(f).get().then(fDoc => {
                    if(!fDoc.exists) return;
                    const fData = fDoc.data();
                    const d = document.createElement('div'); 
                    d.className = 'friend-row';
                    d.onclick = function() { showFriendProfile(f, fData); };
                    let avStyle = fData.avatarData ? `background-image:url(${fData.avatarData})` : '';
                    d.innerHTML = `<div style="display:flex;align-items:center;"><div class="f-row-av" style="${avStyle}"></div><span class="friend-row-name">${f}</span></div>`;
                    friL.appendChild(d);
                });
            });
        } else { friL.innerHTML = '<div style="padding:20px;color:#666;">Sin amigos aún.</div>'; }
    });
    openModal('friends');
}

function showFriendProfile(name, data) {
    selectedFriend = name;
    setText('fp-name', name);
    setText('fp-lvl', "LVL " + data.lvl);
    setText('fp-score', data.score.toLocaleString());
    const av = document.getElementById('fp-av');
    if(av) av.style.backgroundImage = data.avatarData ? `url(${data.avatarData})` : '';
    const btn = document.getElementById('btn-challenge');
    if(btn) {
        btn.disabled = false;
        btn.onclick = () => { challengeFriend(name); closeModal('friend-profile'); };
    }
    closeModal('friends');
    openModal('friend-profile');
}

// === UTILS ===
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
function updateLaneColor(k,i,v){ cfg.modes[k][i].c=v; }
function cycleShape(k,i){ const shapes=['circle','arrow','square','diamond']; const cur=shapes.indexOf(cfg.modes[k][i].s); cfg.modes[k][i].s = shapes[(cur+1)%4]; renderLaneConfig(k); }

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
