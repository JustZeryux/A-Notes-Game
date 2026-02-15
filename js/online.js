/* === ONLINE SYSTEM (SYNCED & WORKING) === */

var currentLobbyId = null;
var lobbyListener = null;
window.isMultiplayerReady = false; 
window.hasGameStarted = false;

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

// Se llama cuando game.js termina de generar el mapa
window.notifyLobbyLoaded = function() {
    console.log(">> SYSTEM: Mapa generado. Listo para sync.");
    window.isMultiplayerReady = true;
    
    const txt = document.getElementById('loading-text');
    if(txt) txt.innerText = "ESPERANDO SINCRONIZACIÓN...";

    // Si soy Host, doy la orden final tras 3 segundos
    if(window.isLobbyHost && currentLobbyId) {
        setTimeout(() => {
            if(window.db) window.db.collection("lobbies").doc(currentLobbyId).update({ status: 'playing' });
        }, 3000); 
    }
    
    // Si soy Cliente y llegué tarde (la sala ya estaba en playing)
    if(window.lobbyStatusCache === 'playing' && !window.hasGameStarted) {
        startMultiplayerGameNow();
    }
};

function startMultiplayerGameNow() {
    // BLOQUEO: Si no he generado el mapa, NO inicio
    if(!window.isMultiplayerReady) return; 
    if(window.hasGameStarted) return;

    const s = window.ramSongs ? window.ramSongs.find(x => x.id === window.curSongData.id) : null;
    if(s) {
        console.log(">> GO! Arrancando motor.");
        window.hasGameStarted = true;
        window.playSongInternal(s);
    }
}

// ... createLobbyData y joinLobbyData IGUAL QUE ANTES ...
window.createLobbyData = function(songId, config, isPrivate = false) {
    if (!window.db) return Promise.reject("DB no conectada");
    const lobbyData = {
        host: window.user.name, songId: songId, songTitle: window.curSongData ? window.curSongData.title : "Desconocido",
        status: 'waiting', players: [{ name: window.user.name, avatar: window.user.avatarData || '', status: 'ready', score: 0 }],
        config: config, isPrivate: isPrivate, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    return window.db.collection("lobbies").add(lobbyData).then(docRef => {
        currentLobbyId = docRef.id; window.isLobbyHost = true; subscribeToLobby(currentLobbyId); return docRef.id;
    });
};

window.joinLobbyData = function(lobbyId) {
    if(lobbyListener) lobbyListener();
    if(!window.db) return;
    const lobbyRef = window.db.collection("lobbies").doc(lobbyId);
    window.db.runTransaction(async (t) => {
        const doc = await t.get(lobbyRef);
        if(!doc.exists) throw "Sala no encontrada";
        const data = doc.data();
        if(data.status === 'playing') throw "Partida en curso";
        if(data.players.length >= 8) throw "Sala llena";
        const exists = data.players.some(p => p.name === window.user.name);
        if(!exists) {
            t.update(lobbyRef, { players: firebase.firestore.FieldValue.arrayUnion({ name: window.user.name, avatar: window.user.avatarData||'', status: 'not-ready', score: 0 }) });
        }
        return data;
    }).then(data => {
        currentLobbyId = lobbyId; window.isLobbyHost = false;
        window.db.collection("globalSongs").doc(data.songId).get().then(s => {
            if(s.exists) {
                window.curSongData = { id: s.id, ...s.data() };
                window.openHostPanel(window.curSongData, true); // Abrir como Cliente
            }
        });
        subscribeToLobby(lobbyId);
    }).catch(e => { if(typeof notify === 'function') notify(e, "error"); });
};

window.toggleReadyData = function() {
    if(!currentLobbyId || !window.db) return;
    
    const ref = window.db.collection("lobbies").doc(currentLobbyId);
    
    // Usamos transacción para no sobrescribir datos de otros
    window.db.runTransaction(async (t) => {
        const doc = await t.get(ref);
        if(!doc.exists) return;
        
        let players = doc.data().players;
        const myIndex = players.findIndex(p => p.name === window.user.name);
        
        if(myIndex !== -1) {
            const currentStatus = players[myIndex].status;
            // Alternar estado
            players[myIndex].status = (currentStatus === 'ready' ? 'not-ready' : 'ready');
            
            t.update(ref, { players: players });
        }
    }).catch(e => console.error("Error toggle ready:", e));
};
function subscribeToLobby(lobbyId) {
    if (lobbyListener) lobbyListener();
    lobbyListener = window.db.collection("lobbies").doc(lobbyId).onSnapshot(doc => {
        if (!doc.exists) { window.leaveLobbyData(); if(typeof closeModal==='function') closeModal('host'); notify("Sala cerrada", "info"); return; }
        
        const data = doc.data();
        window.lobbyStatusCache = data.status;
        if (data.config && window.cfg) window.cfg.den = data.config.density;

        if (data.status === 'loading') {
            if(window.isMultiplayerReady || window.hasGameStarted) return;
            window.isMultiplayer = true; window.isMultiplayerReady = false; window.hasGameStarted = false;
            
            // Cerrar panel host
            if(typeof closeModal === 'function') closeModal('host');
            
            const loader = document.getElementById('loading-overlay');
            if(loader) { loader.style.display = 'flex'; document.getElementById('loading-text').innerText = "DESCARGANDO..."; }
            
            // Iniciar carga del mapa
            const k = (data.config && data.config.keys) ? data.config.keys[0] : 4;
            if(typeof window.prepareAndPlaySong === 'function') window.prepareAndPlaySong(k);
        }
        
        if (data.status === 'playing') {
            const loader = document.getElementById('loading-overlay');
            if(loader && window.hasGameStarted) loader.style.display = 'none';
            // Intentar iniciar si estoy listo
            startMultiplayerGameNow();
        }
        
        // ACTUALIZAR UI DEL PANEL
        if (data.status === 'waiting' && typeof updateHostPanelUI === 'function') {
            updateHostPanelUI(data.players, data.host);
        }
        
        if (data.status === 'playing' && data.players) {
            const sorted = [...data.players].sort((a, b) => (b.currentScore || 0) - (a.currentScore || 0));
            if(typeof updateMultiLeaderboardUI === 'function') updateMultiLeaderboardUI(sorted);
        }

        if (data.status === 'finished') {
            if(window.st.act) {
                window.st.act = false;
                if(window.st.src) { try{window.st.src.stop();}catch(e){} window.st.src = null; }
                document.getElementById('game-layer').style.display = 'none';
            }
            if(typeof showMultiplayerResults === 'function') showMultiplayerResults(data.players);
            window.hasGameStarted = false;
        }
    });
}

window.startLobbyMatchData = function() {
    if(currentLobbyId && window.db) window.db.collection("lobbies").doc(currentLobbyId).update({ status: 'loading' });
};

window.leaveLobbyData = function() {
    if (!currentLobbyId || !window.db) return;
    const ref = window.db.collection("lobbies").doc(currentLobbyId);
    if(lobbyListener) { lobbyListener(); lobbyListener = null; }
    ref.get().then(doc => {
        if(doc.exists) {
            if(doc.data().host === window.user.name) ref.delete(); 
            else {
                const p = doc.data().players.filter(x => x.name !== window.user.name);
                ref.update({ players: p });
            }
        }
    });
    currentLobbyId = null; window.isMultiplayer = false; window.isLobbyHost = false; window.hasGameStarted = false;
};

// ... Funciones de score y leaderboard iguales ...
window.sendLobbyScore = function(score, isFinal) {
    if(!currentLobbyId || !window.db) return;
    const ref = window.db.collection("lobbies").doc(currentLobbyId);
    window.db.runTransaction(async (t) => {
        const doc = await t.get(ref);
        if(!doc.exists) return;
        const players = doc.data().players;
        const idx = players.findIndex(p => p.name === window.user.name);
        if(idx !== -1) {
            players[idx].currentScore = score;
            t.update(ref, { players: players });
        }
    });
};

window.updateMultiLeaderboardUI = function(players) {
    const hud = document.getElementById('vs-hud');
    const container = document.getElementById('multi-players-container');
    if(!hud || !container) return;
    hud.style.display = 'flex'; container.innerHTML = '';
    players.forEach((p, index) => {
        const isMe = p.name === window.user.name;
        const row = document.createElement('div');
        row.className = `ml-row ${isMe ? 'is-me' : ''}`;
        row.setAttribute('data-rank', index + 1);
        row.innerHTML = `<div class=\"ml-pos\">#${index + 1}</div><div class=\"ml-av\" style=\"background-image:url(${p.avatar || ''})\"></div><div class=\"ml-info\"><div class=\"ml-name\">${p.name}</div><div class=\"ml-score\">${(p.currentScore||0).toLocaleString()}</div></div>`;
        container.appendChild(row);
    });
};
window.showMultiplayerResults = function(playersData) {
    const modal = document.getElementById('modal-res');
    if(!modal) return;
    playersData.sort((a, b) => (b.currentScore || 0) - (a.currentScore || 0));
    const winner = playersData[0];
    const amIWinner = winner.name === window.user.name;
    modal.style.display = 'flex';
    const panel = modal.querySelector('.modal-panel');
    let listHTML = '<div class=\"rank-table-wrapper\" style=\"margin-top:20px; max-height:300px; overflow-y:auto; background:#111; padding:10px; border-radius:8px;\"><table class=\"rank-table\" style=\"font-size:1rem; width:100%;\">';
    playersData.forEach((p, i) => {
        listHTML += `<tr class=\"${p.name === window.user.name ? 'rank-row-me' : ''}\" style=\"border-bottom:1px solid #333;\"><td style=\"color:${i===0?'gold':'white'}; font-weight:bold;\">#${i+1}</td><td style=\"text-align:left; padding-left:10px;\">${p.name}</td><td style=\"color:var(--blue); font-weight:900; text-align:right;\">${(p.currentScore||0).toLocaleString()}</td></tr>`;
    });
    listHTML += '</table></div>';
    panel.innerHTML = `<div class=\"m-title\" style=\"border-color:${amIWinner ? 'gold' : '#F9393F'}\">${amIWinner ? '🏆 ¡VICTORIA! 🏆' : 'PARTIDA FINALIZADA'}</div><div style=\"text-align:center; margin-bottom:20px;\"><div style=\"font-size:1.2rem; color:#aaa;\">GANADOR</div><div style=\"font-size:2.5rem; font-weight:900; color:gold; text-shadow:0 0 20px gold;\">${winner.name}</div><div style=\"font-size:1.5rem;\">${(winner.currentScore||0).toLocaleString()} pts</div></div>${listHTML}<div class=\"modal-buttons-row\"><button class=\"action secondary\" onclick=\"toMenu(); leaveLobbyData();\">SALIR AL MENU</button></div>`;
};
