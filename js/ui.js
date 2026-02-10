/* === UI LOGIC & INTERACTION (REPARADO FINAL) === */

// Helper para evitar errores si el elemento no existe
function setText(id, txt) { const el = document.getElementById(id); if (el) el.innerText = txt; }
function setStyle(id, prop, val) { const el = document.getElementById(id); if (el) el.style[prop] = val; }

// Sonido de Hover
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

// Actualizar toda la interfaz
function updUI() {
    if(!user || !cfg) return;

    // Asegurar valores por defecto
    if(cfg.middleScroll === undefined) cfg.middleScroll = false;
    if(cfg.trackOp === undefined) cfg.trackOp = 10;

    // Perfil
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
    
    // XP
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

    // Aplicar Configuración Visual
    applyCfg();

    // Gestión Cuentas
    const isGoogle = user.pass === "google-auth";
    const lSet = document.getElementById('local-acc-settings');
    const gSet = document.getElementById('google-acc-settings');
    if(lSet) lSet.style.display = isGoogle ? 'none' : 'block';
    if(gSet) gSet.style.display = isGoogle ? 'block' : 'none';
}

function applyCfg() {
    document.documentElement.style.setProperty('--track-alpha', (cfg.trackOp || 10) / 100); 
    document.documentElement.style.setProperty('--judge-y', (cfg.judgeY || 40) + '%'); 
    document.documentElement.style.setProperty('--judge-x', (cfg.judgeX || 50) + '%'); 
    document.documentElement.style.setProperty('--judge-scale', (cfg.judgeS || 7)/10); 
    document.documentElement.style.setProperty('--judge-op', cfg.judgeVis ? 1 : 0);
    document.documentElement.style.setProperty('--note-op', (cfg.noteOp || 100) / 100);

    const track = document.getElementById('track');
    if (track) {
        if (cfg.middleScroll) track.classList.add('middle-scroll');
        else track.classList.remove('middle-scroll');
    }
}

// === MENÚ DE AJUSTES ROBLOX STYLE ===
function openSettingsMenu() {
    const modal = document.getElementById('modal-settings');
    const panel = modal.querySelector('.modal-panel');
    
    panel.innerHTML = `
        <div class="m-title" style="margin-bottom:20px;">CONFIGURACIÓN</div>
        <div class="settings-layout">
            <div class="settings-sidebar">
                <button class="set-tab-btn active" onclick="switchSetTab('gameplay')">🎮 GAMEPLAY</button>
                <button class="set-tab-btn" onclick="switchSetTab('visuals')">🎨 VISUALES</button>
                <button class="set-tab-btn" onclick="switchSetTab('audio')">🔊 AUDIO</button>
                <button class="set-tab-btn" onclick="switchSetTab('controls')">⌨️ CONTROLES</button>
            </div>
            <div class="settings-content" id="set-content-area"></div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
            <button class="action" style="width:auto; padding:10px 30px;" onclick="saveSettings()">GUARDAR</button>
            <button class="action secondary" style="width:auto; padding:10px 30px;" onclick="closeModal('settings')">CANCELAR</button>
        </div>
    `;
    
    modal.style.display = 'flex';
    switchSetTab('gameplay');
}

function switchSetTab(tab) {
    const content = document.getElementById('set-content-area');
    document.querySelectorAll('.set-tab-btn').forEach(b => b.classList.remove('active'));
    
    // Activar botón (simple index check)
    const btns = document.querySelectorAll('.set-tab-btn');
    if(tab==='gameplay') btns[0].classList.add('active');
    if(tab==='visuals') btns[1].classList.add('active');
    if(tab==='audio') btns[2].classList.add('active');
    if(tab==='controls') btns[3].classList.add('active');

    let html = '';
    
    if (tab === 'gameplay') {
        html += renderToggle('Middlescroll', 'middleScroll');
        html += renderToggle('Downscroll', 'down');
        html += renderRange('Velocidad', 'spd', 10, 40);
        html += renderRange('Dificultad IA', 'den', 1, 10);
        html += renderRange('Offset Global (ms)', 'off', -200, 200);
    } 
    else if (tab === 'visuals') {
        html += renderToggle('Vivid Lights', 'vivid');
        html += renderToggle('Screen Shake', 'shake');
        html += renderToggle('Mostrar Juez', 'judgeVis');
        html += renderToggle('Mostrar Mean MS', 'showMean');
        html += renderToggle('Mostrar FC Status', 'showFC');
        html += renderRange('Opacidad Carril (%)', 'trackOp', 0, 100);
        html += renderRange('Opacidad Notas (%)', 'noteOp', 10, 100);
        html += renderRange('Posición Juez Y', 'judgeY', 0, 100);
        html += `<div style="margin-top:20px;"><button class="action secondary" onclick="document.getElementById('bg-file').click()">🖼️ FONDO</button></div>`;
        html += `<input type="file" id="bg-file" accept="image/*" style="display:none" onchange="handleBg(this)">`;
    } 
    else if (tab === 'audio') {
        html += renderRange('Volumen Música', 'vol', 0, 100);
        html += renderToggle('Hit Sounds', 'hitSound');
        html += renderRange('Volumen Hits', 'hvol', 0, 100);
        html += renderToggle('Miss Sounds', 'missSound');
        html += renderRange('Volumen Miss', 'missVol', 0, 100);
        html += `<div style="margin-top:20px;"><button class="action secondary" onclick="document.getElementById('hit-file').click()">🔊 HIT SOUND</button></div>`;
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
    if (key.includes('vol')) val = Math.round(val * 100);
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
    document.getElementById('disp-'+key).innerText = val;
    if (key.includes('vol')) cfg[key] = val / 100;
    else cfg[key] = parseInt(val);
    applyCfg();
}

// === FUNCIONES GENERALES (FRIENDS, SONGS, ETC) ===

function openModal(id) {
    if (id === 'settings') {
        openSettingsMenu();
    } else {
        const m = document.getElementById('modal-'+id);
        if(m) m.style.display='flex';
        if(id==='diff' && curSongData) { 
            setText('diff-song-title', curSongData.title);
            const cover = document.getElementById('diff-song-cover');
            if(cover) cover.style.backgroundImage = curSongData.imageURL ? `url(${curSongData.imageURL})` : ''; 
        }
        if(id==='profile') switchProfileTab('resumen');
    }
}

function closeModal(id){ document.getElementById('modal-'+id).style.display='none'; }

function saveSettings() {
    if(typeof save === 'function') { save(); notify("Ajustes guardados"); }
    document.getElementById('modal-settings').style.display='none';
    updUI();
}

// SISTEMA DE AMIGOS (FIXED)
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
    
    // Activar botón de desafío
    const btn = document.getElementById('btn-challenge');
    if(btn) {
        btn.disabled = false;
        btn.onclick = () => { challengeFriend(name); closeModal('friend-profile'); };
    }
    
    closeModal('friends');
    openModal('friend-profile');
}

// SISTEMA DE CANCIONES (RENDER MENU)
let globalSongsListener = null;
function renderMenu(filter="") {
    if(!db) return;
    const grid = document.getElementById('song-grid');
    if(!grid) return;

    if(globalSongsListener) globalSongsListener(); // Limpiar listener anterior
    
    globalSongsListener = db.collection("globalSongs").orderBy("createdAt", "desc").limit(50).onSnapshot(snapshot => {
        grid.innerHTML = '';
        if(snapshot.empty) { grid.innerHTML = '<div style="color:#666;">No hay canciones. ¡Sube una!</div>'; return; }
        
        snapshot.forEach(doc => {
            const s = doc.data();
            const songId = doc.id;
            if(filter && !s.title.toLowerCase().includes(filter.toLowerCase())) return;
            
            const c = document.createElement('div'); 
            c.className = 'beatmap-card';
            const bgStyle = s.imageURL ? `background-image:url(${s.imageURL})` : `background-image:linear-gradient(135deg,#222,#000)`;
            
            // Score Tag
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

// TIENDA
function openShop() {
    const grid = document.getElementById('shop-items');
    setText('shop-sp', (user.sp||0).toLocaleString());
    if(grid) {
        grid.innerHTML = '';
        SHOP_ITEMS.forEach(item => {
            const owned = user.inventory && user.inventory.includes(item.id);
            const equipped = user.equipped && user.equipped[item.type] === item.id;
            const div = document.createElement('div');
            div.className = 'shop-item';
            if(owned) div.style.borderColor = "var(--blue)";
            div.innerHTML = `
                <div class="shop-icon" style="background-color:${item.color}"></div>
                <div class="shop-name">${item.name}</div>
                <div class="shop-price">${owned ? 'ADQUIRIDO' : item.price + ' SP'}</div>
                <button class="btn-small ${owned?'btn-chat':'btn-add'}" onclick="${owned ? `equipItem('${item.id}','${item.type}')` : `buyItem('${item.id}',${item.price})`}">${owned ? (equipped?'EQUIPADO':'EQUIPAR') : 'COMPRAR'}</button>
            `;
            grid.appendChild(div);
        });
    }
    openModal('shop');
}

function buyItem(id, price) {
    if((user.sp||0) < price) return notify("SP Insuficientes", "error");
    user.sp -= price;
    if(!user.inventory) user.inventory=[];
    user.inventory.push(id);
    save(); notify("Comprado!", "success"); openShop(); updUI();
}

function equipItem(id, type) {
    if(!user.equipped) user.equipped={};
    user.equipped[type] = (user.equipped[type] === id) ? 'default' : id;
    save(); openShop(); notify("Actualizado");
}

// CONFIG TECLAS
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

// HELPERS DE ARCHIVOS
function handleBg(i){ if(i.files[0]){ const r=new FileReader(); r.onload=e=>{user.bg=e.target.result;save();}; r.readAsDataURL(i.files[0]); i.value=""; }}
async function loadHitSound(i){ if(i.files[0]){ const buf = await i.files[0].arrayBuffer(); hitBuf = await st.ctx.decodeAudioData(buf); notify("Hit Sound cargado"); i.value = ""; } }
function changeSection(sec) { document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active')); const m={ 'songs': 'nav-songs', 'multi': 'nav-multi', 'shop': 'nav-shop', 'settings': 'nav-settings', 'rank': 'nav-rank', 'friends': 'nav-friends' }; const t=document.getElementById(m[sec]); if(t)t.classList.add('active'); }
function switchProfileTab(tab) { const r=document.getElementById('p-tab-content-resumen'); const c=document.getElementById('p-tab-content-cuenta'); if(r)r.style.display=tab==='resumen'?'block':'none'; if(c)c.style.display=tab==='cuenta'?'block':'none'; }
