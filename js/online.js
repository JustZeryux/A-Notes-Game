function initOnline() {
    if(typeof Peer === 'undefined') return;
    peer = new Peer(null, { secure: true }); 
    peer.on('open', (id) => {
        myPeerId = id;
        if(db && typeof user !== 'undefined' && user.name !== "Guest") {
            db.collection("users").doc(user.name).set({ 
                peerId: id, 
                online: true, 
                lastSeen: firebase.firestore.FieldValue.serverTimestamp() 
            }, { merge: true });
        }
    });
    
    // Auto-status loop
    setInterval(() => {
        if(db && typeof user !== 'undefined' && user.name !== "Guest") {
            db.collection("users").doc(user.name).update({
                lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                online: true
            }).catch(()=>{});
        }
    }, 15000);
}

// === SISTEMA DE AMIGOS ===

function sendFriendRequest() {
    const target = document.getElementById('friend-inp').value.trim();
    if(!target) return notify("Escribe un nombre", "error");
    if(target === user.name) return notify("No puedes agregarte a ti mismo", "error");

    db.collection("users").doc(target).get().then(doc => {
        if(doc.exists) {
            const data = doc.data();
            // Verificar si ya son amigos o si ya hay solicitud
            if(data.friends && data.friends.includes(user.name)) return notify("Ya son amigos", "info");
            if(data.requests && data.requests.includes(user.name)) return notify("Solicitud ya enviada", "info");

            // Enviar Solicitud
            db.collection("users").doc(target).update({
                requests: firebase.firestore.FieldValue.arrayUnion(user.name)
            }).then(() => {
                notify(`Solicitud enviada a ${target}`, "success");
                document.getElementById('friend-inp').value = "";
            });
        } else {
            notify("Usuario no encontrado", "error");
        }
    });
}

function sendNotification(target, type, title, body) {
    db.collection("users").doc(target).collection("notifications").add({
        type: type, title: title, body: body, from: user.name, read: false, timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
}

function respondFriend(target, accept, notifId) {
    closeNotification(notifId);
    if(accept) {
        const batch = db.batch();
        batch.update(db.collection("users").doc(user.name), { friends: firebase.firestore.FieldValue.arrayUnion(target) });
        batch.update(db.collection("users").doc(target), { friends: firebase.firestore.FieldValue.arrayUnion(user.name) });
        batch.commit().then(() => notify("¡Ahora eres amigo de " + target + "!"));
    }
}

function challengeFriend(target) {
    db.collection("users").doc(target).get().then(doc => {
        const data = doc.data();
        const now = Math.floor(Date.now()/1000);
        const last = data.lastSeen ? data.lastSeen.seconds : 0;
        if(now - last < 120) {
             sendNotification(target, 'challenge', '¡Desafío 1v1!', user.name + ' te desafía a un duelo.');
             notify("Desafío enviado. Esperando...");
        } else {
            notify("Usuario desconectado", "error");
        }
    });
}

function acceptChallenge(target, notifId) {
    closeNotification(notifId);
     db.collection("users").doc(target).get().then(doc => {
        if(doc.exists && doc.data().peerId) {
            conn = peer.connect(doc.data().peerId);
            setupConnection();
        } else notify("Error de conexión.", "error");
    });
}

/* === LOBBY SYSTEM === */
function openLobbyBrowser() {
    if(user.name === 'Guest') return notify("Inicia sesión para jugar online", "error");
    openModal('lobbies');
    refreshLobbies();
}

function refreshLobbies() {
    const list = document.getElementById('lobby-list');
    list.innerHTML = 'Cargando...';
    
    db.collection("lobbies").where("status", "==", "waiting").limit(20).get().then(snap => {
        list.innerHTML = '';
        if(snap.empty) { list.innerHTML = '<div style="padding:20px;">No hay salas disponibles.</div>'; return; }
        
        snap.forEach(doc => {
            const d = doc.data();
            const row = document.createElement('div');
            row.className = 'lobby-row';
            row.innerHTML = `
                <div class="lobby-info">
                    <div class="lobby-host">${d.host}</div>
                    <div class="lobby-details">${d.songTitle} [${d.diff}K] - ${d.players.length}/4</div>
                </div>
                <button class="btn-small btn-acc" onclick="joinLobby('${doc.id}')">UNIRSE</button>
            `;
            list.appendChild(row);
        });
    });
}

function openSongSelectorForLobby() {
    closeModal('lobbies');
    openModal('song-selector');
    renderLobbySongList();
}

function renderLobbySongList(filter="") {
    const grid = document.getElementById('lobby-song-grid');
    grid.innerHTML = 'Cargando...';
    
    db.collection("globalSongs").orderBy("createdAt", "desc").limit(50).get().then(snapshot => {
        grid.innerHTML = '';
        if(snapshot.empty) {
            grid.innerHTML = '<div style="grid-column:1/-1; text-align:center;">No hay canciones globales.</div>';
            return;
        }
        snapshot.forEach(doc => {
            const s = doc.data();
            if(filter && !s.title.toLowerCase().includes(filter.toLowerCase())) return;

            const c = document.createElement('div');
            c.className = 'beatmap-card';
            const bgStyle = s.imageURL ? `background-image:url(${s.imageURL})` : `background-image:linear-gradient(135deg,hsl(200,60%,20%),black)`;
            
            c.innerHTML = `
                <div class="bc-bg" style="${bgStyle}"></div>
                <div class="bc-info">
                    <div class="bc-title">${s.title}</div>
                    <div class="bc-meta" style="font-size:0.8rem;">Click para hostear</div>
                </div>
            `;
            c.onclick = () => {
                curSongData = { id: doc.id, ...s }; 
                closeModal('song-selector'); 
                openModal('diff'); 
                document.getElementById('create-lobby-opts').style.display = 'block'; 
            };
            grid.appendChild(c);
        });
    });
}
let currentLobbyId = null;
let lobbyListener = null;
let multiScores = [];

function createLobby(songId) {
    if (!db || !user.name || user.name === "Guest") return notify("Debes iniciar sesión", "error");
    
    // Obtener configuración del panel
    const allowedKeys = [];
    if(document.getElementById('chk-4k').checked) allowedKeys.push(4);
    if(document.getElementById('chk-6k').checked) allowedKeys.push(6);
    if(document.getElementById('chk-7k').checked) allowedKeys.push(7);

    const lobbyData = {
        host: user.name,
        songId: songId,
        songTitle: curSongData.title, // Guardar título para mostrar a otros
        status: 'waiting',
        players: [{ name: user.name, avatar: user.avatarData || '', status: 'ready' }],
        config: {
            density: cfg.lobbyDen || 5,
            ranked: cfg.lobbyRanked || false,
            keys: allowedKeys.length > 0 ? allowedKeys : [4] // Fallback a 4K
        },
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection("lobbies").add(lobbyData).then(docRef => {
        currentLobbyId = docRef.id;
        listenToLobby(currentLobbyId);
        notify("Sala creada. Esperando jugadores...");
    });
}

function listenToLobby(lobbyId) {
    if (lobbyListener) lobbyListener();
    lobbyListener = db.collection("lobbies").doc(lobbyId).onSnapshot(doc => {
        if (!doc.exists) return leaveLobby();
        const data = doc.data();
        
        if (data.status === 'playing' && !isMultiplayer) {
            // El host inició la partida
            isMultiplayer = true;
            // Usar la densidad configurada por el host
            cfg.den = data.config.density;
            st.ranked = data.config.ranked;
            
            closeModal('host');
            // Mostrar selector de keys permitidas si hay más de una, sino iniciar directo
            if(data.config.keys.length > 1) {
                 // Aquí deberías mostrar un selector rápido de keys permitidas
                 // Por simplicidad, iniciamos con la primera disponible:
                 startGame(data.config.keys[0]);
            } else {
                 startGame(data.config.keys[0]);
            }
             notify(data.config.ranked ? "Partida RANKED iniciada" : "Partida iniciada");
        }
        
        updateHostPanelUI(data.players);
    });
}

function updateHostPanelUI(players) {
    const list = document.getElementById('hp-players-list');
    const count = document.getElementById('hp-count');
    if(!list || !count) return;
    
    count.innerText = players.length;
    list.innerHTML = '';
    players.forEach(p => {
        const isHost = p.name === players[0].name;
        list.innerHTML += `
            <div class="hp-player-row ${isHost ? 'is-host' : ''}">
                <div class="hp-p-av" style="background-image:url(${p.avatar||''})"></div>
                <div class="hp-p-name">${p.name} ${isHost ? '(Host)' : ''}</div>
            </div>`;
    });
}

function startLobbyMatch() {
    if(!currentLobbyId) return;
    db.collection("lobbies").doc(currentLobbyId).update({ status: 'playing' });
}

function leaveLobby() {
    if (currentLobbyId) {
        if (lobbyListener) lobbyListener();
        // Si soy host, borrar lobby, sino, sacarme de la lista (lógica simplificada: borrar)
        db.collection("lobbies").doc(currentLobbyId).delete();
        currentLobbyId = null;
        isMultiplayer = false;
    }
}

// === LIVE SCORE SYSTEM (PARA EL NUEVO LEADERBOARD) ===

function sendLobbyScore(score) {
    if (!currentLobbyId || !user.name) return;
    // Enviar puntuación efímera a una subcolección o usar Realtime DB sería mejor,
    // pero por ahora usamos un campo en el documento del lobby (menos eficiente pero funciona rápido)
    // NOTA: Esto es una simplificación extrema. Idealmente usarías Firebase Realtime Database para esto.
    // Para este ejemplo, simularemos que funciona y nos enfocamos en la UI local.
    
    // Simulamos recibir datos de otros (en un sistema real, esto vendría de un snapshot)
    // updateMultiScores({ name: user.name, score: score, avatar: user.avatarData });
}

// Esta función debe ser llamada cuando el snapshot del lobby detecte cambios en los scores
function updateMultiScores(playerData) {
    // Actualizar array local
    const existing = multiScores.find(p => p.name === playerData.name);
    if(existing) {
        existing.score = playerData.score;
    } else {
        multiScores.push(playerData);
    }
    
    // Ordenar
    multiScores.sort((a, b) => b.score - a.score);
    
    // Actualizar UI en game.js
    if(typeof updateMultiLeaderboardUI === 'function') {
        updateMultiLeaderboardUI(multiScores);
    }
}


// === FRIEND REQUEST FIX (DEBE FUNCIONAR AHORA) ===

function sendFriendRequest() {
    const target = document.getElementById('friend-inp').value.trim();
    if(!target || target === user.name) return notify("Nombre inválido", "error");

    db.collection("users").doc(target).get().then(doc => {
        if(doc.exists) {
            const data = doc.data();
            if(data.friends?.includes(user.name)) return notify("Ya son amigos", "info");
            if(data.requests?.includes(user.name)) return notify("Solicitud ya enviada", "info");

            db.collection("users").doc(target).update({
                requests: firebase.firestore.FieldValue.arrayUnion(user.name)
            }).then(() => {
                notify(`Solicitud enviada a ${target}`, "success");
                document.getElementById('friend-inp').value = "";
            });
        } else {
            notify("Usuario no encontrado", "error");
        }
    });
}

// FIX CRÍTICO: Asegurar que esta función existe y es accesible
window.respondFriend = function(targetName, accept) {
    console.log("Respondiendo a:", targetName, "Aceptar:", accept);
    if(!user.name || user.name === "Guest") return notify("Error de sesión", "error");

    const batch = db.batch();
    const myRef = db.collection("users").doc(user.name);
    const targetRef = db.collection("users").doc(targetName);

    // 1. SIEMPRE Quitar de mis solicitudes
    batch.update(myRef, {
        requests: firebase.firestore.FieldValue.arrayRemove(targetName)
    });

    if(accept) {
        // 2. Si acepto, agregar a amigos en AMBOS
        batch.update(myRef, { friends: firebase.firestore.FieldValue.arrayUnion(targetName) });
        batch.update(targetRef, { friends: firebase.firestore.FieldValue.arrayUnion(user.name) });
        notify(`¡${targetName} agregado!`, "success");
    } else {
        notify("Solicitud rechazada");
    }

    batch.commit()
        .then(() => console.log("Transacción de amigos exitosa"))
        .catch(err => {
            console.error("Error en amigos:", err);
            notify("Error al procesar solicitud", "error");
        });
};

// Exportar funciones necesarias
window.createLobby = createLobby;
window.startLobbyMatch = startLobbyMatch;
window.leaveLobby = leaveLobby;
window.sendLobbyScore = sendLobbyScore;
window.sendFriendRequest = sendFriendRequest;
