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
// === SINCRONIZACIÓN SEGURA ===
// === PEGAR/REEMPLAZAR EN JS/ONLINE.JS ===

// 1. Función que avisa que tu mapa ya cargó
window.notifyLobbyLoaded = function() {
    console.log(">> ONLINE: Enviando señal de listo al servidor.");
    const txt = document.getElementById('loading-text');
    if(txt) txt.innerText = "ESPERANDO A TODOS LOS JUGADORES...";
    
    // CAMBIO IMPORTANTE: Forzamos la actualización del estado a 'playing'
    if(window.isLobbyHost && window.currentLobbyId) {
        console.log(">> SOY HOST: Iniciando cuenta regresiva de 3s...");
        setTimeout(() => {
            if(window.db) {
                console.log(">> HOST: ¡ENVIANDO SEÑAL DE INICIO (GO)!");
                window.db.collection("lobbies").doc(window.currentLobbyId).update({ status: 'playing' });
            }
        }, 3000); 
    }
};

// 2. Función que detecta la señal de inicio (GO)
window.checkGameStart = function(lobbyData) {
    // Si la base de datos dice 'playing' y yo no he empezado...
    if (lobbyData.status === 'playing' && !window.hasGameStarted) {
        console.log(">> RECIBIDA SEÑAL DE INICIO DE FIREBASE!");
        window.hasGameStarted = true;
        
        // Ocultar Lobby
        const m = document.getElementById('modal-lobby-room');
        if(m) m.style.display = 'none';
        
        // ARRANCAR EL JUEGO QUE GUARDAMOS EN EL PASO 1
        if (window.preparedSong) {
            if(typeof window.playSongInternal === 'function') {
                window.playSongInternal(window.preparedSong);
            }
        } else {
            // Fallback de emergencia por si algo falló
            console.warn("¡Emergencia! Canción no estaba en memoria. Intentando recargar...");
            if(typeof window.prepareAndPlaySong === 'function') {
                window.prepareAndPlaySong(window.keys || 4);
            }
        }
    }
};

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
// === REEMPLAZAR EN JS/ONLINE.JS ===

function subscribeToLobby(lobbyId) {
    if (lobbyListener) lobbyListener();
    
    // Aquí está el .onSnapshot que decías no tener (es parte de Firebase)
    lobbyListener = window.db.collection("lobbies").doc(lobbyId).onSnapshot(doc => {
        if (!doc.exists) { 
            window.leaveLobbyData(); 
            if(typeof closeModal === 'function') closeModal('host'); 
            notify("La sala ha sido cerrada", "info"); 
            return; 
        }
        
        const data = doc.data();
        
        // 1. Si el estado es 'loading' (El host le dio a iniciar)
        if (data.status === 'loading') {
            if(!window.isMultiplayerReady && !window.hasGameStarted) {
                window.isMultiplayer = true;
                
                // Cerrar paneles visuales
                const hostPanel = document.getElementById('modal-host'); 
                if(hostPanel) hostPanel.style.display = 'none'; // Ocultar panel host
                
                // Mostrar carga
                const loader = document.getElementById('loading-overlay');
                if(loader) { loader.style.display = 'flex'; document.getElementById('loading-text').innerText = "SINCRONIZANDO..."; }
                
                // Iniciar descarga del mapa
                const k = (data.config && data.config.keys) ? data.config.keys[0] : 4;
                if(typeof window.prepareAndPlaySong === 'function') {
                    window.prepareAndPlaySong(k);
                }
            }
        }
        
        // 2. Si el estado es 'playing' (El host ya cargó y dio la orden final)
        if (data.status === 'playing') {
            // ESTA ES LA LÍNEA QUE FALTABA:
            handleLobbyStatus(data); 
        }
        
        // 3. Actualizar UI de la sala
        if (data.status === 'waiting' && typeof updateHostPanelUI === 'function') {
            updateHostPanelUI(data.players, data.host);
        }
        
        // 4. Actualizar tabla de puntos en vivo
        if (data.status === 'playing' && typeof updateMultiLeaderboardUI === 'function') {
            updateMultiLeaderboardUI(data.players);
        }

        // 5. Finalizar
        if (data.status === 'finished') {
            if(typeof showMultiplayerResults === 'function') showMultiplayerResults(data.players);
            window.hasGameStarted = false;
        }
    });
}

// Asegúrate de tener esta función al final de online.js también


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

// Añade esto al final de js/online.js
window.handleLobbyStatus = function(data) {
    if (data.status === 'playing' && !window.hasGameStarted) {
        console.log(">> GO! Iniciar juego.");
        window.hasGameStarted = true;
        
        const loader = document.getElementById('loading-overlay');
        if(loader) loader.style.display = 'none';
        
        if (window.preparedSong) {
            // Usar la canción guardada en memoria
            if(typeof window.playSongInternal === 'function') window.playSongInternal(window.preparedSong);
        } else {
            // Error de sincronización
            console.error("No estaba listo");
        }
    }
};

// ==========================================
// SISTEMA HEARTBEAT (LATIDO ONLINE CADA 15s)
// ==========================================
setInterval(() => {
    // Si hay un usuario logueado y Firebase está conectado
    if (window.user && window.user.name && window.db) {
        window.db.collection('users').doc(window.user.name).update({
            lastActive: Date.now(), // Guarda el milisegundo exacto actual
            online: true // Mantenemos el booleano por si acaso
        }).catch(err => console.log("Latido pausado (Offline local)"));
    }
}, 15000); // 15000 milisegundos = 15 segundos

// =========================================================
// 🌐 ESCUCHA GLOBAL EN TIEMPO REAL (AMIGOS Y 1v1)
// =========================================================
window.iniciarEscuchaGlobal = function() {
    if (!window.user || !window.user.name || window.user.name === "Guest" || !window.db) return;

    window.db.collection('users').doc(window.user.name).onSnapshot(doc => {
        if (!doc.exists) return;
        let data = doc.data();

        // 1. DETECTAR NUEVAS SOLICITUDES DE AMISTAD
        let currentReqs = window.user.friendRequests || [];
        let newReqs = data.friendRequests || [];
        
        if (newReqs.length > currentReqs.length) {
            let nuevoAmigo = newReqs[newReqs.length - 1];
            if(typeof window.notify === 'function') {
                window.notify(`👥 ${nuevoAmigo} te ha enviado una solicitud de amistad.`, "info");
                if(typeof window.updateSocialUI === 'function') window.updateSocialUI(); // Refrescar UI visualmente
            }
        }
        window.user.friendRequests = newReqs;
        window.user.friends = data.friends || [];

        // 2. DETECTAR RETOS 1v1 DIRECTOS (POP-UP SYSTEM)
        let currentInvites = window.user.invites || [];
        let newInvites = data.invites || [];
        
        if (newInvites.length > currentInvites.length) {
            let invitacion = newInvites[newInvites.length - 1];
            if(typeof window.showInviteModal === 'function') window.showInviteModal(invitacion);
        }
        window.user.invites = newInvites;
    });
};

// Disparador automático: Cuando inicies sesión, el radar se encenderá.
setInterval(() => {
    if(window.user && window.user.name && window.user.name !== "Guest" && window.db && !window.escuchaIniciada) {
        window.iniciarEscuchaGlobal();
        window.escuchaIniciada = true;
    }
}, 3000);
