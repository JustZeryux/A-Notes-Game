/* === ONLINE SYSTEM (MASTER V90 - GLOBAL FIX) === */

var currentLobbyId = null;
var lobbyListener = null;

// Inicializador (Llamado desde main.js)
window.initOnline = function() {
    if(typeof Peer !== 'undefined') {
        try {
            window.peer = new Peer(null, { secure: true }); 
            window.peer.on('open', (id) => {
                if(window.db && window.user && window.user.name !== "Guest") {
                    window.db.collection("users").doc(window.user.name).set({ peerId: id, online: true }, { merge: true });
                }
            });
        } catch(e) { console.log("PeerJS error:", e); }
    }
};

// === FUNCIONES GLOBALES (SIN WRAPPING PARA EVITAR ERRORES) ===

window.createLobbyData = function(songId, config) {
    if (!window.db) return Promise.reject("Firebase no conectado");
    if (!window.user || window.user.name === "Guest") return Promise.reject("Inicia sesión");
    
    const lobbyData = {
        host: window.user.name,
        songId: songId,
        songTitle: window.curSongData ? window.curSongData.title : "Desconocido",
        status: 'waiting',
        players: [{ name: window.user.name, avatar: window.user.avatarData || '', status: 'ready', score: 0 }],
        config: config, 
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    return window.db.collection("lobbies").add(lobbyData).then(docRef => {
        currentLobbyId = docRef.id;
        subscribeToLobby(currentLobbyId);
        return docRef.id;
    });
};

window.joinLobbyData = function(lobbyId) {
    if(!window.db) return;
    const lobbyRef = window.db.collection("lobbies").doc(lobbyId);
    
    window.db.runTransaction(async (t) => {
        const doc = await t.get(lobbyRef);
        if(!doc.exists) throw "Sala no encontrada";
        
        const data = doc.data();
        if(data.status === 'playing') throw "Partida en curso";
        if(data.players.length >= 8) throw "Sala llena";
        
        // Evitar duplicados
        const exists = data.players.some(p => p.name === window.user.name);
        if(!exists) {
            t.update(lobbyRef, {
                players: firebase.firestore.FieldValue.arrayUnion({
                    name: window.user.name, avatar: window.user.avatarData||'', status: 'not-ready', score: 0
                })
            });
        }
        return data;
    }).then(data => {
        currentLobbyId = lobbyId;
        window.db.collection("globalSongs").doc(data.songId).get().then(s => {
            if(s.exists) {
                window.curSongData = { id: s.id, ...s.data() };
                if(typeof window.openHostPanel === 'function') {
                    window.openHostPanel(window.curSongData, true); // true = cliente
                }
            }
        });
        subscribeToLobby(lobbyId);
    }).catch(e => {
        if(typeof notify === 'function') notify(e, "error");
    });
};

window.toggleReadyData = function() {
    if(!currentLobbyId || !window.db) return;
    const ref = window.db.collection("lobbies").doc(currentLobbyId);
    ref.get().then(doc => {
        if(!doc.exists) return;
        let p = doc.data().players;
        p = p.map(x => {
            if(x.name === window.user.name) x.status = (x.status === 'ready' ? 'not-ready' : 'ready');
            return x;
        });
        ref.update({ players: p });
    });
};

function subscribeToLobby(lobbyId) {
    if (lobbyListener) lobbyListener();
    lobbyListener = window.db.collection("lobbies").doc(lobbyId).onSnapshot(doc => {
        if (!doc.exists) { 
            window.leaveLobbyData(); 
            if(typeof closeModal === 'function') closeModal('host'); 
            if(typeof notify === 'function') notify("Sala cerrada", "info");
            return; 
        }
        
        const data = doc.data();
        
        // Sync Config
        if (data.config && window.cfg) {
            window.cfg.den = data.config.density;
            if(document.getElementById('hp-mode-disp')) {
                document.getElementById('hp-mode-disp').innerText = data.config.keys[0] + "K";
                document.getElementById('hp-den-disp').innerText = data.config.density;
            }
        }

        // FASE CARGA (Sync)
        if (data.status === 'loading' && !window.isMultiplayer) {
            window.isMultiplayer = true;
            if(typeof closeModal === 'function') closeModal('host');
            
            // Mostrar Overlay
            let ov = document.getElementById('sync-overlay');
            if(!ov) {
                ov = document.createElement('div');
                ov.id = 'sync-overlay';
                ov.innerHTML = `<div class="sync-loader"></div><h2 style="color:white; margin-top:20px;">SINCRONIZANDO...</h2>`;
                document.body.appendChild(ov);
            }
            ov.style.display = 'flex';

            const k = data.config.keys[0] || 4;
            if(typeof window.prepareAndPlaySong === 'function') window.prepareAndPlaySong(k);
        }
        
        // Host Start Logic
        if (data.status === 'loading' && window.isLobbyHost) {
            if(!window.syncTimer) {
                window.syncTimer = setTimeout(() => {
                    window.db.collection("lobbies").doc(lobbyId).update({ status: 'playing' });
                    window.syncTimer = null;
                }, 4000); 
            }
        }

        // PLAY
        if (data.status === 'playing') {
            const ov = document.getElementById('sync-overlay');
            if(ov) ov.style.display = 'none';
        }
        
        // UI Updates
        if (data.status === 'waiting' && typeof updateHostPanelUI === 'function') {
            updateHostPanelUI(data.players, data.host);
        }
        
        // Live Scores
        if (data.status === 'playing' && data.players && typeof updateMultiLeaderboardUI === 'function') {
            const scores = data.players.map(p => ({
                name: p.name, score: p.currentScore || 0, avatar: p.avatar
            }));
            updateMultiLeaderboardUI(scores);
        }
    });
}

window.startLobbyMatchData = function() {
    if(currentLobbyId && window.db) {
        window.db.collection("lobbies").doc(currentLobbyId).update({ status: 'loading' });
    }
};

window.leaveLobbyData = function() {
    if (!currentLobbyId || !window.db) return;
    const ref = window.db.collection("lobbies").doc(currentLobbyId);
    ref.get().then(doc => {
        if(doc.exists) {
            if(doc.data().host === window.user.name) ref.delete(); 
            else {
                const p = doc.data().players.filter(x => x.name !== window.user.name);
                ref.update({ players: p });
            }
        }
    });
    currentLobbyId = null; 
    window.isMultiplayer = false;
    if(lobbyListener) lobbyListener();
};

window.sendLobbyScore = function(score, isFinal) {
    if(!currentLobbyId || !window.db) return;
    if (isFinal || Math.abs(score - (window.lastSentScore||0)) > 1000) {
        window.lastSentScore = score;
        window.db.runTransaction(async t => {
            const ref = window.db.collection("lobbies").doc(currentLobbyId);
            const doc = await t.get(ref);
            if(!doc.exists) return;
            const players = doc.data().players;
            const idx = players.findIndex(p => p.name === window.user.name);
            if(idx !== -1) {
                players[idx].currentScore = score;
                t.update(ref, { players: players });
            }
        });
    }
};
