/* === UI LOGIC & INTERACTION (ULTRA STABLE V3) === */

// Helper para evitar el error "Cannot set property of null"
function setText(id, txt) { const el = document.getElementById(id); if (el) el.innerText = txt; }
function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function setCheck(id, val) { const el = document.getElementById(id); if (el) el.checked = val; }
function setStyle(id, prop, val) { const el = document.getElementById(id); if (el) el.style[prop] = val; }

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

function updUI() {
    if(!user || !cfg) return;

    // === PERFIL & HUD (Con seguridad anti-crash) ===
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
    
    // XP Bar Calculation
    let xpReq = 1000 * Math.pow(1.05, user.lvl - 1);
    if(user.lvl >= 10) xpReq = 1000 * Math.pow(1.02, user.lvl - 1);
    xpReq = Math.floor(xpReq);
    const pct = Math.min(100, (user.xp / xpReq) * 100);
    
    setStyle('p-xp-bar', 'width', pct + "%");
    setText('p-xp-txt', `${Math.floor(user.xp)} / ${xpReq} XP`);
    setText('p-global-rank', "#--"); 
    
    // Avatar & BG
    if(user.avatarData) { 
        const url = `url(${user.avatarData})`;
        setStyle('m-av', 'backgroundImage', url);
        setText('m-av', ""); 
        setStyle('p-av-big', 'backgroundImage', url);
        setStyle('ig-av', 'backgroundImage', url);
    }
    
    if(user.bg) { 
        const bgEl = document.getElementById('bg-image');
        if(bgEl) { bgEl.src = user.bg; bgEl.style.opacity = 0.3; }
    }

    // === VARIABLES CSS EN TIEMPO REAL ===
    // Esto maneja la opacidad, posición del juez, etc.
    document.documentElement.style.setProperty('--track-alpha', (cfg.trackOp !== undefined ? cfg.trackOp : 10) / 100); 
    document.documentElement.style.setProperty('--judge-y', (cfg.judgeY || 40) + '%'); 
    document.documentElement.style.setProperty('--judge-x', (cfg.judgeX || 50) + '%'); 
    document.documentElement.style.setProperty('--judge-scale', (cfg.judgeS || 7)/10); 
    document.documentElement.style.setProperty('--judge-op', cfg.judgeVis ? 1 : 0);

    // Middlescroll Class Toggle
    const track = document.getElementById('track');
    if (track) {
        if (cfg.middleScroll) track.classList.add('middle-scroll');
        else track.classList.remove('middle-scroll');
    }

    // === GESTIÓN DE CUENTAS ===
    const isGoogle = user.pass === "google-auth";
    const locSet = document.getElementById('local-acc-settings');
    const gooSet = document.getElementById('google-acc-settings');
    if(locSet) locSet.style.display = isGoogle ? 'none' : 'block';
    if(gooSet) gooSet.style.display = isGoogle ? 'block' : 'none';
}

/* === SISTEMA DE MENÚ DE AJUSTES (ESTILO ROBLOX/MODERNO) === */
// Genera el HTML dinámicamente para no depender de que el usuario actualice index.html
function openSettingsMenu() {
    const modal = document.getElementById('modal-settings');
    if(!modal) return;
    
    const panel = modal.querySelector('.modal-panel');
    
    // Estructura del menú lateral
    panel.innerHTML = `
        <div class="m-title" style="margin-bottom:20px; font-size:2rem;">CONFIGURACIÓN</div>
        <div class="settings-layout">
            <div class="settings-sidebar">
                <button class="set-tab-btn active" onclick="switchSetTab('gameplay')">🎮 GAMEPLAY</button>
                <button class="set-tab-btn" onclick="switchSetTab('visuals')">🎨 VISUALES</button>
                <button class="set-tab-btn" onclick="switchSetTab('audio')">🔊 AUDIO</button>
                <button class="set-tab-btn" onclick="switchSetTab('controls')">⌨️ CONTROLES</button>
            </div>
            <div class="settings-content" id="set-content-area"></div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:15px;">
            <button class="action" style="width:auto; padding:10px 30px; font-size:1rem;" onclick="saveSettings()">GUARDAR</button>
            <button class="action secondary" style="width:auto; padding:10px 30px; font-size:1rem;" onclick="closeModal('settings')">CANCELAR</button>
        </div>
    `;
    
    modal.style.display = 'flex';
    switchSetTab('gameplay'); // Cargar primera pestaña por defecto
}

function switchSetTab(tab) {
    const content = document.getElementById('set-content-area');
    document.querySelectorAll('.set-tab-btn').forEach(b => b.classList.remove('active'));
    
    // Activar botón visualmente
    const btns = document.querySelectorAll('.set-tab-btn');
    const idx = ['gameplay', 'visuals', 'audio', 'controls'].indexOf(tab);
    if(idx !== -1 && btns[idx]) btns[idx].classList.add('active');

    let html = '';
    
    // Generador de Contenido según Pestaña
    if (tab === 'gameplay') {
        html += renderToggle('Middlescroll (Centrado)', 'middleScroll');
        html += renderToggle('Downscroll (Caída abajo)', 'down');
        html += renderRange('Velocidad (Scroll Speed)', 'spd', 10, 40);
        html += renderRange('Dificultad IA', 'den', 1, 10);
        html += renderRange('Offset Global (ms)', 'off', -200, 200);
        html += `<div class="set-row"><span class="set-label">Input System</span><span style="color:#aaa; font-weight:bold;">FunkyFriday (Default)</span></div>`;
    } 
    else if (tab === 'visuals') {
        html += renderToggle('Vivid Lights', 'vivid');
        html += renderToggle('Screen Shake', 'shake');
        html += renderToggle('Mostrar Juez', 'judgeVis');
        html += renderToggle('Mostrar FC Status', 'showFC'); // Nuevo
        html += renderToggle('Mostrar Mean MS', 'showMean'); // Nuevo
        html += renderRange('Opacidad Carril (%)', 'trackOp', 0, 100);
        html += renderRange('Posición Juez Y', 'judgeY', 0, 100);
        html += renderRange('Posición Juez X', 'judgeX', 0, 100);
        html += renderRange('Tamaño Juez', 'judgeS', 5, 20);
        html += `<div style="margin-top:15px;"><button class="btn-small btn-add" onclick="document.getElementById('bg-file').click()">🖼️ CAMBIAR FONDO</button></div>`;
        html += `<input type="file" id="bg-file" accept="image/*" style="display:none" onchange="handleBg(this)">`;
    } 
    else if (tab === 'audio') {
        html += renderRange('Volumen Música', 'vol', 0, 100);
        html += renderToggle('Hit Sounds', 'hitSound'); // Nuevo toggle
        html += renderRange('Volumen Hits', 'hvol', 0, 100);
        html += renderToggle('Miss Sounds', 'missSound'); // Nuevo toggle
        html += renderRange('Volumen Miss', 'missVol', 0, 100);
        html += `<div style="margin-top:15px; display:flex; gap:10px;">
            <button class="btn-small btn-add" onclick="document.getElementById('hit-file').click()">🔊 CUSTOM HIT</button>
            <button class="btn-small btn-chat" onclick="document.getElementById('miss-file').click()">🔇 CUSTOM MISS</button>
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
        setTimeout(() => renderLaneConfig(4), 50);
    }

    content.innerHTML = html;
}

// Helpers HTML
function renderToggle(label, key) {
    if (typeof cfg[key] === 'undefined') cfg[key] = false; 
    const val = cfg[key];
    // Usa onclick inline para cambiar el valor al instante
    return `
    <div class="set-row">
        <span class="set-label">${label}</span>
        <button id="tog-${key}" class="toggle-switch ${val ? 'on' : 'off'}" onclick="toggleCfg('${key}')">${val ? 'ON' : 'OFF'}</button>
    </div>`;
}

function renderRange(label, key, min, max) {
    let val = cfg[key];
    // Normalizar volúmenes que son 0.0-1.0 a 0-100
    if (key === 'vol' || key === 'hvol' || key === 'missVol') val = Math.round((val||0.5) * 100);
    if (val === undefined) val = (min + max) / 2;
    return `
    <div class="set-row">
        <span class="set-label">${label}</span>
        <div style="display:flex; gap:10px; align-items:center;">
            <input type="range" min="${min}" max="${max}" value="${val}" oninput="updateCfgVal('${key}', this.value)">
            <div id="disp-${key}" class="num-input">${val}</div>
        </div>
    </div>`;
}

// Lógica de cambio de valores
function toggleCfg(key) {
    cfg[key] = !cfg[key];
    const btn = document.getElementById('tog-' + key);
    if(btn) {
        btn.className = `toggle-switch ${cfg[key] ? 'on' : 'off'}`;
        btn.innerText = cfg[key] ? 'ON' : 'OFF';
    }
    applyCfg(); // Aplicar cambios visuales (como middlescroll) al instante
}

function updateCfgVal(key, val) {
    const disp = document.getElementById('disp-'+key);
    if(disp) disp.innerText = val;
    
    if (key === 'vol' || key === 'hvol' || key === 'missVol') cfg[key] = val / 100;
    else cfg[key] = parseInt(val);
    
    applyCfg();
}

// Sobrescritura de openModal para interceptar 'settings'
const _origOpenModal = window.openModal; 
window.openModal = function(id) {
    if (id === 'settings') {
        openSettingsMenu();
    } else {
        const m = document.getElementById('modal-'+id);
        if(m) m.style.display='flex';
        // Lógica legacy para otros modales
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
            if(cover) cover.style.backgroundImage = curSongData.imageURL ? `url(${curSongData.imageURL})` : ''; 
        }
    }
}

function saveSettings() {
    applyCfg();
    if(typeof save === 'function') { save(); notify("Ajustes guardados"); }
    const m = document.getElementById('modal-settings');
    if(m) m.style.display='none';
    updUI();
}

function applyCfg() { 
    // Aplicar variables CSS
    document.documentElement.style.setProperty('--track-alpha', (cfg.trackOp!==undefined?cfg.trackOp:10)/100); 
    document.documentElement.style.setProperty('--judge-y', (cfg.judgeY||40) + '%'); 
    
    // Aplicar Middle Scroll Class
    const track = document.getElementById('track');
    if(track) {
        if(cfg.middleScroll) track.classList.add('middle-scroll');
        else track.classList.remove('middle-scroll');
    }
}

// === FUNCIONES ESTÁNDAR (TIENDA, AMIGOS, ETC) ===
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

function openShop() {
    setText('shop-sp', (user.sp || 0).toLocaleString());
    const grid = document.getElementById('shop-items');
    if(grid && typeof SHOP_ITEMS !== 'undefined') {
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
    }
    // Usamos la implementación interna, no la global recursiva
    const m = document.getElementById('modal-shop');
    if(m) m.style.display = 'flex';
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

// === FUNCIONES DE CONFIG DE TECLAS ===
function renderLaneConfig(k){ 
    document.querySelectorAll('.kb-tab').forEach(t=>t.classList.remove('active')); 
    const tab = document.getElementById('tab-'+k);
    if(tab) tab.classList.add('active'); 
    
    const c=document.getElementById('lanes-container'); 
    if(!c) return;
    c.innerHTML=''; 
    
    for(let i=0; i<k; i++){ 
        const l = cfg.modes[k][i]; 
        const d=document.createElement('div'); 
        d.className='l-col'; 
        const shapePath = (typeof PATHS !== 'undefined') ? (PATHS[l.s] || PATHS['circle']) : ""; 
        d.innerHTML=`<div class="key-bind ${remapIdx===i && remapMode===k?'listening':''}" onclick="remapKey(${k},${i})">${l.k.toUpperCase()}</div><div class="shape-indicator" onclick="cycleShape(${k},${i})"><svg class="shape-svg-icon" viewBox="0 0 100 100"><path d="${shapePath}"/></svg></div><input type="color" class="col-pk" value="${l.c}" onchange="updateLaneColor(${k},${i},this.value)">`; 
        c.appendChild(d); 
    } 
}
function remapKey(k,i){ if(document.activeElement) document.activeElement.blur(); remapMode=k; remapIdx=i; renderLaneConfig(k); }
function updateLaneColor(k,i,v){ cfg.modes[k][i].c=v; }
function cycleShape(k,i){ const shapes=['circle','arrow','square','diamond']; const cur=shapes.indexOf(cfg.modes[k][i].s); cfg.modes[k][i].s = shapes[(cur+1)%4]; renderLaneConfig(k); }

// === UPLOAD HELPERS ===
function handleBg(i){ if(i.files[0]){ const r=new FileReader(); r.onload=e=>{user.bg=e.target.result;save();}; r.readAsDataURL(i.files[0]); i.value=""; }}
function uploadAvatar(i){ if(i.files[0]){ const r=new FileReader(); r.onload=e=>{user.avatar=e.target.result;user.avatarData=e.target.result;save(); updUI(); updateFirebaseScore();}; r.readAsDataURL(i.files[0]); i.value=""; }}
async function loadHitSound(i){ if(i.files[0]){ const buf = await i.files[0].arrayBuffer(); hitBuf = await st.ctx.decodeAudioData(buf); notify("Hit Sound Custom cargado"); i.value = ""; } }
async function loadMissSound(i){ if(i.files[0]){ const buf = await i.files[0].arrayBuffer(); missBuf = await st.ctx.decodeAudioData(buf); notify("Miss Sound Custom cargado"); i.value = ""; } }
function closeModal(id){ const m = document.getElementById('modal-'+id); if(m) m.style.display='none'; }
