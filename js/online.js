/* === ONLINE SYSTEM (READY SYSTEM FIXED) === */

let currentLobbyId = null;
let lobbyListener = null;
let multiScores = [];

function initOnline() {
    if(typeof Peer === 'undefined') return;
    peer = new Peer(null, { secure: true }); 
    peer.on('open', (id) => {
        if(db && typeof user !== 'undefined' && user.name !== "Guest") {
            db.collection("users").doc(user.name).set({ peerId: id, online: true }, { merge: true });
        }
    });
    // Listener de invitaciones
    if(user.name !== "Guest") {
        db.collection("users").doc(user.name).collection("notifications")
            .orderBy("timestamp", "desc").limit(5)
            .onSnapshot(snap => {
                snap.docChanges().forEach(change => {
                    if (change.type === "added") {
                        const n = change.doc.data();
                        if (Date.now() - n.timestamp.toMillis() < 10000) {
                            if(n.type === 'challenge' && typeof notifyChallenge === 'function') notifyChallenge(n.from, n.lobbyId, n.songName);
                            else notify(n.body, "info");
                            change.doc.ref.delete(); 
                        }
                    }
                });
            });
    }
}

// === GESTIÓN DE SALAS ===

window.createLobbyData = function(songId, config) {
    if (!db || !user.name || user.name === "Guest") return Promise.reject("Debes iniciar sesión");

    // El Host entra automáticamente como 'ready' (listo)
    const lobbyData = {
        host: user.name,
        songId: songId,
        songTitle: curSongData.title,
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
            // LOS QUE SE UNEN ENTRAN COMO 'not-ready'
            t.update(lobbyRef, {
                players: firebase.firestore.FieldValue.arrayUnion({
                    name: user.name, avatar: user.avatarData||'', status: 'not-ready', score: 0
                })
            });
        }
    }).then(() => {
        currentLobbyId = lobbyId;
        // Obtener datos de canción
        lobbyRef.get().then(doc => {
            const d = doc.data();
            db.collection("globalSongs").doc(d.songId).get().then(sDoc => {
                curSongData = { id: sDoc.id, ...sDoc.data() };
                openHostPanel(curSongData, true); // true = cliente
            });
        });
        subscribeToLobby(lobbyId);
    }).catch(e => notify(e, "error"));
};

// === NUEVO: FUNCION TOGGLE READY ===
window.toggleReadyData = function() {
    if(!currentLobbyId || !user.name) return;
    const lobbyRef = db.collection("lobbies").doc(currentLobbyId);
    
    lobbyRef.get().then(doc => {
        if(doc.exists) {
            let players = doc.data().players;
            // Buscar al usuario y cambiar su estado
            players = players.map(p => {
                if(p.name === user.name) {
                    p.status = (p.status === 'ready') ? 'not-ready' : 'ready';
                }
                return p;
            });
            lobbyRef.update({ players: players });
        }
    });
};

function subscribeToLobby(lobbyId) {
    if (lobbyListener) lobbyListener();
    lobbyListener = db.collection("lobbies").doc(lobbyId).onSnapshot(doc => {
        if (!doc.exists) {
            leaveLobbyData();
            closeModal('host');
            return notify("La sala ha sido cerrada", "info");
        }
        const data = doc.data();
        
        // Actualizar UI del panel de host si estamos esperando
        if (data.status === 'waiting' && typeof updateHostPanelUI === 'function') {
            updateHostPanelUI(data.players, data.host);
        }

        // Iniciar juego
        if (data.status === 'playing') {
            if (!isMultiplayer) {
                isMultiplayer = true;
                cfg.den = data.config.density;
                if(typeof st !== 'undefined') st.ranked = data.config.ranked;
                closeModal('host');
                if(typeof startGame === 'function') startGame(data.config.keys[0]);
                else if(typeof prepareAndPlaySong === 'function') prepareAndPlaySong(data.config.keys[0]);
                notify("¡PARTIDA INICIADA!", "success");
            }
            if(typeof updateMultiLeaderboardUI === 'function') updateMultiLeaderboardUI(data.players);
        }
    });
}

window.startLobbyMatchData = function() {
    if(!currentLobbyId) return;
    db.collection("lobbies").doc(currentLobbyId).update({ status: 'playing' });
};

window.leaveLobbyData = function() {
    if (currentLobbyId && user.name) {
         if (lobbyListener) lobbyListener();
         const lobbyRef = db.collection("lobbies").doc(currentLobbyId);
         lobbyRef.get().then(doc => {
             if(doc.exists) {
                 if(doc.data().host === user.name) lobbyRef.delete(); 
                 else {
                     const players = doc.data().players.filter(p => p.name !== user.name);
                     lobbyRef.update({ players: players });
                 }
             }
         });
         currentLobbyId = null;
         isMultiplayer = false;
    }
};

window.sendLobbyScore = function(score) {
    if(!currentLobbyId || !user.name) return;
    const now = Date.now();
    if(!window.lastScoreUpdate || now - window.lastScoreUpdate > 1000) {
        window.lastScoreUpdate = now;
        db.collection("lobbies").doc(currentLobbyId).get().then(doc => {
            if(doc.exists) {
                const players = doc.data().players;
                const idx = players.findIndex(p => p.name === user.name);
                if(idx !== -1) { players[idx].score = score; db.collection("lobbies").doc(currentLobbyId).update({players:players}); }
            }
        });
    }
};
