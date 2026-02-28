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
