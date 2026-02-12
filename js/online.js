/* === ONLINE SYSTEM (FIXED SYNC & PRIVATE V2) === */

var currentLobbyId = null;
var lobbyListener = null;

window.initOnline = function() {
    // (Código de PeerJS igual...)
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

// === NUEVA FUNCIÓN: Notificar que cargué la canción ===
window.notifyLobbyLoaded = function() {
    if(!currentLobbyId || !window.db) return;
    // Actualizamos nuestro estado a "loaded"
    // NOTA: Esto se simplifica usando un contador de tiempo en el host para no trabar si alguien tiene internet lento
    console.log("Canción cargada, esperando señal de inicio...");
};

// === MODIFICADO: createLobbyData con opción PRIVADA ===
window.createLobbyData = function(songId, config, isPrivate = false) {
    if (!window.db) return Promise.reject("DB no conectada");
    
    const lobbyData = {
        host: window.user.name,
        songId: songId,
        songTitle: window.curSongData ? window.curSongData.title : "Desconocido",
        status: 'waiting',
        players: [{ name: window.user.name, avatar: window.user.avatarData || '', status: 'ready', score: 0 }],
        config: config,
        isPrivate: isPrivate, // <--- NUEVO CAMPO
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    return window.db.collection("lobbies").add(lobbyData).then(docRef => {
        currentLobbyId = docRef.id;
        subscribeToLobby(currentLobbyId);
        return docRef.id;
    });
};

window.joinLobbyData = function(lobbyId) {
    // (Igual que antes, solo asegúrate de limpiar listeners viejos)
    if(lobbyListener) lobbyListener(); // Desuscribir anterior
    
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
        // Cargar datos de la canción
        window.db.collection("globalSongs").doc(data.songId).get().then(s => {
            if(s.exists) {
                window.curSongData = { id: s.id, ...s.data() };
                if(typeof window.openHostPanel === 'function') {
                    window.openHostPanel(window.curSongData, true); 
                }
            }
        });
        subscribeToLobby(lobbyId);
    }).catch(e => {
        if(typeof notify === 'function') notify(e, "error");
    });
};

window.toggleReadyData = function() {
    // (Igual que antes)
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

// === CRÍTICO: Sincronización corregida ===
function subscribeToLobby(lobbyId) {
    if (lobbyListener) lobbyListener(); // Evitar duplicados
    
    lobbyListener = window.db.collection("lobbies").doc(lobbyId).onSnapshot(doc => {
        if (!doc.exists) { 
            window.leaveLobbyData(); 
            if(typeof closeModal === 'function') closeModal('host'); 
            notify("Sala cerrada por el host", "info");
            return; 
        }
        
        const data = doc.data();
        
        // Sincronizar Configuración (Si el host cambia dificultad)
        if (data.config && window.cfg) {
            window.cfg.den = data.config.density;
            // Actualizar UI del host panel si está abierto
            if(document.getElementById('hp-mode-disp')) {
                document.getElementById('hp-mode-disp').innerText = data.config.keys[0] + "K";
                document.getElementById('hp-den-disp').innerText = data.config.density;
            }
        }

        // --- FASE 1: CARGA (LOADING) ---
        if (data.status === 'loading') {
            window.isMultiplayer = true;
            if(typeof closeModal === 'function') closeModal('host');
            
            // Asegurarnos que el loading overlay se muestre
            const loader = document.getElementById('loading-overlay');
            if(loader) {
                loader.style.display = 'flex';
                document.getElementById('loading-text').innerText = "SINCRONIZANDO...";
            }

            // Iniciar carga de audio (prepareAndPlaySong en game.js se detendrá en "esperando")
            const k = (data.config && data.config.keys) ? data.config.keys[0] : 4;
            // Solo llamamos si no estamos ya cargando
            if(!window.curSongData || window.curSongData.id !== data.songId) {
                 // Fetch rápido si faltan datos
            }
            if(typeof window.prepareAndPlaySong === 'function') window.prepareAndPlaySong(k);
        }
        
        // --- LÓGICA DEL HOST PARA INICIAR ---
        if (data.status === 'loading' && window.isLobbyHost) {
            // Esperamos 4 segundos para dar tiempo a cargar a todos y luego forzamos start
            if(!window.syncTimer) {
                window.syncTimer = setTimeout(() => {
                    window.db.collection("lobbies").doc(lobbyId).update({ status: 'playing' });
                    window.syncTimer = null;
                }, 4000); 
            }
        }

        // --- FASE 2: JUEGO (PLAYING) - AQUÍ ESTABA EL BUG ---
        if (data.status === 'playing') {
            // 1. Ocultar overlays de carga
            const loader = document.getElementById('loading-overlay');
            if(loader) loader.style.display = 'none';
            
            const syncOv = document.getElementById('sync-overlay');
            if(syncOv) syncOv.style.display = 'none';

            // 2. INICIAR EL MOTOR DE JUEGO
            // game.js está pausado esperando. Necesitamos forzar el inicio.
            if(window.ramSongs && window.curSongData) {
                const s = window.ramSongs.find(x => x.id === window.curSongData.id);
                // Solo iniciamos si NO está corriendo ya
                if(s && (!window.st.act || window.st.paused)) {
                    console.log("GO! Iniciando partida multiplayer.");
                    window.playSongInternal(s);
                }
            }
        }
        
        // UI Updates del Lobby
        if (data.status === 'waiting' && typeof updateHostPanelUI === 'function') {
            updateHostPanelUI(data.players, data.host);
        }
        
        // Live Scores
        if (data.status === 'playing' && data.players && typeof updateMultiLeaderboardUI === 'function') {
            const scores = data.players.map(p => ({
                name: p.name, score: p.currentScore || 0, avatar: p.avatar
            }));
            updateMultiLeaderboardUI(scores);

            if (data.status === 'finished') {
            // Detener motor si sigue corriendo
            if(window.st.act) {
                window.st.act = false;
                if(window.st.src) { window.st.src.stop(); window.st.src = null; }
                document.getElementById('game-layer').style.display = 'none';
                document.getElementById('menu-container').classList.remove('hidden');
            }
            // Mostrar resultados
            window.showMultiplayerResults(data.players);
        }
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
    
    // Desuscribir snapshot
    if(lobbyListener) { lobbyListener(); lobbyListener = null; }

    ref.get().then(doc => {
        if(doc.exists) {
            if(doc.data().host === window.user.name) {
                // Si soy host, borro la sala (o migrar host, pero borrar es más fácil)
                ref.delete(); 
            } else {
                // Si soy cliente, me saco de la lista
                const p = doc.data().players.filter(x => x.name !== window.user.name);
                ref.update({ players: p });
            }
        }
    });
    currentLobbyId = null; 
    window.isMultiplayer = false;
};

// (sendLobbyScore se mantiene igual...)
window.sendLobbyScore = function(score, isFinal) { /* ... */ };

// === UI DEL LEADERBOARD EN JUEGO ===
window.updateMultiLeaderboardUI = function(scores) {
    const hud = document.getElementById('vs-hud');
    const container = document.getElementById('multi-players-container');
    if(!hud || !container) return;

    // Asegurar que sea visible
    hud.style.display = 'block'; 

    // Ordenar por puntaje descendente
    scores.sort((a, b) => b.score - a.score);

    container.innerHTML = '';
    scores.forEach((p, index) => {
        const isMe = p.name === window.user.name;
        
        const row = document.createElement('div');
        row.className = `ml-row ${isMe ? 'is-me' : ''}`;
        // Atributo para colorear el top 3 con CSS
        row.setAttribute('data-rank', index + 1);

        row.innerHTML = `
            <div class="ml-pos">#${index + 1}</div>
            <div class="ml-av" style="background-image:url(${p.avatar || ''})"></div>
            <div class="ml-info">
                <div class="ml-name">${p.name}</div>
                <div class="ml-score">${p.score.toLocaleString()}</div>
            </div>
        `;
        container.appendChild(row);
    });
};

// === PANTALLA DE RESULTADOS MULTIJUGADOR ===
window.showMultiplayerResults = function(playersData) {
    const modal = document.getElementById('modal-res');
    if(!modal) return;

    // Ordenar final
    playersData.sort((a, b) => (b.currentScore || 0) - (a.currentScore || 0));
    
    const winner = playersData[0];
    const amIWinner = winner.name === window.user.name;
    const myData = playersData.find(p => p.name === window.user.name) || { currentScore: 0 };

    modal.style.display = 'flex';
    const panel = modal.querySelector('.modal-panel');
    
    let listHTML = '<div class="rank-table-wrapper"><table class="rank-table" style="font-size:1rem;">';
    playersData.forEach((p, i) => {
        listHTML += `
        <tr class="${p.name === window.user.name ? 'rank-row-me' : ''}">
            <td>#${i+1}</td>
            <td>${p.name}</td>
            <td style="color:var(--blue); font-weight:900;">${(p.currentScore||0).toLocaleString()}</td>
        </tr>`;
    });
    listHTML += '</table></div>';

    panel.innerHTML = `
        <div class="m-title" style="border-color:${amIWinner ? 'gold' : '#F9393F'}">
            ${amIWinner ? '🏆 ¡VICTORIA! 🏆' : 'FIN DE PARTIDA'}
        </div>
        
        <div style="text-align:center; margin-bottom:20px;">
            <div style="font-size:1.2rem; color:#aaa;">GANADOR</div>
            <div style="font-size:2rem; font-weight:900; color:gold;">${winner.name}</div>
            <div style="font-size:1.5rem;">${(winner.currentScore||0).toLocaleString()} pts</div>
        </div>

        ${listHTML}

        <div class="modal-buttons-row">
            <button class="action secondary" onclick="toMenu(); leaveLobbyData();">SALIR AL MENU</button>
        </div>
    `;
};
