/* === ONLINE SYSTEM (V20 STABLE - FIXED SINTAX) === */
let currentLobbyId = null;
let lobbyListener = null;

function initOnline() {
    if(typeof Peer === 'undefined') return;
    peer = new Peer(null, { secure: true }); 
    peer.on('open', (id) => {
        if(db && typeof user !== 'undefined' && user.name !== "Guest") {
            db.collection("users").doc(user.name).set({ 
                peerId: id, online: true, 
                lastSeen: firebase.firestore.FieldValue.serverTimestamp() 
            }, { merge: true });
        }
    });
    
    // Listener de desafíos
    if(user.name !== "Guest") {
        db.collection("users").doc(user.name).collection("notifications")
            .orderBy("timestamp", "desc").limit(5)
            .onSnapshot(snap => {
                snap.docChanges().forEach(change => {
                    if (change.type === "added") {
                        const n = change.doc.data();
                        if (n.type === 'challenge') window.notifyChallenge(n.from, n.lobbyId, n.songName);
                        change.doc.ref.delete(); 
                    }
                });
            });
    }
}

window.createLobbyData = function(songId, config) {
    if (!db || !user.name || user.name === "Guest") return Promise.reject("Debes iniciar sesión");
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

function subscribeToLobby(lobbyId) {
    if (lobbyListener) lobbyListener();
    lobbyListener = db.collection("lobbies").doc(lobbyId).onSnapshot(doc => {
        if (!doc.exists) {
            window.leaveLobbyData();
            closeModal('host');
            return;
        }
        const data = doc.data();
        
        // Sincronizar UI de configuración (Lo que el host cambia, los demás lo ven)
        if (data.config) {
            const keyDisp = document.getElementById('lobby-display-keys');
            const denDisp = document.getElementById('lobby-display-den');
            if (keyDisp) keyDisp.innerText = data.config.keys[0] + "K";
            if (denDisp) denDisp.innerText = data.config.density;
            cfg.den = data.config.density; // Actualizar dificultad local
        }

        // Si el host le da a COMENZAR
        if (data.status === 'playing' && !isMultiplayer) {
            isMultiplayer = true;
            closeModal('host');
            // Usamos prepare directamente para evitar el modal de dificultad
            prepareAndPlaySong(data.config.keys[0]);
        }
        
        if (data.status === 'waiting') {
            window.updateHostPanelUI(data.players, data.host);
        }
    });
}

window.toggleReadyData = function() {
    if(!currentLobbyId) return;
    const ref = db.collection("lobbies").doc(currentLobbyId);
    ref.get().then(doc => {
        let p = doc.data().players;
        p = p.map(x => {
            if(x.name === user.name) x.status = (x.status === 'ready' ? 'not-ready' : 'ready');
            return x;
        });
        ref.update({ players: p });
    });
};

window.joinLobbyData = function(lobbyId) {
    if(!user.name || user.name === "Guest") return;
    const lobbyRef = db.collection("lobbies").doc(lobbyId);
    db.runTransaction(async (t) => {
        const doc = await t.get(lobbyRef);
        if(!doc.exists) throw "Sala no encontrada";
        const data = doc.data();
        if(data.players.length >= 8) throw "Sala llena";
        const exists = data.players.find(p => p.name === user.name);
        if(!exists) {
            t.update(lobbyRef, {
                players: firebase.firestore.FieldValue.arrayUnion({
                    name: user.name, avatar: user.avatarData||'', status: 'not-ready', score: 0
                })
            });
        }
    }).then(() => {
        currentLobbyId = lobbyId;
        lobbyRef.get().then(doc => {
            const d = doc.data();
            db.collection("globalSongs").doc(d.songId).get().then(sDoc => {
                curSongData = { id: sDoc.id, ...sDoc.data() };
                openHostPanel(curSongData, true); // modo cliente
            });
        });
        subscribeToLobby(lobbyId);
    }).catch(e => notify(e, "error"));
};

window.startLobbyMatchData = function() {
    if(currentLobbyId) db.collection("lobbies").doc(currentLobbyId).update({ status: 'playing' });
};

window.leaveLobbyData = function() {
    if (!currentLobbyId) return;
    const ref = db.collection("lobbies").doc(currentLobbyId);
    ref.get().then(doc => {
        if(doc.exists && doc.data().host === user.name) ref.delete();
        else if(doc.exists) {
            const p = doc.data().players.filter(x => x.name !== user.name);
            ref.update({ players: p });
        }
    });
    currentLobbyId = null;
    isMultiplayer = false;
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
