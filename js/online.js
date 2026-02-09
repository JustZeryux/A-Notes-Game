/* === ONLINE SYSTEM === */
function initOnline() {
    peer = new Peer(null, { secure: true }); 
    peer.on('open', (id) => {
        myPeerId = id;
        if(db && user.name !== "Guest") {
            db.collection("users").doc(user.name).set({ peerId: id, online: true, lastSeen: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        }
    });
    peer.on('error', (err) => { console.error(err); });
    peer.on('connection', (c) => { 
        conn = c; 
        setupConnection(); 
    });
}

function sendFriendRequest() {
    const target = document.getElementById('friend-inp').value.trim();
    if(!target || target === user.name) return;
    db.collection("users").doc(target).get().then(doc => {
        if(doc.exists) {
            sendNotification(target, 'friend_req', 'Solicitud de Amistad', user.name + ' quiere ser tu amigo.');
            notify("Solicitud enviada a " + target);
        } else notify("Usuario no encontrado", "error");
    });
}

function openChatWithFriend() {
     if(selectedFriend) {
         closeModal('friend-profile');
         openOnline(true, selectedFriend); 
     }
}

function challengeFriend(target) {
    db.collection("users").doc(target).get().then(doc => {
        const data = doc.data();
        if(doc.exists && data.peerId) {
            sendNotification(target, 'challenge', '¡Desafío 1v1!', user.name + ' te desafía a un duelo.');
            notify("Desafío enviado a " + target + ". Esperando respuesta...");
        } else notify(target + " no está disponible", "error");
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

function acceptChallenge(target, notifId) {
    closeNotification(notifId);
     db.collection("users").doc(target).get().then(doc => {
        if(doc.exists && doc.data().peerId) {
            conn = peer.connect(doc.data().peerId);
            setupConnection();
        } else notify("El retador ya no está disponible.", "error");
    });
}

/* === ONLINE LOBBY === */
function openOnline(chatMode = false, chatPartner = null) {
    if(user.name === "Guest") return notify("Debes iniciar sesión", "error");
    
    const lobbyUi = document.getElementById('lobby-game-ui');
    const chatTitle = document.getElementById('chat-with-title');
    
    if(chatMode && chatPartner) {
        lobbyUi.style.display = 'none';
        chatTitle.innerText = "CHAT CON " + chatPartner.toUpperCase();
        initChatListener(chatPartner);
    } else {
        lobbyUi.style.display = 'block';
        chatTitle.innerText = "CHAT DE SALA";
    }
    openModal('online'); 
}

function setupConnection() {
    conn.on('open', () => { conn.send({ type: 'hello', name: user.name }); openOnline(); });
    conn.on('data', async (data) => {
        if(data.type === 'hello') {
            notify("Conectado con: " + data.name);
            document.getElementById('p2-name').innerText = data.name;
            document.getElementById('lobby-opp-name').innerText = data.name;
            initChatListener(data.name); 
        }
        if(data.type === 'chat') { addChatMsg(data.name, data.msg); }
        if(data.type === 'song_data') {
            notify("Recibiendo canción...");
            document.getElementById('opp-pick-name').innerText = data.name;
            document.getElementById('opp-pick-status').innerText = "¡Recibida!";
            document.getElementById('opp-pick-status').classList.add('ready-green');
            onlineState.oppPick = data.name;
            await saveReceivedSong(data.name, data.buffer);
            checkBothReady();
        }
        if(data.type === 'match_start') { startMatch(data.song); }
        if(data.type === 'score') {
            opponentScore = data.val;
            document.getElementById('p2-score').innerText = opponentScore.toLocaleString();
        }
    });
    conn.on('close', () => { notify("Conexión perdida.", "error"); closeLobby(); });
}

function closeLobby() {
    if(conn) conn.close();
    if(chatListener) chatListener();
    closeModal('online');
}

function initChatListener(oppName) {
    const users = [user.name, oppName].sort();
    currentChatRoom = users.join("_");
    document.getElementById('chat-box').innerHTML = ''; 
    if(chatListener) chatListener(); 
    chatListener = db.collection("chats").doc(currentChatRoom).collection("messages")
        .orderBy("timestamp").limit(30)
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if(change.type === "added") { addChatMsgUI(change.doc.data().user, change.doc.data().text); }
            });
        });
}

function sendChat() {
    const inp = document.getElementById('chat-inp');
    const txt = filterBadWords(inp.value);
    if(!txt || !currentChatRoom) return;
    db.collection("chats").doc(currentChatRoom).collection("messages").add({
        user: user.name, text: txt, timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    inp.value = "";
}

function addChatMsgUI(name, msg) {
    const box = document.getElementById('chat-box');
    const d = document.createElement('div'); d.className = 'chat-msg';
    d.innerHTML = `<b>${name}:</b> ${msg}`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
}

function addChatMsg(name, msg) {} 

function filterBadWords(text) {
    const bad = ["bobo", "tonto", "idiota", "noob", "ptm", "ctm", "verga", "puto", "mierda"];
    let clean = text;
    bad.forEach(w => { const reg = new RegExp(w, "gi"); clean = clean.replace(reg, "****"); });
    return clean;
}

async function handleOnlineFile(i) {
    if(i.files[0]) {
        const f = i.files[0];
        const name = f.name.replace(/\.[^/.]+$/, "");
        const ab = await f.arrayBuffer();
        document.getElementById('my-pick-name').innerText = name;
        document.getElementById('my-pick-status').innerText = "Enviando...";
        onlineState.myPick = name;
        await saveReceivedSong(name, ab.slice(0)); 
        conn.send({ type: 'song_data', name: name, buffer: ab });
        document.getElementById('my-pick-status').innerText = "¡Listo!";
        document.getElementById('my-pick-status').classList.add('ready-green');
        checkBothReady();
    }
}

async function saveReceivedSong(name, buffer) {
    if(!user.songs.find(s=>s.id===name)){ user.songs.push({id:name}); save(); }
    saveSongToDB(name, buffer); 
    const audioCtxBuffer = await st.ctx.decodeAudioData(buffer.slice(0)); 
    const map = genMap(audioCtxBuffer, 4); 
    ramSongs = ramSongs.filter(s=>s.id!==name);
    ramSongs.push({id:name, buf:audioCtxBuffer, map:map});
}

function checkBothReady() {
    if(onlineState.myPick && onlineState.oppPick) {
        const msg = document.getElementById('roulette-msg');
        msg.innerText = "¡AMBOS LISTOS! GIRA LA RULETA...";
        if(myPeerId > conn.peer) {
            setTimeout(() => {
                const picks = [onlineState.myPick, onlineState.oppPick];
                const winner = picks[Math.floor(Math.random() * picks.length)];
                conn.send({ type: 'match_start', song: winner });
                startMatch(winner);
            }, 2000);
        }
    }
}

function startMatch(songName) {
    document.getElementById('roulette-msg').innerText = "JUGANDO: " + songName;
    setTimeout(() => { closeModal('online'); curSongId = songName; startGame(4); }, 1000);
}
