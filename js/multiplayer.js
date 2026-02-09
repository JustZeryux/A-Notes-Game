/* === SISTEMA DE HOSTS (SALAS) === */
function createHost() {
    if(!user.uid) return notify("ERROR", "Inicia sesión", "error");
    
    db.collection("lobbies").add({
        host: user.name,
        song: "Seleccionando...",
        players: [user.name],
        state: "waiting",
        ready: { [user.name]: false }
    }).then(doc => {
        activeLobbyId = doc.id;
        openModal('lobby');
        listenLobby(doc.id);
    });
}

function refreshHosts() {
    const list = document.getElementById('host-list-container');
    list.innerHTML = "Cargando...";
    
    db.collection("lobbies").where("state", "==", "waiting").get().then(snap => {
        list.innerHTML = "";
        if(snap.empty) {
            list.innerHTML = "<div style='color:#666; text-align:center; padding:20px;'>No hay salas públicas. ¡Crea una!</div>";
        }
        snap.forEach(doc => {
            const d = doc.data();
            const card = document.createElement('div'); 
            card.className = 'host-card';
            card.innerHTML = `
                <div class="h-title">${d.host}</div>
                <div class="h-status">${d.players.length}/4</div>
                <div style="color:#aaa; font-size:0.9rem;">${d.song}</div>
                <button class="action" style="margin-top:10px; width:100%;" onclick="joinLobby('${doc.id}')">UNIRSE</button>
            `;
            list.appendChild(card);
        });
    });
}

function joinLobby(id) {
    db.collection("lobbies").doc(id).get().then(doc => {
        const d = doc.data();
        if(d.players.length >= 4) return notify("ERROR", "Sala llena", "error");
        
        db.collection("lobbies").doc(id).update({
            players: firebase.firestore.FieldValue.arrayUnion(user.name)
        }).then(() => {
            activeLobbyId = id;
            openModal('lobby');
            listenLobby(id);
        });
    });
}

function listenLobby(id) {
    db.collection("lobbies").doc(id).onSnapshot(doc => {
        if(!doc.exists) { leaveLobby(); return; } // Sala borrada
        const data = doc.data();
        
        // Render Players
        const pContainer = document.getElementById('lobby-players');
        pContainer.innerHTML = "";
        
        data.players.forEach(p => {
            const r = data.ready && data.ready[p];
            pContainer.innerHTML += `
                <div class="p-card ${r?'ready':''}">
                    <div class="p-av"></div>
                    <div>${p}</div>
                    <div class="p-status ${r?'r':''}">${r?'LISTO':'ESPERANDO'}</div>
                </div>
            `;
        });

        if(data.state === 'playing') {
            closeModal('lobby');
            notify("JUEGO", "El host inició la partida", "success");
            // Here you would implement song syncing
        }
    });
}

function toggleReady() {
    if(!activeLobbyId) return;
    isReady = !isReady;
    const btn = document.getElementById('btn-ready');
    btn.innerText = isReady ? "¡LISTO!" : "NO LISTO";
    btn.style.background = isReady ? "var(--good)" : "#333";
    btn.style.color = isReady ? "black" : "#888";
    
    const update = {};
    update[`ready.${user.name}`] = isReady;
    db.collection("lobbies").doc(activeLobbyId).update(update);
}

function leaveLobby() {
    if(activeLobbyId) {
        db.collection("lobbies").doc(activeLobbyId).update({
             players: firebase.firestore.FieldValue.arrayRemove(user.name)
        });
        activeLobbyId = null;
        isReady = false;
        closeModal('lobby');
    }
}
