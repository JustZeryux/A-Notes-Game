/* ==========================================================
   SOCIAL.JS - AMIGOS, BÚSQUEDA, CHAT Y RETOS 1v1 PRO
   ========================================================== */

// === MOTOR DE PRESENCIA ONLINE Y ACTIVIDAD (RICH PRESENCE) ===
window.pingOnlineStatus = function() {
    if(window.db && window.user && window.user.name && window.user.name !== 'Guest') {
        window.db.collection('users').doc(window.user.name).update({
            lastSeen: Date.now(),
            currentActivity: window.isMultiplayer ? "⚔️ Jugando en Multiplayer" : (window.isEditing ? "✏️ En el Editor Studio" : "🎵 En el Menú Principal")
        }).catch(e => {});
    }
};

setInterval(window.pingOnlineStatus, 30000); // Actualiza estado cada 30s

// === BUSCADOR DE AMIGOS (REPARADO Y FUNCIONAL) ===
window.searchUsers = async function() {
    const q = document.getElementById('friend-search-inp').value.trim();
    const resArea = document.getElementById('friend-search-results');
    if(!q) { resArea.innerHTML = ''; return; }
    
    resArea.innerHTML = '<div style="color:var(--gold); text-align:center; padding: 20px;">Buscando jugadores... 🔍</div>';
    
    try {
        // Búsqueda inteligente en Firebase por nombre (Prefijo)
        const snap = await window.db.collection('users')
            .where(firebase.firestore.FieldPath.documentId(), '>=', q)
            .where(firebase.firestore.FieldPath.documentId(), '<=', q + '\uf8ff')
            .limit(10).get();
            
        resArea.innerHTML = '';
        if(snap.empty) { resArea.innerHTML = '<div style="color:#aaa; text-align:center; padding: 20px;">No se encontró a nadie con ese nombre.</div>'; return; }
        
        snap.forEach(doc => {
            if(doc.id === window.user.name) return; // No te busques a ti mismo
            
            resArea.innerHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; background:#111; margin-top:5px; border-radius:8px; border-left:4px solid var(--blue);">
                    <div style="font-weight:bold; color:white; font-size:1.2rem; cursor:pointer; display:flex; gap:10px; align-items:center;" onclick="if(typeof window.showUserProfile==='function') window.showUserProfile('${doc.id}')">
                        <div style="width:30px; height:30px; border-radius:50%; background:#333; overflow:hidden;"><img src="${doc.data().avatarUrl || 'img/default_avatar.png'}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src=''"></div>
                        ${doc.id}
                    </div>
                    <button class="action" style="padding:8px 20px; font-size:0.9rem; height:auto; background:var(--blue); color:white;" onclick="window.sendFriendReq('${doc.id}')">➕ AGREGAR</button>
                </div>
            `;
        });
    } catch(e) { 
        resArea.innerHTML = '<div style="color:#F9393F; text-align:center;">Error de conexión. Intenta de nuevo.</div>'; 
    }
};

// === ENVIAR SOLICITUD DE AMISTAD (BLINDADO ANTI-DUPLICADOS) ===
window.sendFriendReq = async function(target) {
    if(!window.user || window.user.name === "Guest" || !window.db) return window.notify("Debes iniciar sesión para agregar amigos.", "error");
    
    try {
        const targetRef = window.db.collection('users').doc(target);
        const doc = await targetRef.get();
        if(!doc.exists) return window.notify("El jugador no existe en la base de datos.", "error");
        
        let data = doc.data();
        let reqs = data.friendRequests || [];
        let friends = data.friends || [];
        
        if(friends.includes(window.user.name)) return window.notify(`Ya eres amigo de ${target}.`, "warning");
        if(reqs.includes(window.user.name)) return window.notify(`Ya le habías enviado una solicitud a ${target}.`, "warning");
        
        // Empujamos nuestro nombre a su lista de solicitudes
        reqs.push(window.user.name);
        await targetRef.update({ friendRequests: reqs });
        
        window.notify(`¡Solicitud enviada a ${target}! 📨`, "success");
    } catch(e) { window.notify("Error al enviar solicitud. Revisa tu conexión.", "error"); }
};

// === ACEPTAR / RECHAZAR SOLICITUDES ===
window.acceptFriend = async function(friendName) {
    try {
        // 1. Me quito la solicitud y lo agrego a mis amigos
        let myReqs = window.user.friendRequests.filter(n => n !== friendName);
        let myFriends = window.user.friends || [];
        if(!myFriends.includes(friendName)) myFriends.push(friendName);
        
        await window.db.collection('users').doc(window.user.name).update({
            friendRequests: myReqs,
            friends: myFriends
        });
        
        // 2. Lo agrego a los amigos de ÉL en la base de datos
        const friendRef = window.db.collection('users').doc(friendName);
        const fDoc = await friendRef.get();
        if(fDoc.exists) {
            let fData = fDoc.data();
            let fFriends = fData.friends || [];
            if(!fFriends.includes(window.user.name)) fFriends.push(window.user.name);
            await friendRef.update({ friends: fFriends });
        }
        
        window.user.friendRequests = myReqs;
        window.user.friends = myFriends;
        window.notify(`¡Ahora eres amigo de ${friendName}! 🎉`, "success");
        if(typeof window.updateSocialUI === 'function') window.updateSocialUI();
    } catch(e) { window.notify("Error al aceptar al amigo.", "error"); }
};

window.rejectFriend = async function(friendName) {
    let myReqs = window.user.friendRequests.filter(n => n !== friendName);
    await window.db.collection('users').doc(window.user.name).update({ friendRequests: myReqs });
    window.user.friendRequests = myReqs;
    if(typeof window.updateSocialUI === 'function') window.updateSocialUI();
};

// ==========================================================
// ⚔️ SISTEMA DE RETOS 1V1 (POP-UPS AUTOMÁTICOS)
// ==========================================================
window.challengeUser = async function(target) {
    if(!window.user || !window.db) return;
    
    // Creamos una clave única para la sala
    let lobbyId = "PVP_" + window.user.name + "_" + Math.floor(Math.random() * 100000);
    window.notify(`Enviando desafío a ${target}... ⚔️`, "info");
    
    try {
        const targetRef = window.db.collection('users').doc(target);
        const doc = await targetRef.get();
        if(!doc.exists) return window.notify("El jugador no está disponible.", "error");
        
        let data = doc.data();
        let invs = data.invites || [];
        
        // Le inyectamos la invitación directamente a su perfil
        invs.push({
            from: window.user.name,
            lobbyId: lobbyId,
            time: Date.now()
        });
        
        await targetRef.update({ invites: invs });
        
        window.notify(`¡Reto enviado! Si acepta, irás a la sala automáticamente.`, "success");
        
        // Te convierte automáticamente en Host de tu propia sala mientras lo esperas
        if(typeof window.createLobby === 'function') {
            window.createLobby(lobbyId, true, "1v1 Privado vs " + target);
        }
    } catch(e) { window.notify("Error al enviar el reto.", "error"); }
};

// Esta función se activa mágicamente gracias al Radar de `online.js`
window.showInviteModal = function(inv) {
    const modalHTML = `
    <div id="modal-invite-${inv.lobbyId}" class="modal-overlay" style="display:flex; z-index:9999999; backdrop-filter:blur(10px);">
        <div class="modal-panel" style="border:2px solid #F9393F; text-align:center; box-shadow:0 0 50px rgba(249,57,63,0.5);">
            <div class="modal-neon-header" style="border-bottom:none;">
                <h2 style="color:#F9393F; font-size:2rem; text-shadow:0 0 15px #F9393F;">⚔️ ¡NUEVO RETO 1v1! ⚔️</h2>
            </div>
            <div class="modal-neon-content" style="padding:20px;">
                <p style="font-size:1.3rem; color:white; margin-bottom:20px;">
                    El jugador <b style="color:var(--gold); font-size:1.8rem;">${inv.from}</b><br> te ha desafiado a una partida a muerte.
                </p>
                <div style="display:flex; gap:15px; margin-top:30px;">
                    <button class="action" style="flex:1; background:#12FA05; color:black; font-weight:900; font-size:1.2rem;" onclick="window.acceptInvite('${inv.lobbyId}', '${inv.from}')">ACEPTAR RETO</button>
                    <button class="action secondary" style="flex:1; border-color:#F9393F; color:#F9393F; font-weight:bold;" onclick="document.getElementById('modal-invite-${inv.lobbyId}').remove()">GALLINA (Rechazar)</button>
                </div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    if(typeof playHover === 'function') playHover();
};

window.acceptInvite = function(lobbyId, hostName) {
    // Cerramos el anuncio
    const modal = document.getElementById(`modal-invite-${lobbyId}`);
    if(modal) modal.remove();
    
    window.notify(`Uniéndose a la sala de ${hostName}... 🔥`, "info");
    
    // Cierra todos los menús estorbosos para ir a la sala limpios
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
    
    // Conectarte al lobby de multiplayer.js
    if(typeof window.joinLobby === 'function') {
        window.joinLobby(lobbyId);
    } else {
        window.notify("Error fatal: Sistema multijugador desconectado.", "error");
    }
};

// === CHAT GLOBAL (AHORA CON COMANDOS) ===
window.sendGlobalMessage = async function() {
    const inp = document.getElementById('chat-input-msg');
    if(!inp) return;
    const txt = inp.value.trim();
    if(!txt) return;
    
    inp.value = '';
    
    // Comandos de Admin o Atajos Rápidos
    if (txt === '/1v1') {
        let roomName = "PUB_" + window.user.name + "_" + Date.now();
        window.notify("Creando sala 1v1 pública...", "info");
        if(typeof window.createLobby === 'function') {
            window.createLobby(roomName, false, "Reto Abierto de " + window.user.name);
        }
        return; // Detenemos aquí para que el mensaje no se envíe como texto normal
    }
    
    try {
        await window.db.collection('global_chat').add({
            user: window.user.name,
            msg: txt,
            time: Date.now(),
            avatarUrl: window.user.avatarUrl || null
        });
    } catch(e) { window.notify("No se pudo enviar el mensaje", "error"); }
};
