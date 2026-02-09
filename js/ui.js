/* === UI LOGIC === */
function updUI(){
    document.getElementById('m-name').innerText=user.name;
    document.getElementById('p-name').innerText=user.name;
    document.getElementById('ig-name').innerText=user.name;
    document.getElementById('h-pp').innerText=user.pp;
    document.getElementById('h-sp').innerText=user.sp || 0;
    
    document.getElementById('p-score').innerText=user.score.toLocaleString();
    document.getElementById('p-plays').innerText=user.plays;
    document.getElementById('p-pp-display').innerText=user.pp;
    document.getElementById('p-sp-display').innerText=user.sp || 0;

    document.getElementById('m-rank').innerText = "LVL " + user.lvl;
    document.getElementById('p-lvl-txt').innerText = "LVL " + user.lvl;
    
    // XP Calculation Display
    let xpReq = 1000 * Math.pow(1.05, user.lvl - 1);
    if(user.lvl >= 10) xpReq = 1000 * Math.pow(1.02, user.lvl - 1); // Soft cap visual
    xpReq = Math.floor(xpReq);

    const pct = Math.min(100, (user.xp / xpReq) * 100);
    document.getElementById('p-xp-bar').style.width = pct + "%";
    document.getElementById('p-xp-txt').innerText = `${Math.floor(user.xp)} / ${xpReq} XP`;
    document.getElementById('p-global-rank').innerText = "#--";
    
    if(user.avatarData) { 
        document.getElementById('m-av').style.backgroundImage=`url(${user.avatarData})`; document.getElementById('m-av').innerText=""; 
        document.getElementById('p-av-big').style.backgroundImage=`url(${user.avatarData})`; 
        document.getElementById('ig-av').style.backgroundImage=`url(${user.avatarData})`; 
    }
    if(user.bg) { document.getElementById('bg-image').src=user.bg; document.getElementById('bg-image').style.opacity=0.3; }

    document.getElementById('set-spd').value=cfg.spd;
    document.getElementById('set-den').value=cfg.den;
    document.getElementById('set-vol').value=cfg.vol*100;
    document.getElementById('set-hvol').value=cfg.hvol*100;
    document.getElementById('set-down').checked=cfg.down;
    document.getElementById('set-vivid').checked=cfg.vivid;
    const shakeEl = document.getElementById('set-shake'); if(shakeEl) cfg.shake=shakeEl.checked;
    document.getElementById('set-off').value=cfg.off;
    document.getElementById('set-track-op').value=cfg.trackOp;
    document.getElementById('set-judge-y').value=cfg.judgeY;
    document.getElementById('set-judge-x').value=cfg.judgeX;
    document.getElementById('set-judge-s').value=cfg.judgeS;
    document.getElementById('set-judge-vis').checked=cfg.judgeVis;
    
    const isGoogle = user.pass === "google-auth";
    document.getElementById('local-acc-settings').style.display = isGoogle ? 'none' : 'block';
    document.getElementById('google-acc-settings').style.display = isGoogle ? 'block' : 'none';
}

function changeSection(sec) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    // Mapa de botones
    const map = { 'songs': 'nav-songs', 'multi': 'nav-multi', 'shop': 'nav-shop', 'settings': 'nav-settings', 'rank': 'nav-rank', 'friends': 'nav-friends' };
    if(map[sec]) document.getElementById(map[sec]).classList.add('active');
}

function switchProfileTab(tab) {
    document.querySelectorAll('.settings-tabs .kb-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('ptab-'+tab).classList.add('active');
    document.getElementById('p-tab-content-resumen').style.display = tab === 'resumen' ? 'block' : 'none';
    document.getElementById('p-tab-content-cuenta').style.display = tab === 'cuenta' ? 'block' : 'none';
}

function openShop() {
    document.getElementById('shop-sp').innerText = user.sp || 0;
    openModal('shop');
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
                    const fData = fDoc.data();
                    const now = Math.floor(Date.now() / 1000);
                    const last = fData.lastSeen ? fData.lastSeen.seconds : 0;
                    const isOnline = (now - last) < 120; // 2 min tolerancia
                    
                    const d = document.createElement('div'); d.className='friend-row';
                    d.onclick = function() { showFriendProfile(f, fData, isOnline); };
                    
                    let avStyle = fData.avatarData ? `background-image:url(${fData.avatarData})` : '';
                    d.innerHTML = `<div style="display:flex;align-items:center; pointer-events:none;"><div class="friend-status ${isOnline?'online':''}"></div><div class="f-row-av" style="${avStyle}"></div><span class="friend-row-name">${f}</span></div>`;
                    friL.appendChild(d);
                });
            });
        } else { friL.innerHTML = '<div style="color:#666; padding:20px;">No tienes amigos aún. ¡Agrega a alguien!</div>'; }
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
    
    // Obtener rank (opcional, pesado)
    document.getElementById('fp-rank').innerText = "#?"; 

    if(fData.avatarData) document.getElementById('fp-av').style.backgroundImage = `url(${fData.avatarData})`;
    else document.getElementById('fp-av').style.backgroundImage = '';

    const statusTxt = document.getElementById('fp-status-text');
    const chalBtn = document.getElementById('btn-challenge');
    if(isOnline) {
        statusTxt.innerText = "En línea"; statusTxt.style.color = "var(--good)";
        chalBtn.disabled = false;
    } else {
        statusTxt.innerText = "Desconectado (Puede recibir mensajes)"; statusTxt.style.color = "#888";
        chalBtn.disabled = true; 
    }
    chalBtn.onclick = () => { challengeFriend(fName); closeModal('friend-profile'); };
    
    closeModal('friends');
    openModal('friend-profile');
}

/* === CHATS FLOTANTES (Estilo Roblox) === */
let activeChats = []; // ['nombreAmigo']

function openFloatingChat(friendName) {
    const target = friendName || selectedFriend;
    if(!target) return;
    if(activeChats.includes(target)) return; // Ya abierto
    if(activeChats.length >= 3) { closeFloatingChat(activeChats[0]); } // Max 3 chats
    
    closeModal('friend-profile'); // Cerrar modal si venimos de ahí
    
    activeChats.push(target);
    const container = document.getElementById('chat-overlay-container');
    const div = document.createElement('div');
    div.className = 'chat-window';
    div.id = 'chat-w-' + target;
    
    div.innerHTML = `
        <div class="cw-header" onclick="toggleMinChat('${target}')">
            <span>${target}</span>
            <span style="font-size:0.8rem; color:#888;" onclick="event.stopPropagation(); closeFloatingChat('${target}')">✕</span>
        </div>
        <div class="cw-body" id="cw-body-${target}"></div>
        <div class="cw-input-area">
            <input type="text" class="cw-input" placeholder="Mensaje..." onkeydown="if(event.key==='Enter') sendFloatChat('${target}', this)">
        </div>
    `;
    container.appendChild(div);
    
    // Iniciar listener para este chat
    initFloatChatListener(target);
}

function closeFloatingChat(target) {
    const el = document.getElementById('chat-w-' + target);
    if(el) el.remove();
    activeChats = activeChats.filter(c => c !== target);
}

function toggleMinChat(target) {
    const el = document.getElementById('chat-w-' + target);
    if(el) el.classList.toggle('minimized');
}

function sendFloatChat(target, inp) {
    const txt = inp.value.trim();
    if(!txt) return;
    const room = [user.name, target].sort().join("_");
    db.collection("chats").doc(room).collection("messages").add({
        user: user.name, text: txt, timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    inp.value = "";
}

function initFloatChatListener(target) {
    const room = [user.name, target].sort().join("_");
    const body = document.getElementById(`cw-body-${target}`);
    
    db.collection("chats").doc(room).collection("messages")
        .orderBy("timestamp", "desc").limit(20)
        .onSnapshot(snapshot => {
            if(!document.getElementById(`cw-body-${target}`)) return; // Chat cerrado
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

/* === NOTIFICATIONS V81 === */
function setupNotificationsListener() {
    if(user.name === "Guest" || !db) return;
    // Escuchar cambios en tiempo real, funciona aunque estuviera offline cuando se envió
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
    setTimeout(() => { 
        const prog = card.querySelector('.notify-progress');
        if(prog) prog.style.width = '0%'; 
    }, 50);
    setTimeout(() => closeNotification(id), duration);
}

function notify(msg, type="info", duration=3000) {
    const area = document.getElementById('notification-area');
    const id = Date.now();
    const card = document.createElement('div'); card.className = 'notify-card'; card.id = 'notif-'+id;
    if(type==="error") card.style.borderLeftColor = "#F9393F";
    else if(type==="success") card.style.borderLeftColor = "#12FA05";
    
    card.innerHTML = `<div class="notify-content"><div class="notify-title">${type.toUpperCase()}</div><div class="notify-body">${msg}</div></div><div class="notify-progress" style="transition-duration:${duration}ms"></div>`;
    area.appendChild(card);
    setTimeout(() => { const prog = card.querySelector('.notify-progress'); if(prog) prog.style.width = '0%'; }, 50);
    setTimeout(() => closeNotification(id), duration);
}

function closeNotification(id) {
    const card = document.getElementById('notif-'+id);
    if(card) { card.classList.add('closing'); setTimeout(()=>card.remove(), 300); }
}

async function handleAudio(i){ const b=document.getElementById('imp-txt'); b.innerText="PROCESANDO..."; if(i.files[0]){ unlockAudio(); const r=new FileReader(); r.onload=async e=>{ try{ const rawData = e.target.result; const bufferCopy = rawData.slice(0); const buf=await st.ctx.decodeAudioData(rawData); const n=i.files[0].name.replace(/\.[^/.]+$/,""); if(!user.songs.find(s=>s.id===n)){user.songs.push({id:n});save();} saveSongToDB(n, bufferCopy); const map = genMap(buf, 4); ramSongs=ramSongs.filter(s=>s.id!==n); ramSongs.push({id:n, buf:buf, map:map}); renderMenu(); notify("Canción importada: "+n); }catch(e){notify("Error audio: " + e, "error"); console.log(e);}finally{ b.innerText='📂 IMPORTAR CANCION'; i.value=""; } }; r.readAsArrayBuffer(i.files[0]); } else { b.innerText='📂 IMPORTAR CANCION'; } }
async function loadHitSound(i){ if(i.files[0]){ const buf = await i.files[0].arrayBuffer(); hitBuf = await st.ctx.decodeAudioData(buf); notify("Hit Sound Actualizado!"); i.value = ""; } }
function renderMenu(f=""){ const g=document.getElementById('song-grid'); g.innerHTML=''; user.songs.forEach(s=>{ const id = s.id || s; if(f&&!id.toLowerCase().includes(f.toLowerCase()))return; const c=document.createElement('div'); c.className='beatmap-card'; const isLoaded = ramSongs.find(r=>r.id===id); c.innerHTML=`<div class="bc-bg" style="background-image:linear-gradient(135deg,hsl(${(id.length*40)%360},60%,20%),black)"></div><div class="bc-info"><div class="bc-title">${id}</div><div class="bc-meta">${isLoaded ? '<span class="tag">READY</span>' : '<span class="tag warn">⚠️ CARGANDO CANCION...</span>'}<span class="tag keys">4K | 6K | 7K | 9K</span></div></div>`; c.onclick=()=>{ curSongId=id; if(isLoaded) openModal('diff'); else notify("Espera a que cargue la base de datos...", "error"); }; g.appendChild(c); }); }
function openModal(id){ 
    document.getElementById('modal-'+id).style.display='flex'; 
    if(id==='settings')renderLaneConfig(4); 
    if(id==='profile'){
        document.getElementById('login-view').style.display=user.name==='Guest'?'block':'none';
        document.getElementById('profile-view').style.display=user.name==='Guest'?'none':'block';
        // Reset tab
        switchProfileTab('resumen');
    } 
}
function closeModal(id){ document.getElementById('modal-'+id).style.display='none'; }
function saveSettings(){ cfg.spd=document.getElementById('set-spd').value; cfg.den=document.getElementById('set-den').value; cfg.vol=document.getElementById('set-vol').value/100; cfg.hvol=document.getElementById('set-hvol').value/100; cfg.down=document.getElementById('set-down').checked; cfg.vivid=document.getElementById('set-vivid').checked; const shakeEl = document.getElementById('set-shake'); if(shakeEl) cfg.shake=shakeEl.checked; cfg.off=parseInt(document.getElementById('set-off').value); cfg.trackOp=document.getElementById('set-track-op').value; cfg.judgeY=document.getElementById('set-judge-y').value; cfg.judgeX=document.getElementById('set-judge-x').value; cfg.judgeS=document.getElementById('set-judge-s').value; cfg.judgeVis=document.getElementById('set-judge-vis').checked; applyCfg(); save(); document.getElementById('modal-settings').style.display='none'; notify("Ajustes guardados"); }
function applyCfg() { document.documentElement.style.setProperty('--track-alpha', cfg.trackOp/100); document.documentElement.style.setProperty('--judge-y', cfg.judgeY + '%'); document.documentElement.style.setProperty('--judge-x', cfg.judgeX + '%'); document.documentElement.style.setProperty('--judge-scale', cfg.judgeS/10); document.documentElement.style.setProperty('--judge-op', cfg.judgeVis ? 1 : 0); }
function saveProfile(){ user.name=document.getElementById('l-user').value||"Guest"; save(); closeModal('profile'); }
function handleBg(i){ if(i.files[0]){ const r=new FileReader(); r.onload=e=>{user.bg=e.target.result;save();}; r.readAsDataURL(i.files[0]); i.value=""; }}
function uploadAvatar(i){ if(i.files[0]){ const r=new FileReader(); r.onload=e=>{user.avatar=e.target.result;user.avatarData=e.target.result;save(); updUI(); updateFirebaseScore();}; r.readAsDataURL(i.files[0]); i.value=""; }}
function renderLaneConfig(k){ document.querySelectorAll('.kb-tab').forEach(t=>t.classList.remove('active')); document.getElementById('tab-'+k).classList.add('active'); const c=document.getElementById('lanes-container'); c.innerHTML=''; for(let i=0; i<k; i++){ const l = cfg.modes[k][i]; const d=document.createElement('div'); d.className='l-col'; const shapePath = PATHS[l.s] || PATHS['circle']; d.innerHTML=`<div class="key-bind ${remapIdx===i && remapMode===k?'listening':''}" onclick="remapKey(${k},${i})">${l.k.toUpperCase()}</div><div class="shape-indicator" onclick="cycleShape(${k},${i})"><svg class="shape-svg-icon" viewBox="0 0 100 100"><path d="${shapePath}"/></svg></div><input type="color" class="col-pk" value="${l.c}" onchange="updateLaneColor(${k},${i},this.value)">`; c.appendChild(d); } }
function remapKey(k,i){ if(document.activeElement) document.activeElement.blur(); remapMode=k; remapIdx=i; renderLaneConfig(k); }
function updateLaneColor(k,i,v){ cfg.modes[k][i].c=v; }
function cycleShape(k,i){ const shapes=['circle','arrow','square','diamond']; const cur=shapes.indexOf(cfg.modes[k][i].s); cfg.modes[k][i].s = shapes[(cur+1)%4]; renderLaneConfig(k); }
