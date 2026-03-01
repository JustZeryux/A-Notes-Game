/* ==========================================================
   SOCIAL.JS - Ranking AAA, Lista de Amigos y Estado Online
   ========================================================== */

// === MOTOR DE PRESENCIA ONLINE ===
window.pingOnlineStatus = function() {
    if(window.db && window.user && window.user.name && window.user.name !== 'Guest') {
        window.db.collection('users').doc(window.user.name).update({
            lastSeen: Date.now()
        }).catch(e => {});
    }
};

// Avisar a la base de datos que estamos activos
setInterval(window.pingOnlineStatus, 60000);
setTimeout(window.pingOnlineStatus, 3000);

// === RANKING GLOBAL (CARGA PARALELA DE ALTA VELOCIDAD) ===
window.openLeaderboard = function() {
    window.openModal('rank');
    const list = document.getElementById('rank-list');
    if(!list) return;
    
    list.innerHTML = '<div style="text-align:center; padding:50px; color:var(--gold); font-size:1.2rem; font-weight:bold;">Cargando jugadores globales... ⏳</div>';
    
    if(!window.db) return;
    
    window.db.collection("leaderboard").orderBy("pp", "desc").limit(50).get().then(async snap => {
        // 1. Recopilar todos los datos básicos primero
        const topPlayers = snap.docs.map(doc => ({ name: doc.id, ...doc.data() }));
        
        // 2. Descargar TODOS los avatares al mismo tiempo (Evita la carga 1x1)
        const userDocs = await Promise.all(
            topPlayers.map(p => window.db.collection("users").doc(p.name).get().catch(() => null))
        );

        list.innerHTML = '';
        
        // 3. Dibujar todos de golpe
        topPlayers.forEach((d, i) => {
            let pos = i + 1;
            let rankColor = "#333"; let posColor = "#aaa";
            
            if(pos === 1) { rankColor = "var(--gold)"; posColor = "var(--gold)"; }
            else if(pos === 2) { rankColor = "silver"; posColor = "silver"; }
            else if(pos === 3) { rankColor = "#cd7f32"; posColor = "#cd7f32"; }

            let uDoc = userDocs[i];
            let avUrl = (uDoc && uDoc.exists && uDoc.data().avatarData) ? uDoc.data().avatarData : 'icon.png'; 
            let lvl = (uDoc && uDoc.exists && uDoc.data().lvl) ? uDoc.data().lvl : 1;

            const card = document.createElement('div');
            card.style.cssText = `display:flex; align-items:center; background:#111; padding:10px 20px; border-radius:10px; border-left:4px solid ${rankColor}; cursor:pointer; transition:0.2s; gap:20px; margin-bottom:10px;`;
            card.onclick = () => { window.closeModal('rank'); window.showUserProfile(d.name); };

            card.innerHTML = `
                <div style="font-size:1.8rem; font-weight:900; width:45px; text-align:center; color:${posColor};">#${pos}</div>
                <div style="width:50px; height:50px; border-radius:12px; background:url('${avUrl}') center/cover; background-color:#222; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>
                <div style="flex:1;">
                    <div style="font-weight:900; font-size:1.2rem; color:white;">${d.name}</div>
                    <div style="font-size:0.85rem; color:#888; font-weight:bold;">Jugador Nivel ${lvl}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:900; color:var(--accent); font-size:1.5rem;">${(d.pp || 0).toLocaleString()} <span style="font-size:0.8rem; color:#aaa;">PP</span></div>
                </div>
            `;
            list.appendChild(card);
        });
    });
};

// === LISTA DE AMIGOS (CON INDICADORES ONLINE) ===
window.openFriends = function() {
    if(window.user.name === "Guest") return window.notify("Inicia sesión primero", "error");
    if(!window.db) return window.notify("Error de conexión", "error");
    
    window.openModal('friends');
    const reqList = document.getElementById('req-list');
    const friList = document.getElementById('friend-list');
    
    window.db.collection("users").doc(window.user.name).onSnapshot(async doc => {
        if(!doc.exists) return;
        const data = doc.data();
        
        // Dibujar Solicitudes
        if(reqList) {
            reqList.innerHTML = '';
            if(data.requests && data.requests.length > 0) {
                data.requests.forEach(reqName => {
                    const row = document.createElement('div');
                    row.style.cssText = "display:flex; align-items:center; justify-content:space-between; background:rgba(0, 255, 255, 0.05); padding:10px 15px; border-radius:8px; border:1px solid #00ffff; margin-bottom:10px;";
                    row.innerHTML = `
                        <span style="font-weight:900; color:white; font-size:1.1rem;">${reqName}</span>
                        <div style="display:flex; gap:10px;">
                            <button class="action" style="width:auto; padding:5px 15px; font-size:0.8rem; background:#00ffff; color:black;" onclick="window.respondFriend('${reqName}', true)">ACEPTAR</button>
                            <button class="action secondary" style="width:auto; padding:5px 15px; font-size:0.8rem; border-color:#F9393F; color:#F9393F;" onclick="window.respondFriend('${reqName}', false)">X</button>
                        </div>`;
                    reqList.appendChild(row);
                });
            } else {
                reqList.innerHTML = '<div style="color:#666; font-size:0.9rem; padding:10px; font-style:italic;">Sin solicitudes pendientes.</div>';
            }
        }

        // Dibujar Amigos y verificar si están Online
        if(friList) {
            friList.innerHTML = '';
            if(data.friends && data.friends.length > 0) {
                const fDocs = await Promise.all(
                    data.friends.map(fName => window.db.collection("users").doc(fName).get().catch(() => null))
                );

                data.friends.forEach((fName, i) => {
                    let fDoc = fDocs[i];
                    let avUrl = 'icon.png'; let lvl = 1; let pp = 0; let isOnline = false;

                    if(fDoc && fDoc.exists) {
                        let fd = fDoc.data();
                        avUrl = fd.avatarData || 'icon.png';
                        lvl = fd.lvl || 1;
                        pp = fd.pp || 0;
                        // Si se conectó hace menos de 5 minutos, está en línea
                        isOnline = (Date.now() - (fd.lastSeen || 0)) < 300000;
                    }

                    const card = document.createElement('div'); 
                    card.style.cssText = "display:flex; align-items:center; background:#111; padding:12px; border-radius:10px; border-left:4px solid var(--good); cursor:pointer; gap:15px; margin-bottom:10px;";
                    card.onclick = function() { window.closeModal('friends'); window.showUserProfile(fName); };
                    
                    const dotClass = isOnline ? 'status-online' : 'status-offline';
                    const statusText = isOnline ? 'En línea' : 'Desconectado';

                    card.innerHTML = `
                        <div style="width:50px; height:50px; border-radius:12px; background:url('${avUrl}') center/cover; background-color:#222;"></div>
                        <div style="flex:1;">
                            <div style="font-weight:900; font-size:1.2rem; color:white;">
                                <span class="status-dot ${dotClass}" title="${statusText}"></span>${fName}
                            </div>
                            <div style="font-size:0.85rem; color:#888; font-weight:bold;">
                                <span style="color:var(--gold)">LVL ${lvl}</span> &nbsp;|&nbsp; <span style="color:var(--accent)">${pp.toLocaleString()} PP</span>
                            </div>
                        </div>
                        <div style="color:var(--good); font-size:1.5rem;">▶</div>
                    `;
                    friList.appendChild(card);
                });
            } else {
                friList.innerHTML = '<div style="padding:20px; text-align:center; color:#666; font-weight:bold;">Aún no tienes amigos agregados.</div>';
            }
        }
    });
};
// ==========================================================
// PARCHE: SISTEMA DE CHAT Y DESAFÍOS PvP (GOD MODE)
// ==========================================================

// 1. Destruir el bucle infinito y crear un Chat Seguro
window.openFloatingChat = function(targetUser) {
    let chatBox = document.getElementById('global-chat-box');
    if (!chatBox) {
        chatBox = document.createElement('div');
        chatBox.id = 'global-chat-box';
        chatBox.style.cssText = 'position:fixed; bottom:20px; right:20px; width:320px; height:450px; background:#0a0a0a; border:2px solid var(--blue); border-radius:10px; z-index:999999; display:flex; flex-direction:column; box-shadow:0 10px 40px rgba(0,0,0,0.9); overflow:hidden; transition: 0.3s;';
        document.body.appendChild(chatBox);
    }
    
    chatBox.style.display = 'flex';
    chatBox.innerHTML = `
        <div style="background:linear-gradient(90deg, #111, var(--blue)); padding:15px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #333;">
            <strong style="color:white; font-size:1.1rem; text-shadow: 0 0 5px black;">💬 ${targetUser}</strong>
            <button onclick="document.getElementById('global-chat-box').style.display='none'" style="background:none; border:none; color:white; font-weight:bold; cursor:pointer; font-size:1.2rem;">X</button>
        </div>
        <div id="chat-messages-area" style="flex:1; overflow-y:auto; padding:15px; color:#ccc; font-size:0.9rem; display:flex; flex-direction:column; gap:10px; background:#111;">
            <div style="text-align:center; color:#666; font-size:0.8rem; padding:10px; background:rgba(0,0,0,0.5); border-radius:5px;">Conectando con ${targetUser}...</div>
        </div>
        <div style="padding:10px; display:flex; gap:5px; background:#050505; border-top:1px solid #222;">
            <input type="text" id="chat-input-msg" style="flex:1; background:#222; border:1px solid #444; color:white; padding:10px; border-radius:5px; outline:none;" placeholder="Escribe aquí..." onkeydown="if(event.key==='Enter') window.sendDirectMsg('${targetUser}')">
            <button class="action" style="width:auto; padding:10px 15px; background:var(--blue); color:white;" onclick="window.sendDirectMsg('${targetUser}')">▶</button>
        </div>
    `;
    setTimeout(() => document.getElementById('chat-input-msg').focus(), 100);
};

window.sendDirectMsg = function(target) {
    const inp = document.getElementById('chat-input-msg');
    const txt = inp.value.trim();
    if(!txt) return;
    
    const area = document.getElementById('chat-messages-area');
    area.innerHTML += `<div style="align-self:flex-end; background:var(--blue); color:white; padding:8px 12px; border-radius:12px 12px 0 12px; max-width:80%; word-wrap:break-word; box-shadow:0 2px 5px rgba(0,0,0,0.5);">${txt}</div>`;
    inp.value = '';
    area.scrollTop = area.scrollHeight;
    
    // Aquí se conectaría con Firebase para enviar a la base de datos (Futura BD de mensajes)
    if(window.notify) window.notify("Mensaje enviado a " + target, "success");
};

// 2. Sistema de Desafíos (PvP)
window.challengeUser = function(targetName) {
    // Definimos a quién vamos a desafiar
    window.lobbyTargetFriend = targetName;
    
    // Abrimos el selector de canciones igual que cuando creas una sala
    window.notify(`⚔️ Preparando desafío contra ${targetName}... Elige un mapa.`, "info");
    if (typeof openSongSelectorForLobby === 'function') {
        openSongSelectorForLobby();
    } else {
        alert("Error: multiplayer.js no está cargado correctamente.");
    }
};
