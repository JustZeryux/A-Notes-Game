/* === ONLINE SYSTEM === */
function initOnline() {
    // PeerJS solo se usa para la vieja sincronización 1v1 directa, los lobbies usarán Firestore para sync.
    peer = new Peer(null, { secure: true }); 
    peer.on('open', (id) => {
        myPeerId = id;
        if(db && user.name !== "Guest") {
            db.collection("users").doc(user.name).set({ peerId: id, online: true, lastSeen: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        }
    });
}

function sendFriendRequest() {
    const target = document.getElementById('friend-inp').value.trim();
    if(!target || target === user.name) return;
    
    // Verificar si existe el usuario
    db.collection("users").doc(target).get().then(doc => {
        if(doc.exists) {
            // Se envía a Firestore, no importa si está desconectado
            sendNotification(target, 'friend_req', 'Solicitud de Amistad', user.name + ' quiere ser tu amigo.');
            notify("Solicitud enviada a " + target);
        } else notify("Usuario no encontrado", "error");
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
    // OLD 1v1 Logic (Direct P2P) - Se mantiene como legado o desafío rápido
    db.collection("users").doc(target).get().then(doc => {
        const data = doc.data();
        // Check online status via timestamp
        const now = Math.floor(Date.now()/1000);
        const last = data.lastSeen ? data.lastSeen.seconds : 0;
        if(now - last < 120) {
             sendNotification(target, 'challenge', '¡Desafío 1v1!', user.name + ' te desafía a un duelo.');
             notify("Desafío enviado. Esperando...");
        } else {
            notify("El usuario parece desconectado.", "error");
        }
    });
}

function acceptChallenge(target, notifId) {
    closeNotification(notifId);
     db.collection("users").doc(target).get().then(doc => {
        if(doc.exists && doc.data().peerId) {
            conn = peer.connect(doc.data().peerId);
            setupConnection(); // Reusa la lógica vieja
        } else notify("Error de conexión.", "error");
    });
}

/* === LOBBY SYSTEM (4 PLAYERS) === */
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
        if(snap.empty) { list.innerHTML = '<div style="padding:20px;">No hay salas disponibles. ¡Crea una!</div>'; return; }
        
        snap.forEach(doc => {
            const d = doc.data();
            const row = document.createElement('div');
            row.className = 'lobby-row';
            row.innerHTML = `
                <div class="lobby-info">
                    <div class="lobby-host">${d.host}</div>
                    <div class="lobby-details">${d.song} [${d.diff}K] - ${d.players.length}/4 Jugadores</div>
                </div>
                <button class="btn-small btn-acc" onclick="joinLobby('${doc.id}')">UNIRSE</button>
            `;
            list.appendChild(row);
        });
    });
}

// Paso 1: Abrir selector de dificultad con opción de Crear Sala
function createLobbyUI() {
    closeModal('lobbies');
    // Forzamos selección de canción primero
    if(!curSongId) { notify("Primero selecciona una canción en el menú principal", "error"); return; }
    // Abrimos el modal de dificultad pero mostramos el botón de crear
    openModal('diff');
    document.getElementById('create-lobby-opts').style.display = 'block';
}

// Paso 2: Crear el documento en Firestore
function confirmCreateLobby() {
    const k = keys; // Keys seleccionadas en startGame o default
    const lobbyData = {
        host: user.name,
        song: curSongId,
        diff: k,
        status: 'waiting',
        players: [{name: user.name, ready: false, score: 0, isHost: true}],
        created: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    db.collection("lobbies").add(lobbyData).then(docRef => {
        currentLobbyId = docRef.id;
        isLobbyHost = true;
        closeModal('diff');
        document.getElementById('create-lobby-opts').style.display = 'none';
        enterLobbyRoom();
    });
}

function joinLobby(id) {
    const lobbyRef = db.collection("lobbies").doc(id);
    db.runTransaction(transaction => {
        return transaction.get(lobbyRef).then(doc => {
            if(!doc.exists) throw "Sala no existe";
            const d = doc.data();
            if(d.status !== "waiting") throw "Partida ya iniciada";
            if(d.players.length >= 4) throw "Sala llena";
            
            const newPlayers = [...d.players, {name: user.name, ready: false, score: 0, isHost: false}];
            transaction.update(lobbyRef, { players: newPlayers });
            return d; // Return data for local use
        });
    }).then((data) => {
        currentLobbyId = id;
        isLobbyHost = false;
        // Cargar canción si no la tenemos (Mock up: asumimos que la tiene o es local)
        // En una vers. completa aquí se descargaría la canción del host.
        curSongId = data.song; 
        keys = data.diff;
        closeModal('lobbies');
        enterLobbyRoom();
    }).catch(e => notify("Error al unirse: " + e, "error"));
}

function enterLobbyRoom() {
    openModal('lobby-room');
    isMultiplayer = true;
    
    // Listener de cambios en la sala
    lobbyListener = db.collection("lobbies").doc(currentLobbyId).onSnapshot(doc => {
        if(!doc.exists) { leaveLobby(); notify("La sala se cerró."); return; }
        const d = doc.data();
        
        document.getElementById('room-host-name').innerText = "SALA DE " + d.host;
        document.getElementById('room-song').innerText = d.song + " [" + d.diff + "K]";
        
        const pCont = document.getElementById('room-players');
        pCont.innerHTML = '';
        
        let allReady = true;
        d.players.forEach(p => {
            const pDiv = document.createElement('div');
            pDiv.innerHTML = `
                <div style="background:#222; width:60px; height:60px; border-radius:50%; margin:0 auto; border:2px solid ${p.ready?'#12FA05':'#555'}"></div>
                <div style="font-weight:bold; margin-top:5px;">${p.name}</div>
                <div style="color:${p.ready?'#12FA05':'#888'}; font-size:0.8rem;">${p.ready?'LISTO':'ESPERANDO'}</div>
            `;
            pCont.appendChild(pDiv);
            if(!p.ready) allReady = false;
        });

        // Inicio automático si todos listos y host
        if(isLobbyHost && d.players.length > 0 && allReady && d.status === 'waiting') {
            startLobbyGame();
        }
        
        // Si el estado cambia a playing, iniciar juego
        if(d.status === 'playing') {
            if(document.getElementById('modal-lobby-room').style.display !== 'none') {
                closeModal('lobby-room');
                startGame(d.diff); // Iniciar motor local
            }
            // Update scores in real time
            updateMultiHud(d.players);
        }
    });
}

function toggleReady() {
    if(!currentLobbyId) return;
    const ref = db.collection("lobbies").doc(currentLobbyId);
    // Necesitamos leer y escribir
    db.runTransaction(t => {
        return t.get(ref).then(doc => {
            const d = doc.data();
            const players = d.players.map(p => {
                if(p.name === user.name) p.ready = !p.ready;
                return p;
            });
            t.update(ref, { players: players });
        });
    });
}

function startLobbyGame() {
    db.collection("lobbies").doc(currentLobbyId).update({ status: 'playing' });
}

function leaveLobby() {
    if(lobbyListener) lobbyListener(); // Detener listener
    if(currentLobbyId) {
        // Quitarnos de la lista
        if(isLobbyHost) {
             db.collection("lobbies").doc(currentLobbyId).delete(); // Host cierra sala
        } else {
             // Solo salir
             const ref = db.collection("lobbies").doc(currentLobbyId);
             ref.get().then(doc => {
                 if(doc.exists) {
                     const pl = doc.data().players.filter(p => p.name !== user.name);
                     ref.update({players: pl});
                 }
             });
        }
    }
    currentLobbyId = null;
    isMultiplayer = false;
    isLobbyHost = false;
    closeModal('lobby-room');
}

function updateMultiHud(players) {
    const c = document.getElementById('multi-players-container');
    c.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `multi-p-card ${p.name===user.name?'is-me':''}`;
        div.innerHTML = `<div class="multi-p-name">${p.name}</div><div class="multi-p-score">${p.score.toLocaleString()}</div>`;
        c.appendChild(div);
    });
}

// In Game Score Update
function sendLobbyScore(score) {
    if(!currentLobbyId) return;
    // Esto es pesado hacerlo en cada hit, mejor hacerlo cada X ms o throttle
    // Simplificación: Lo enviamos pero el backend debe manejar concurrencia.
    // Para evitar sobrecarga de escritura, solo actualizamos DB cada 1 segundo
    const now = Date.now();
    if(!window.lastScoreUpdate || now - window.lastScoreUpdate > 2000) {
        window.lastScoreUpdate = now;
         const ref = db.collection("lobbies").doc(currentLobbyId);
         ref.get().then(doc => {
             if(doc.exists) {
                 const players = doc.data().players.map(p => {
                     if(p.name === user.name) p.score = score;
                     return p;
                 });
                 ref.update({players: players});
             }
         });
    }
}
