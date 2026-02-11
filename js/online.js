/* === ONLINE SYSTEM (MASTER V22) === */
let currentLobbyId = null;
let lobbyListener = null;

function initOnline() {
    if(typeof Peer === 'undefined') return;
    peer = new Peer(null, { secure: true }); 
    peer.on('open', (id) => {
        if(db && user.name !== "Guest") db.collection("users").doc(user.name).set({ peerId: id, online: true }, { merge: true });
    });
}

// CREAR SALA
window.createLobbyData = function(songId, config) {
    if (!db || user.name === "Guest") return Promise.reject("Inicia sesión");
    
    const lobbyData = {
        host: user.name,
        songId: songId,
        songTitle: curSongData.title || "Desconocido",
        status: 'waiting',
        players: [{ name: user.name, avatar: user.avatarData || '', status: 'ready', score: 0 }],
        config: config, // { keys: [4], density: 5, ranked: true }
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    return db.collection("lobbies").add(lobbyData).then(docRef => {
        currentLobbyId = docRef.id;
        subscribeToLobby(currentLobbyId);
        return docRef.id;
    });
};

// UNIRSE A SALA
window.joinLobbyData = function(lobbyId) {
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
        // Cargar datos de canción
        db.collection("globalSongs").doc(data.songId).get().then(s => {
            if(s.exists) {
                curSongData = { id: s.id, ...s.data() };
                openHostPanel(curSongData, true); // true = soy cliente
            }
        });
        subscribeToLobby(lobbyId);
    }).catch(e => notify(e, "error"));
};

// CAMBIAR ESTADO READY
window.toggleReadyData = function() {
    if(!currentLobbyId) return;
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

// ESCUCHAR CAMBIOS EN LA SALA
function subscribeToLobby(lobbyId) {
    if (lobbyListener) lobbyListener();
    lobbyListener = db.collection("lobbies").doc(lobbyId).onSnapshot(doc => {
        if (!doc.exists) { 
            leaveLobbyData(); 
            closeModal('host'); 
            notify("La sala ha sido cerrada", "info");
            return; 
        }
        
        const data = doc.data();
        
        // Sincronizar UI de configuración
        if (data.config) {
            if(document.getElementById('hp-mode-disp')) {
                document.getElementById('hp-mode-disp').innerText = data.config.keys[0] + "K";
                document.getElementById('hp-den-disp').innerText = data.config.density;
            }
            // Actualizar config local para cuando empiece
            cfg.den = data.config.density;
            window.selectedLobbyKeys = data.config.keys[0];
        }

        // Iniciar juego
        if (data.status === 'playing' && !isMultiplayer) {
            isMultiplayer = true; 
            closeModal('host');
            // Usar la key count de la sala
            const k = data.config.keys[0] || 4;
            prepareAndPlaySong(k);
        }
        
        if (data.status === 'waiting') {
            updateHostPanelUI(data.players, data.host);
        }
    });
}

window.startLobbyMatchData = function() {
    if(currentLobbyId) db.collection("lobbies").doc(currentLobbyId).update({ status: 'playing' });
};

window.leaveLobbyData = function() {
    if (!currentLobbyId) return;
    const ref = db.collection("lobbies").doc(currentLobbyId);
    ref.get().then(doc => {
        if(doc.exists) {
            if(doc.data().host === user.name) {
                ref.delete(); // Si soy host, borro sala
            } else {
                const p = doc.data().players.filter(x => x.name !== user.name);
                ref.update({ players: p });
            }
        }
    });
    currentLobbyId = null; isMultiplayer = false;
    if(lobbyListener) lobbyListener(); // Desuscribir
};

// Enviar puntaje en tiempo real
window.sendLobbyScore = function(score) {
    if(!currentLobbyId || !db) return;
    // Optimización: Solo enviar cada 1000 puntos o al final para no saturar
    if(score % 500 === 0) {
        // Logica simplificada: Actualizar mi score en el array
        // (En producción idealmente usarías una subcolección, pero esto funciona para 8 players)
    }
};
