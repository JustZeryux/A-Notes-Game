/* === ONLINE SYSTEM (LOGIC ONLY - V19 STABLE) === */

let currentLobbyId = null;
let lobbyListener = null;
let multiScores = [];

// Inicializar conexión P2P y status
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
    
    // Listener de notificaciones (Desafíos)
    if(user.name !== "Guest") {
        db.collection("users").doc(user.name).collection("notifications")
            .orderBy("timestamp", "desc").limit(5)
            .onSnapshot(snap => {
                snap.docChanges().forEach(change => {
                    if (change.type === "added") {
                        const n = change.doc.data();
                        if (Date.now() - n.timestamp.toMillis() < 10000) {
                            if(n.type === 'challenge') notifyChallenge(n.from, n.lobbyId, n.songName);
                            else notify(n.body, "info");
                            change.doc.ref.delete(); 
                        }
                    }
                });
            });
    }
}

// === GESTIÓN DE SALAS (LOBBY DATA) ===

// Crear sala en Firebase
window.createLobbyData = function(songId, config) {
    if (!db || !user.name || user.name === "Guest") return Promise.reject("Debes iniciar sesión");

    const lobbyData = {
        host: user.name,
        songId: songId,
        songTitle: curSongData.title, // Variable global de main/ui
        status: 'waiting',
        players: [{ name: user.name, avatar: user.avatarData || '', status: 'ready', score: 0 }],
        config: config,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    return db.collection("lobbies").add(lobbyData).then(docRef => {
        currentLobbyId = docRef.id;
        subscribeToLobby(currentLobbyId);
        return docRef.id;
    });
};

// Escuchar cambios en la sala
function subscribeToLobby(lobbyId) {
    if (lobbyListener) lobbyListener();
    lobbyListener = db.collection("lobbies").doc(lobbyId).onSnapshot(doc => {
        
        if (!doc.exists) {
            leaveLobbyData();
            if(typeof closeModal === 'function') closeModal('host');
            return;
            if (data.config) {
        // Actualizar UI visualmente
        const keyDisp = document.getElementById('lobby-display-keys');
        const denDisp = document.getElementById('lobby-display-den');
        
        if (keyDisp) keyDisp.innerText = data.config.keys[0] + "K";
        if (denDisp) denDisp.innerText = data.config.density;
        
        // Actualizar variables locales pa
        }
        const data = doc.data();
        
        // Si el juego empieza
        if (data.status === 'playing') {
            if (!isMultiplayer) {
                isMultiplayer = true;
                cfg.den = data.config.density;
                st.ranked = data.config.ranked;
                if(typeof closeModal === 'function') closeModal('host');
                if(typeof startGame === 'function') startGame(data.config.keys[0]);
                if(typeof notify === 'function') notify("¡PARTIDA INICIADA!", "success");
            }
            // Actualizar leaderboard
            if(typeof updateMultiLeaderboardUI === 'function') updateMultiLeaderboardUI(data.players);
        }
        
        // Actualizar UI del panel de host
        if (data.status === 'waiting' && typeof updateHostPanelUI === 'function') {
            updateHostPanelUI(data.players);
        }
    });
}

// Unirse a una sala existente
window.joinLobbyData = function(lobbyId) {
    if(!user.name || user.name === "Guest") return;
    const lobbyRef = db.collection("lobbies").doc(lobbyId);
    
    db.runTransaction(async (t) => {
        const doc = await t.get(lobbyRef);
        if(!doc.exists) throw "Sala no encontrada";
        const data = doc.data();
        if(data.status !== "waiting") throw "Partida en curso";
        if(data.players.length >= 8) throw "Sala llena";
        
        const exists = data.players.find(p => p.name === user.name);
        if(!exists) {
            t.update(lobbyRef, {
                players: firebase.firestore.FieldValue.arrayUnion({
                    name: user.name, avatar: user.avatarData||'', status: 'joined', score: 0
                })
            });
        }
        return data;
    }).then(data => {
        currentLobbyId = lobbyId;
        // Cargar datos de la canción para el cliente
        db.collection("globalSongs").doc(data.songId).get().then(sDoc => {
            if(sDoc.exists) {
                curSongData = { id: sDoc.id, ...sDoc.data() };
                if(typeof openHostPanel === 'function') openHostPanel(curSongData, true); // true = modo cliente
            }
        });
        subscribeToLobby(lobbyId);
    }).catch(e => { if(typeof notify === 'function') notify(e, "error"); });
};

window.startLobbyMatchData = function() {
    if(!currentLobbyId) return;
    db.collection("lobbies").doc(currentLobbyId).update({ status: 'playing' });
};

window.leaveLobbyData = function() {
    if (currentLobbyId) {
        if (lobbyListener) lobbyListener();
        if(user.name) {
             const lobbyRef = db.collection("lobbies").doc(currentLobbyId);
             lobbyRef.get().then(doc => {
                 if(doc.exists) {
                     if(doc.data().host === user.name) lobbyRef.delete(); // Host cierra sala
                     else {
                         // Cliente sale
                         const players = doc.data().players.filter(p => p.name !== user.name);
                         lobbyRef.update({ players: players });
                     }
                 }
             });
        }
        currentLobbyId = null;
        isMultiplayer = false;
    }
};

// === SISTEMA DE AMIGOS (FIX ACEPTAR/RECHAZAR) ===

window.sendFriendRequest = function() {
    const target = document.getElementById('friend-inp').value.trim();
    if(!target || target === user.name) return notify("Nombre inválido", "error");

    db.collection("users").doc(target).get().then(doc => {
        if(doc.exists) {
            const data = doc.data();
            if(data.friends?.includes(user.name)) return notify("Ya son amigos", "info");
            if(data.requests?.includes(user.name)) return notify("Solicitud ya enviada", "info");

            db.collection("users").doc(target).update({
                requests: firebase.firestore.FieldValue.arrayUnion(user.name)
            }).then(() => {
                notify(`Solicitud enviada a ${target}`, "success");
                document.getElementById('friend-inp').value = "";
            });
        } else notify("Usuario no encontrado", "error");
    });
};

window.respondFriend = function(targetName, accept) {
    if(!user.name || user.name === "Guest") return notify("Error sesión", "error");

    const batch = db.batch();
    const myRef = db.collection("users").doc(user.name);
    const targetRef = db.collection("users").doc(targetName);

    // 1. Quitar solicitud siempre
    batch.update(myRef, { requests: firebase.firestore.FieldValue.arrayRemove(targetName) });

    if(accept) {
        // 2. Agregar a amigos (bidireccional)
        batch.update(myRef, { friends: firebase.firestore.FieldValue.arrayUnion(targetName) });
        batch.update(targetRef, { friends: firebase.firestore.FieldValue.arrayUnion(user.name) });
        if(typeof notify === 'function') notify(`¡${targetName} agregado!`, "success");
    } else {
        if(typeof notify === 'function') notify("Solicitud rechazada", "info");
    }

    batch.commit().catch(e => console.error("Friend Error:", e));
};

// === ENVIAR PUNTUACIÓN EN VIVO ===
window.sendLobbyScore = function(score) {
    if(!currentLobbyId || !user.name) return;
    // Throttling para no saturar Firebase (max 1 vez por seg)
    const now = Date.now();
    if(!window.lastScoreUpdate || now - window.lastScoreUpdate > 1000) {
        window.lastScoreUpdate = now;
        const lobbyRef = db.collection("lobbies").doc(currentLobbyId);
        // Transacción ligera o update directo
        // Nota: En prod usar Realtime DB, aquí updateamos todo el array (costoso pero funcional para demo)
        lobbyRef.get().then(doc => {
            if(doc.exists) {
                const players = doc.data().players;
                const idx = players.findIndex(p => p.name === user.name);
                if(idx !== -1) {
                    players[idx].score = score;
                    lobbyRef.update({ players: players });
                }
            }
        });
    }
};
