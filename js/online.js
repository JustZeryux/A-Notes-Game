fu/* === ONLINE SYSTEM (LOBBY, FRIENDS & CHALLENGES) === */

let currentLobbyId = null;
let lobbyListener = null;
let multiScores = [];

function initOnline() {
    if(typeof Peer === 'undefined') return;
    peer = new Peer(null, { secure: true }); 
    peer.on('open', (id) => {
        myPeerId = id;
        if(db && typeof user !== 'undefined' && user.name !== "Guest") {
            db.collection("users").doc(user.name).set({ 
                peerId: id, 
                online: true, 
                lastSeen: firebase.firestore.FieldValue.serverTimestamp() 
            }, { merge: true });
        }
    });
    
    // Escuchar notificaciones de desafíos
    if(user.name !== "Guest") {
        db.collection("users").doc(user.name).collection("notifications")
            .orderBy("timestamp", "desc").limit(5)
            .onSnapshot(snap => {
                snap.docChanges().forEach(change => {
                    if (change.type === "added") {
                        const n = change.doc.data();
                        // Solo mostrar si es reciente (menos de 10s) para evitar spam al cargar
                        if (Date.now() - n.timestamp.toMillis() < 10000) {
                            if(n.type === 'challenge') {
                                notifyChallenge(n.from, n.lobbyId, n.songName);
                            } else {
                                notify(n.body, "info");
                            }
                            // Borrar notificación para que no salga de nuevo
                            change.doc.ref.delete(); 
                        }
                    }
                });
            });
    }
}

// === LOBBY BROWSER (SALA ONLINE) ===
window.openLobbyBrowser = function() {
    const modal = document.getElementById('modal-lobbies');
    const list = document.getElementById('lobby-list');
    if(!modal || !list) return;
    
    modal.style.display = 'flex';
    list.innerHTML = '<div class="loader"></div>';

    db.collection("lobbies").where("status", "==", "waiting")
        .orderBy("createdAt", "desc").limit(20)
        .onSnapshot(snap => {
            list.innerHTML = '';
            if(snap.empty) {
                list.innerHTML = '<div style="text-align:center; color:#666; padding:20px;">No hay salas públicas. ¡Crea una!</div>';
                return;
            }
            
            snap.forEach(doc => {
                const l = doc.data();
                if(l.config && l.config.private) return; // No mostrar privadas

                const row = document.createElement('div');
                row.className = 'lobby-box';
                row.onclick = () => joinLobby(doc.id);
                row.innerHTML = `
                    <div class="lobby-info">
                        <div class="lobby-host">HOST: ${l.host}</div>
                        <div class="lobby-details">🎵 ${l.songTitle || 'Desconocida'}</div>
                        <div style="font-size:0.8rem; margin-top:5px;">
                            ${l.players.length}/8 Jugadores | 
                            <span style="color:${l.config.ranked ? 'gold' : '#aaa'}">${l.config.ranked ? 'RANKED' : 'CASUAL'}</span>
                        </div>
                    </div>
                    <button class="btn-small btn-add">UNIRSE</button>
                `;
                list.appendChild(row);
            });
        });
};

window.joinLobby = function(lobbyId) {
    if(!user.name || user.name === "Guest") return notify("Inicia sesión para jugar online", "error");
    
    const lobbyRef = db.collection("lobbies").doc(lobbyId);
    
    db.runTransaction(async (t) => {
        const doc = await t.get(lobbyRef);
        if(!doc.exists) throw "La sala ya no existe.";
        const data = doc.data();
        if(data.status !== "waiting") throw "La partida ya empezó.";
        if(data.players.length >= 8) throw "Sala llena.";
        
        const playerData = { name: user.name, avatar: user.avatarData || '', status: 'joined' };
        t.update(lobbyRef, { players: firebase.firestore.FieldValue.arrayUnion(playerData) });
        return data; // Return data for next step
    }).then((data) => {
        currentLobbyId = lobbyId;
        closeModal('lobbies');
        
        // Cargar canción si no la tengo
        db.collection("globalSongs").doc(data.songId).get().then(sDoc => {
            if(sDoc.exists) {
                curSongData = { id: sDoc.id, ...sDoc.data() };
                openHostPanel(curSongData); // Reutilizamos panel de host pero modo cliente
                document.getElementById('btn-start-match').style.display = 'none'; // Clientes no inician
            }
        });
        listenToLobby(lobbyId);
    }).catch(e => notify(e, "error"));
};

// === CREAR LOBBY (HOST) ===
window.createLobby = function(songId, isPrivate = false) {
    if (!db || !user.name || user.name === "Guest") return notify("Debes iniciar sesión", "error");
    
    // Configuración desde el panel
    const allowedKeys = [];
    if(document.getElementById('chk-4k')?.checked) allowedKeys.push(4);
    if(document.getElementById('chk-6k')?.checked) allowedKeys.push(6);
    if(document.getElementById('chk-7k')?.checked) allowedKeys.push(7);

    const lobbyData = {
        host: user.name,
        songId: songId,
        songTitle: curSongData.title,
        status: 'waiting',
        players: [{ name: user.name, avatar: user.avatarData || '', status: 'ready' }],
        config: {
            density: cfg.lobbyDen || 5,
            ranked: cfg.lobbyRanked || false,
            keys: allowedKeys.length > 0 ? allowedKeys : [4],
            private: isPrivate
        },
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection("lobbies").add(lobbyData).then(docRef => {
        currentLobbyId = docRef.id;
        listenToLobby(currentLobbyId);
        if(!isPrivate) notify("Sala creada. Esperando jugadores...");
    });
    
    return currentLobbyId; // Return para promesas (challenge)
};

function listenToLobby(lobbyId) {
    if (lobbyListener) lobbyListener();
    lobbyListener = db.collection("lobbies").doc(lobbyId).onSnapshot(doc => {
        if (!doc.exists) return leaveLobby();
        const data = doc.data();
        
        // Si inicia la partida
        if (data.status === 'playing' && !isMultiplayer) {
            isMultiplayer = true;
            cfg.den = data.config.density;
            st.ranked = data.config.ranked;
            closeModal('host');
            startGame(data.config.keys[0]); // Iniciar con la primera key permitida
            notify("¡PARTIDA INICIADA!");
        }
        
        // Actualizar lista visual en el panel
        if(typeof updateHostPanelUI === 'function') updateHostPanelUI(data.players);
    });
}

window.startLobbyMatch = function() {
    if(!currentLobbyId) return;
    db.collection("lobbies").doc(currentLobbyId).update({ status: 'playing' });
};

window.leaveLobby = function() {
    if (currentLobbyId) {
        if (lobbyListener) lobbyListener();
        // Si soy host, borro la sala. Si soy cliente, me salgo.
        // Simplificado: por ahora borramos referencia local.
        // En prod: db remove player from array.
        currentLobbyId = null;
        isMultiplayer = false;
        closeModal('host');
    }
};

// === DESAFIOS (CHALLENGE SYSTEM) ===
window.challengeFriend = function(targetName) {
    if(!curSongData) return notify("Selecciona una canción primero (Ve a Canciones Globales)", "error");
    
    notify(`Desafiando a ${targetName}...`, "info");
    
    // 1. Crear Lobby Privado
    const lobbyData = {
        host: user.name,
        songId: curSongData.id,
        songTitle: curSongData.title,
        status: 'waiting',
        players: [{ name: user.name, avatar: user.avatarData || '', status: 'ready' }],
        config: { density: 5, ranked: false, keys: [4], private: true },
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection("lobbies").add(lobbyData).then(docRef => {
        currentLobbyId = docRef.id;
        listenToLobby(currentLobbyId);
        openHostPanel(curSongData); // Mostrar panel al host
        
        // 2. Enviar notificación al rival
        db.collection("users").doc(targetName).collection("notifications").add({
            type: "challenge",
            from: user.name,
            lobbyId: docRef.id,
            songName: curSongData.title,
            body: `${user.name} te desafía a: ${curSongData.title}`,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        notify("Desafío enviado. Esperando a que se una.");
    });
};

function notifyChallenge(from, lobbyId, songName) {
    const area = document.getElementById('notification-area');
    const card = document.createElement('div');
    card.className = 'notify-card';
    card.style.borderLeftColor = "var(--gold)";
    card.innerHTML = `
        <div class="notify-title">⚔️ DESAFÍO DE ${from}</div>
        <div class="notify-body">Canción: ${songName}</div>
        <div class="notify-actions">
            <button class="btn-small btn-acc" onclick="joinLobby('${lobbyId}')">ACEPTAR</button>
            <button class="btn-small" style="background:#F9393F" onclick="this.parentElement.parentElement.remove()">IGNORAR</button>
        </div>
    `;
    area.appendChild(card);
}

// === AMIGOS: RESPONDER SOLICITUD ===
window.respondFriend = function(targetName, accept) {
    if(!user.name || user.name === "Guest") return notify("Error de sesión", "error");

    const batch = db.batch();
    const myRef = db.collection("users").doc(user.name);
    const targetRef = db.collection("users").doc(targetName);

    batch.update(myRef, {
        requests: firebase.firestore.FieldValue.arrayRemove(targetName)
    });

    if(accept) {
        batch.update(myRef, { friends: firebase.firestore.FieldValue.arrayUnion(targetName) });
        batch.update(targetRef, { friends: firebase.firestore.FieldValue.arrayUnion(user.name) });
        notify(`¡${targetName} ahora es tu amigo!`, "success");
    } else {
        notify("Solicitud eliminada");
    }

    batch.commit().catch(err => notify("Error DB: " + err.message, "error"));
};

// === LIVE SCORE ===
window.sendLobbyScore = function(score) {
    // Implementación futura: Escribir en subcolección 'scores' del lobby
};
