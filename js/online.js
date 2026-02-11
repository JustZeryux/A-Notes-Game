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
        if (data.status === 'loading' && !window.isMultiplayer) {
            window.isMultiplayer = true;
            closeModal('host');
            
            // Mostrar overlay de espera
            const ov = document.createElement('div');
            ov.id = 'sync-overlay';
            ov.innerHTML = `<div class="sync-loader"></div><h2 style="color:white; margin-top:20px;">SINCRONIZANDO JUGADORES...</h2>`;
            document.body.appendChild(ov);
            ov.style.display = 'flex';

            // Cargar juego (pero game.js esperará)
            const k = data.config.keys[0] || 4;
            prepareAndPlaySong(k); 
        }
        
        // Host chequea si todos están listos
        if (data.status === 'loading' && window.isLobbyHost) {
            // Check si todos tienen flag 'loaded' (necesitarías agregar esto en DB, simplificado aquí)
            // Para simplificar: Esperar 5 segundos y arrancar
            if(!window.syncTimer) {
                window.syncTimer = setTimeout(() => {
                    db.collection("lobbies").doc(lobbyId).update({ status: 'playing' });
                    window.syncTimer = null;
                }, 5000); // 5 seg de buffer para que todos carguen
            }
        }

        // FASE DE JUEGO REAL
        if (data.status === 'playing') {
            const ov = document.getElementById('sync-overlay');
            if(ov) ov.remove();
            
            // Iniciar engine si estaba pausado esperando
            if(typeof window.playSongInternal === 'function' && window.ramSongs.length > 0) {
                // Ya se llamó a prepare, solo nos aseguramos de quitar pausas
            }
        }
        
        // TABLA LIVE
        if(data.status === 'playing' && data.players) {
            // Actualizar scores locales
            const scores = data.players.map(p => ({
                name: p.name,
                score: p.currentScore || 0,
                avatar: p.avatar
            }));
            if(typeof updateMultiLeaderboardUI === 'function') updateMultiLeaderboardUI(scores);
        }
    });
}

// 3. Enviar Score en vivo
window.sendLobbyScore = function(score, isFinal=false) {
    if(!currentLobbyId || !db) return;
    
    // Solo enviar cada 2000 puntos para no saturar, o si es final
    if (isFinal || Math.abs(score - (window.lastSentScore||0)) > 2000) {
        window.lastSentScore = score;
        
        // Nota: Esto requiere una estructura compleja en Firestore para ser eficiente.
        // Simplificado: Actualizar todo el array de jugadores (Race Condition Risk, pero funcional para demo)
        db.runTransaction(async t => {
            const ref = db.collection("lobbies").doc(currentLobbyId);
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
    
    if(isFinal) showWinnerScreen();
};

function showWinnerScreen() {
    // Calcular ganador localmente basado en el último estado recibido
    setTimeout(() => {
        const sorted = window.multiScores.sort((a,b) => b.score - a.score);
        const winner = sorted[0];
        const isMe = winner.name === window.user.name;
        
        const modal = document.getElementById('modal-res');
        modal.style.display = 'flex';
        modal.querySelector('.modal-panel').innerHTML = `
            <div class="m-title" style="color:${isMe?'gold':'red'}">${isMe ? '¡VICTORIA!' : 'DERROTA'}</div>
            <div style="text-align:center;">
                <div style="width:100px; height:100px; border-radius:50%; background:url(${winner.avatar}) center/cover; margin:0 auto; border:4px solid gold;"></div>
                <h1 style="margin:10px 0;">${winner.name}</h1>
                <div style="font-size:2rem; font-weight:900;">${winner.score.toLocaleString()} PTS</div>
            </div>
            <button class="action" onclick="toMenu()">SALIR</button>
        `;
    }, 1000);
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
    if(currentLobbyId && db) {
        // En lugar de 'playing', ponemos 'loading'
        db.collection("lobbies").doc(currentLobbyId).update({ status: 'loading' });
    }
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
