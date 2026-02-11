/* === ONLINE SYSTEM (V20 STABLE - FIXED SINTAX) === */

let currentLobbyId = null;
let lobbyListener = null;

function initOnline() {
    if(typeof Peer === 'undefined') return;
    peer = new Peer(null, { secure: true }); 
    peer.on('open', (id) => {
        if(db && user.name !== "Guest") {
            db.collection("users").doc(user.name).set({ peerId: id, online: true }, { merge: true });
        }
    });

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
    if (!db || user.name === "Guest") return Promise.reject("Inicia sesión");

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

        // Actualizar UI de Configuración
        const keyDisp = document.getElementById('lobby-display-keys');
        const denDisp = document.getElementById('lobby-display-den');
        if (keyDisp && data.config) keyDisp.innerText = data.config.keys[0] + "K";
        if (denDisp && data.config) denDisp.innerText = data.config.density;

        // Si el juego empieza
        if (data.status === 'playing' && !isMultiplayer) {
            isMultiplayer = true;
            cfg.den = data.config.density;
            closeModal('host');
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
