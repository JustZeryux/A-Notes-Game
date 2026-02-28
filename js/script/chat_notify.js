/* ==========================================================
   CHAT_NOTIFY.JS - Sistema de Chat, Notificaciones y Desafíos
   ========================================================== */

// === CHAT FLOTANTE MÚLTIPLE ===
window.openFloatingChat = function(targetUser) {
    if(!window.user.name || window.user.name === "Guest") return window.notify("Inicia sesión", "error");
    
    const container = document.getElementById('chat-overlay-container');
    if(!container) return;

    const existingId = `chat-w-${targetUser || 'global'}`;
    if(document.getElementById(existingId)) return; // Evitar duplicados

    const chatName = targetUser || "Chat Global";
    const chatWindow = document.createElement('div');
    chatWindow.className = 'chat-window';
    chatWindow.id = existingId;
    
    chatWindow.innerHTML = `
        <div class="cw-header" onclick="this.parentElement.classList.toggle('minimized')">
            <span>${chatName}</span>
            <span style="font-size:0.8rem">▼</span>
        </div>
        <div class="cw-body" id="cw-body-${targetUser}">
            <div style="color:#666; font-style:italic; text-align:center; margin-top:10px;">Inicio de la charla...</div>
        </div>
        <div class="cw-input-area">
            <input type="text" class="cw-input" placeholder="Escribe..." onkeypress="window.handleChatInput(event, '${targetUser}', this)">
        </div>
    `;
    
    container.appendChild(chatWindow);
    window.closeModal('profile');
    window.closeModal('friends');
};

window.handleChatInput = function(e, target, input) {
    if(e.key === 'Enter' && input.value.trim() !== "") {
        const txt = input.value.trim();
        if(window.db) {
            window.db.collection("chats").add({
                msg: txt,
                user: window.user.name,
                target: target || "global",
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(err => console.error("Error chat: " + err));
        }
        input.value = "";
    }
};

window.uiOpenChat = function(target) {
    window.openFloatingChat(target);
};

// === NOTIFICACIONES PUSH DENTRO DEL JUEGO ===
window.setupNotificationsListener = function() {
    if(!window.db || !window.user || window.user.name === "Guest") return;

    window.db.collection("users").doc(window.user.name).collection("notifications")
        .orderBy("timestamp", "desc")
        .limit(5)
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === "added") {
                    const data = change.doc.data();
                    const now = Date.now();
                    const notifTime = data.timestamp ? data.timestamp.toMillis() : 0;
                    
                    // Solo mostrar notificaciones de hace menos de 30 segundos
                    if (now - notifTime < 30000) { 
                        if (data.type === 'challenge') {
                            window.notifyChallenge(data.from, data.lobbyId, data.songName);
                            change.doc.ref.delete(); 
                        }
                    }
                }
            });
        });
};

window.notifyChallenge = function(fromUser, lobbyId, songName) {
    const area = document.getElementById('notification-area');
    if(!area) return;

    const card = document.createElement('div');
    card.className = 'notify-card';
    card.style.borderLeftColor = "var(--gold)";
    card.style.animation = "slideIn 0.3s forwards";

    card.innerHTML = `
        <div class="notify-title">⚔️ DESAFÍO DE ${fromUser}</div>
        <div class="notify-body">Te invita a jugar <b>${songName}</b>.</div>
        <div class="notify-actions">
            <button class="btn-small btn-acc" onclick="window.acceptChallenge('${lobbyId}', this)">ACEPTAR</button>
            <button class="btn-small" style="background:#444;" onclick="this.parentElement.parentElement.remove()">IGNORAR</button>
        </div>
    `;

    area.appendChild(card);
    if(typeof playHover === 'function') playHover(); 
};

window.acceptChallenge = function(lobbyId, btnElement) {
    if(window.joinLobbyData) {
        btnElement.innerText = "UNIENDO...";
        window.joinLobbyData(lobbyId).then(() => {
            btnElement.parentElement.parentElement.remove();
        });
    }
};

window.challengeFriend = function(friendName) {
    window.notify(`Desafiando a ${friendName}... Selecciona una canción.`, "info");
    window.closeModal('profile');
    window.closeModal('friends');
    if(typeof window.openSongSelectorForLobby === 'function') window.openSongSelectorForLobby();
    window.pendingInvite = friendName; 
};

// Abrir/Cerrar la campana
window.openNotifPanel = function() {
    const p = document.getElementById('notif-panel');
    p.style.display = p.style.display === 'none' ? 'block' : 'none';
};

// Guardar tu biografía y estado de privacidad
window.saveProfilePrivacy = async function() {
    if(!window.user || !window.db) return;
    const status = document.getElementById('inp-custom-status').value;
    const bio = document.getElementById('inp-bio').value;
    const hide = document.getElementById('chk-hide-items').checked;

    try {
        await window.db.collection('users').doc(window.user.name).update({
            customStatus: status,
            bio: bio,
            hideItems: hide
        });
        notify("Perfil actualizado", "success");
        toggleProfileSettings(false);
        showUserProfile(window.user.name); // Recargar
    } catch(e) { notify("Error al guardar", "error"); }
};

// Sistema de Notificaciones en Tiempo Real (Incluso si estabas offline)
window.listenToNotifications = function() {
    if(!window.user || !window.db) return;

    window.db.collection('users').doc(window.user.name)
      .collection('notifications').orderBy('timestamp', 'desc')
      .onSnapshot(snap => {
        const notifContainer = document.getElementById('notif-list-content');
        const badge = document.getElementById('notif-badge');
        
        if (snap.empty) {
            notifContainer.innerHTML = '<div style="text-align:center; color:#666; padding:20px;">No tienes notificaciones.</div>';
            badge.style.display = 'none';
            return;
        }

        notifContainer.innerHTML = '';
        let unreadCount = 0;

        snap.forEach(doc => {
            const data = doc.data();
            if(!data.read) unreadCount++;

            const div = document.createElement('div');
            div.style.padding = "10px";
            div.style.borderBottom = "1px solid #222";
            div.style.background = data.read ? "transparent" : "rgba(249, 57, 63, 0.1)"; // Rojo bajito si no está leída
            
            div.innerHTML = `
                <div style="font-weight:bold; color:${data.read ? '#aaa' : 'white'};">${data.title}</div>
                <div style="font-size:0.8rem; color:#888;">${data.msg}</div>
                ${data.type === 'friend_request' ? `<button onclick="acceptFriend('${data.from}', '${doc.id}')" style="margin-top:5px; background:var(--good); color:black; border:none; padding:2px 10px; cursor:pointer;">Aceptar</button>` : ''}
            `;
            notifContainer.appendChild(div);
        });

        if(unreadCount > 0) {
            badge.innerText = unreadCount;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    });
};

// Ejecutar el listener cuando inicies sesión (Pon esto en auth.js cuando el login sea exitoso)
// listenToNotifications();
