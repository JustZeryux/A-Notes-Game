/* === ONLINE SYSTEM (HOST FIX V5) === */

var currentLobbyId = null;
var lobbyListener = null;
window.isMultiplayerReady = false; 

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

// === FIX: EL HOST GOBIERNA EL INICIO ===
window.notifyLobbyLoaded = function() {
    console.log("Juego listo (Map Generated).");
    window.isMultiplayerReady = true;
    
    // Si soy el Host, YO doy la orden de arrancar, pero espero un poco
    // para asegurar que los clientes también carguen.
    if(window.isLobbyHost && currentLobbyId) {
        document.getElementById('loading-text').innerText = "ESPERANDO JUGADORES...";
        setTimeout(() => {
            console.log("Host enviando señal de inicio...");
            window.db.collection("lobbies").doc(currentLobbyId).update({ status: 'playing' });
        }, 3000); // 3 segundos de cortesía para que carguen los demás
    }
    
    // Si llegué tarde y la sala ya estaba jugando
    if(window.lobbyStatusCache === 'playing') {
        startMultiplayerGameNow();
    }
};

function startMultiplayerGameNow() {
    if(!window.isMultiplayerReady) return; // Si no tengo mapa, no arranco
    
    const s = window.ramSongs ? window.ramSongs.find(x => x.id === window.curSongData.id) : null;
    if(s && (!window.st.act || window.st.paused)) {
        console.log("GO! Iniciando partida multiplayer.");
        window.playSongInternal(s);
    }
}

window.createLobbyData = function(songId, config, isPrivate = false) {
    if (!window.db) return Promise.reject("DB no conectada");
    
    const lobbyData = {
        host: window.user.name,
        songId: songId,
        songTitle: window.curSongData ? window.curSongData.title : "Desconocido",
        status: 'waiting',
        players: [{ name: window.user.name, avatar: window.user.avatarData || '', status: 'ready', score: 0 }],
        config: config,
        isPrivate: isPrivate,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    return window.db.collection("lobbies").add(lobbyData).then(docRef => {
        currentLobbyId = docRef.id;
        window.isLobbyHost = true; // MARCAR COMO HOST
        subscribeToLobby(currentLobbyId);
        return docRef.id;
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
            t.update(lobbyRef, {
                players: firebase.firestore.FieldValue.arrayUnion({
                    name: window.user.name, avatar: window.user.avatarData||'', status: 'not-ready', score: 0
                })
            });
        }
        return data;
    }).then(data => {
        currentLobbyId = lobbyId;
        window.isLobbyHost = false; // SOY CLIENTE
        window.db.collection("globalSongs").doc(data.songId).get().then(s => {
            if(s.exists) {
                window.curSongData = { id: s.id, ...s.data() };
                if(typeof window.openHostPanel === 'function') {
                    window.openHostPanel(window.curSongData, false); 
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
            notify("Sala cerrada por el host", "info");
            return; 
        }
        
        const data = doc.data();
        window.lobbyStatusCache = data.status;
        
        // Sync Config
        if (data.config && window.cfg) {
            window.cfg.den = data.config.density;
        }

        // --- CARGA ---
        if (data.status === 'loading') {
            window.isMultiplayer = true;
            window.isMultiplayerReady = false; 
            if(typeof closeModal === 'function') closeModal('host');
            
            const loader = document.getElementById('loading-overlay');
            if(loader) {
                loader.style.display = 'flex';
                document.getElementById('loading-text').innerText = "GENERANDO MAPA...";
            }

            const k = (data.config && data.config.keys) ? data.config.keys[0] : 4;
            // Iniciamos preparación local
            if(typeof window.prepareAndPlaySong === 'function') window.prepareAndPlaySong(k);
        }
        
        // NOTA: ELIMINÉ EL TIMEOUT DEL HOST AQUÍ. 
        // AHORA EL INICIO SE GESTIONA EN notifyLobbyLoaded

        // --- PLAYING ---
        if (data.status === 'playing') {
            const loader = document.getElementById('loading-overlay');
            if(loader) loader.style.display = 'none';
            
            if (window.isMultiplayerReady) {
                startMultiplayerGameNow();
            }
        }
        
        // UI Updates
        if (data.status === 'waiting' && typeof updateHostPanelUI === 'function') {
            updateHostPanelUI(data.players, data.host);
        }
        
        if (data.status === 'playing' && data.players) {
            const sortedPlayers = [...data.players].sort((a, b) => (b.currentScore || 0) - (a.currentScore || 0));
            updateMultiLeaderboardUI(sortedPlayers);
        }

        // --- FINALIZADO ---
        if (data.status === 'finished') {
            if(window.st.act) {
                window.st.act = false;
                if(window.st.src) { try{window.st.src.stop();}catch(e){} window.st.src = null; }
                document.getElementById('game-layer').style.display = 'none';
            }
            window.showMultiplayerResults(data.players);
        }
    });
}

window.startLobbyMatchData = function() {
    // El host cambia el estado a 'loading'.
    // Esto dispara 'prepareAndPlaySong' en todos.
    if(currentLobbyId && window.db) {
        window.db.collection("lobbies").doc(currentLobbyId).update({ status: 'loading' });
    }
};

window.leaveLobbyData = function() {
    if (!currentLobbyId || !window.db) return;
    const ref = window.db.collection("lobbies").doc(currentLobbyId);
    if(lobbyListener) { lobbyListener(); lobbyListener = null; }

    ref.get().then(doc => {
        if(doc.exists) {
            // Si soy host, borro la sala
            if(doc.data().host === window.user.name) {
                ref.delete(); 
            } else {
                // Si soy cliente, me quito de la lista
                const p = doc.data().players.filter(x => x.name !== window.user.name);
                ref.update({ players: p });
            }
        }
    });
    currentLobbyId = null; 
    window.isMultiplayer = false;
    window.isLobbyHost = false;
};

window.sendLobbyScore = function(score, isFinal) {
    if(!currentLobbyId || !window.db) return;
    const ref = window.db.collection("lobbies").doc(currentLobbyId);
    window.db.runTransaction(async (t) => {
        const doc = await t.get(ref);
        if(!doc.exists) return;
        const players = doc.data().players;
        const myIdx = players.findIndex(p => p.name === window.user.name);
        if(myIdx !== -1) {
            players[myIdx].currentScore = score;
            t.update(ref, { players: players });
        }
    });
};

// === LEADERBOARD DERECHO (CUADRADO) ===
window.updateMultiLeaderboardUI = function(players) {
    const hud = document.getElementById('vs-hud');
    const container = document.getElementById('multi-players-container');
    if(!hud || !container) return;

    hud.style.display = 'flex'; 
    container.innerHTML = '';
    
    players.forEach((p, index) => {
        const isMe = p.name === window.user.name;
        const row = document.createElement('div');
        row.className = `ml-row ${isMe ? 'is-me' : ''}`;
        row.setAttribute('data-rank', index + 1);

        row.innerHTML = `
            <div class="ml-pos">#${index + 1}</div>
            <div class="ml-av" style="background-image:url(${p.avatar || ''})"></div>
            <div class="ml-info">
                <div class="ml-name">${p.name}</div>
                <div class="ml-score">${(p.currentScore||0).toLocaleString()}</div>
            </div>
        `;
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
    
    let listHTML = '<div class="rank-table-wrapper" style="margin-top:20px; max-height:300px; overflow-y:auto; background:#111; padding:10px; border-radius:8px;"><table class="rank-table" style="font-size:1rem; width:100%;">';
    playersData.forEach((p, i) => {
        listHTML += `
        <tr class="${p.name === window.user.name ? 'rank-row-me' : ''}" style="border-bottom:1px solid #333;">
            <td style="color:${i===0?'gold':'white'}; font-weight:bold;">#${i+1}</td>
            <td style="text-align:left; padding-left:10px;">${p.name}</td>
            <td style="color:var(--blue); font-weight:900; text-align:right;">${(p.currentScore||0).toLocaleString()}</td>
        </tr>`;
    });
    listHTML += '</table></div>';

    panel.innerHTML = `
        <div class="m-title" style="border-color:${amIWinner ? 'gold' : '#F9393F'}">
            ${amIWinner ? '🏆 ¡VICTORIA! 🏆' : 'PARTIDA FINALIZADA'}
        </div>
        
        <div style="text-align:center; margin-bottom:20px;">
            <div style="font-size:1.2rem; color:#aaa;">GANADOR</div>
            <div style="font-size:2.5rem; font-weight:900; color:gold; text-shadow:0 0 20px gold;">${winner.name}</div>
            <div style="font-size:1.5rem;">${(winner.currentScore||0).toLocaleString()} pts</div>
        </div>

        ${listHTML}

        <div class="modal-buttons-row">
            <button class="action secondary" onclick="toMenu(); leaveLobbyData();">SALIR AL MENU</button>
        </div>
    `;
};
