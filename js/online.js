/* === ONLINE SYSTEM (STABLE V21 - READY SYSTEM) === */
let currentLobbyId = null;
let lobbyListener = null;

function initOnline() {
    if(typeof Peer === 'undefined') return;
    peer = new Peer(null, { secure: true }); 
    peer.on('open', (id) => {
        if(db && user.name !== "Guest") db.collection("users").doc(user.name).set({ peerId: id, online: true }, { merge: true });
    });
}

// CREAR SALA: El Host entra como 'ready'
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

// UNIRSE A SALA: Los clientes entran como 'not-ready'
window.joinLobbyData = function(lobbyId) {
    const lobbyRef = db.collection("lobbies").doc(lobbyId);
    db.runTransaction(async (t) => {
        const doc = await t.get(lobbyRef);
        if(!doc.exists) throw "Sala no encontrada";
        if(doc.data().players.length >= 8) throw "Sala llena";
        t.update(lobbyRef, {
            players: firebase.firestore.FieldValue.arrayUnion({
                name: user.name, avatar: user.avatarData||'', status: 'not-ready', score: 0
            })
        });
        return doc.data();
    }).then(data => {
        currentLobbyId = lobbyId;
        db.collection("globalSongs").doc(data.songId).get().then(s => {
            curSongData = { id: s.id, ...s.data() };
            openHostPanel(curSongData, true); // true = modo cliente
        });
        subscribeToLobby(lobbyId);
    }).catch(e => notify(e, "error"));
};

// SISTEMA DE READY
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

function subscribeToLobby(lobbyId) {
    if (lobbyListener) lobbyListener();
    lobbyListener = db.collection("lobbies").doc(lobbyId).onSnapshot(doc => {
        if (!doc.exists) { leaveLobbyData(); closeModal('host'); return; }
        const data = doc.data();
        
        // Sincronizar configuraciones para todos
        if (data.config) {
            setText('hp-mode-disp', data.config.keys[0] + "K");
            setText('hp-den-disp', data.config.density);
            cfg.den = data.config.density;
        }

        if (data.status === 'playing' && !isMultiplayer) {
            isMultiplayer = true; closeModal('host');
            prepareAndPlaySong(data.config.keys[0]);
        }
        
        if (data.status === 'waiting') updateHostPanelUI(data.players, data.host);
    });
}

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
    currentLobbyId = null; isMultiplayer = false;
};
