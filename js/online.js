/* === ONLINE SYSTEM (MASTER V23 - WINDOW BINDING) === */
var currentLobbyId = null;
var lobbyListener = null;

window.initOnline = function() {
    if(typeof Peer === 'undefined') return;
    try {
        peer = new Peer(null, { secure: true }); 
        peer.on('open', (id) => {
            if(db && user.name !== "Guest") db.collection("users").doc(user.name).set({ peerId: id, online: true }, { merge: true });
        });
    } catch(e) { console.log("PeerJS error:", e); }
};

// CREAR SALA (Asignado a window para arreglar error de referencia)
window.createLobbyData = function(songId, config) {
    if (!db) return Promise.reject("Error DB: Firebase no inició");
    if (user.name === "Guest") return Promise.reject("Debes iniciar sesión");
    
    const lobbyData = {
        host: user.name,
        songId: songId,
        songTitle: curSongData ? curSongData.title : "Desconocido",
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
    if(!db) return;
    const lobbyRef = db.collection("lobbies").doc(lobbyId);
    
    return db.runTransaction(async (t) => {
        const doc = await t.get(lobbyRef);
        if(!doc.exists) throw "Sala no encontrada";
        
        const data = doc.data();
        if(data.status === 'playing') throw "Partida en curso";
        if(data.players.length >= 8) throw "Sala llena";
        
        const existing = data.players.find(p => p.name === user.name);
        if(!existing) {
            t.update(lobbyRef, {
                players: firebase.firestore.FieldValue.arrayUnion({
                    name: user.name, avatar: user.avatarData||'', status: 'not-ready', score: 0
                })
            });
        }
        return data;
    }).then(data => {
        currentLobbyId = lobbyId;
        db.collection("globalSongs").doc(data.songId).get().then(s => {
            if(s.exists) {
                curSongData = { id: s.id, ...s.data() };
                // Aseguramos que openHostPanel exista antes de llamar
                if(typeof window.openHostPanel === 'function') {
                    window.openHostPanel(curSongData, true); 
                }
            }
        });
        subscribeToLobby(lobbyId);
    }).catch(e => {
        if(typeof notify === 'function') notify(e, "error");
        else console.error(e);
    });
};

window.toggleReadyData = function() {
    if(!currentLobbyId || !db) return;
    const ref = db.collection("lobbies").doc(currentLobbyId);
    ref.get().then(doc => {
        if(!doc.exists) return;
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
        if (!doc.exists) { 
            window.leaveLobbyData(); 
            if(typeof closeModal === 'function') closeModal('host'); 
            if(typeof notify === 'function') notify("La sala ha sido cerrada", "info");
            return; 
        }
        
        const data = doc.data();
        
        // Sync configs
        if (data.config) {
            if(document.getElementById('hp-mode-disp')) {
                document.getElementById('hp-mode-disp').innerText = data.config.keys[0] + "K";
                document.getElementById('hp-den-disp').innerText = data.config.density;
            }
            if(window.cfg) {
                window.cfg.den = data.config.density;
                window.selectedLobbyKeys = data.config.keys[0];
            }
        }

        if (data.status === 'playing' && !isMultiplayer) {
            isMultiplayer = true; 
            if(typeof closeModal === 'function') closeModal('host');
            const k = data.config.keys[0] || 4;
            if(typeof prepareAndPlaySong === 'function') prepareAndPlaySong(k);
        }
        
        if (data.status === 'waiting' && typeof updateHostPanelUI === 'function') {
            updateHostPanelUI(data.players, data.host);
        }
    });
}

window.startLobbyMatchData = function() {
    if(currentLobbyId && db) db.collection("lobbies").doc(currentLobbyId).update({ status: 'playing' });
};

window.leaveLobbyData = function() {
    if (!currentLobbyId || !db) return;
    const ref = db.collection("lobbies").doc(currentLobbyId);
    ref.get().then(doc => {
        if(doc.exists) {
            if(doc.data().host === user.name) ref.delete(); 
            else {
                const p = doc.data().players.filter(x => x.name !== user.name);
                ref.update({ players: p });
            }
        }
    });
    currentLobbyId = null; isMultiplayer = false;
    if(lobbyListener) lobbyListener();
};

window.sendLobbyScore = function(score) {
    // Implementación futura
};
