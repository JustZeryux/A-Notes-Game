/* === ONLINE SYSTEM === */
function initOnline() {
    peer = new Peer(null, { secure: true }); 
    peer.on('open', (id) => {
        myPeerId = id;
        if(db && user.uid) {
            db.collection("users").doc(user.uid).set({ peerId: id, online: true, lastSeen: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        }
    });
    peer.on('error', (err) => { console.error(err); notify("Error Online: " + err.type, "error"); });
    peer.on('connection', (c) => { conn = c; setupConnection(); notify("¡Jugador conectado!", "success"); enterLobby(); });
}

function openOnline() {
    if(user.name === "Guest") return notify("Debes iniciar sesión", "error");
    openModal('online'); 
}

function openFriends() {
    if(user.name === "Guest") return notify("Debes iniciar sesión", "error");
    if(!db) return notify("Error de conexión", "error");
    
    const reqL = document.getElementById('req-list');
    const friL = document.getElementById('friend-list');

    db.collection("users").doc(user.uid).onSnapshot(doc => {
        const data = doc.data();
        if(data) {
            reqL.innerHTML = '';
            // Requests handling (simplified visual)
            
            friL.innerHTML = '';
            if(data.friends && data.friends.length > 0) {
                data.friends.forEach(fName => {
                    db.collection("users").where("name", "==", fName).get().then(snap => {
                        if(!snap.empty) {
                            const fData = snap.docs[0].data();
                            const fUid = snap.docs[0].id;
                            const now = Math.floor(Date.now() / 1000);
                            const last = fData.lastSeen ? fData.lastSeen.seconds : 0;
                            const isOn = (now - last) < 40; 
                            
                            const d = document.createElement('div'); d.className='friend-row';
                            d.onclick = () => showProfile(fName, fData, isOn, fUid);
                            
                            let avStyle = fData.avatarData ? `background-image:url(${fData.avatarData})` : '';
                            d.innerHTML = `<div style="display:flex;align-items:center;"><div class="friend-status ${isOn?'online':''}"></div><div class="f-row-av" style="${avStyle}"></div><span class="friend-row-name">${fName}</span></div>`;
                            friL.appendChild(d);
                        }
                    });
                });
            } else { friL.innerHTML = '<div style="color:#666; padding:20px;">No tienes amigos aún.</div>'; }
        }
    });
    openModal('friends');
}

function listenNotifications() {
    if(!user.uid) return;
    db.collection("users").doc(user.uid).collection("notifications").where("read","==",false)
        .onSnapshot(snap => {
            snap.docChanges().forEach(c => {
                if(c.type === 'added') {
                    const n = c.doc.data();
                    handleNotification(c.doc.id, n);
                }
            });
        });
}

function handleNotification(id, data) {
    db.collection("users").doc(user.uid).collection("notifications").doc(id).update({read:true});
    let html = data.body;
    if(data.type === 'friend_req') {
        html += `<div class="notify-actions"><button class="notify-btn btn-yes" onclick="respondFriend('${data.from}', true, '${id}')">ACEPTAR</button><button class="notify-btn btn-no" onclick="respondFriend('${data.from}', false, '${id}')">RECHAZAR</button></div>`;
        notifyInteractive(id, data.title, html, 15000);
    } else if (data.type === 'challenge') {
        html += `<div class="notify-actions"><button class="notify-btn btn-yes" onclick="acceptChallenge('${data.fromUid}', '${id}')">ACEPTAR</button><button class="notify-btn btn-no" onclick="closeNotif('${id}')">RECHAZAR</button></div>`;
        notifyInteractive(id, data.title, html, 10000);
    } else {
        notify(data.title, data.body);
    }
}

function sendFriendRequest() {
    const target = document.getElementById('friend-inp').value.trim();
    if(!target || target === user.name) return;
    db.collection("users").where("name", "==", target).get().then(snap => {
        if(!snap.empty) {
            const tid = snap.docs[0].id;
            sendNotification(tid, 'friend_req', 'Solicitud de Amistad', `${user.name} quiere ser tu amigo.`);
            notify("Solicitud enviada a " + target, "success");
        } else notify("Usuario no encontrado", "error");
    });
}

function respondFriend(targetName, accept, nid) {
    closeNotif(nid);
    if(accept) {
        const batch = db.batch();
        batch.update(db.collection("users").doc(user.uid), { friends: firebase.firestore.FieldValue.arrayUnion(targetName) });
        // Need target UID for reverse update
        db.collection("users").where("name", "==", targetName).get().then(snap => {
            if(!snap.empty) {
                const tid = snap.docs[0].id;
                batch.update(db.collection("users").doc(tid), { friends: firebase.firestore.FieldValue.arrayUnion(user.name) });
                batch.commit().then(() => notify("¡Ahora eres amigo de " + targetName + "!", "success"));
            }
        });
    }
}

function showProfile(name, data, isOnline, uid) {
    currentFriendView = { name: name, uid: uid }; 
    document.getElementById('fp-name').innerText = name;
    document.getElementById('fp-pp').innerText = data.pp || 0;
    document.getElementById('fp-plays').innerText = data.plays || 0;
    document.getElementById('fp-lvl').innerText = "LVL " + (data.lvl || 1);
    
    if(data.avatarData) document.getElementById('fp-av').style.backgroundImage = `url(${data.avatarData})`;
    else document.getElementById('fp-av').style.backgroundImage = '';

    const btnChal = document.getElementById('btn-challenge');
    const statusTxt = document.getElementById('fp-status-text');

    if(isOnline) {
        statusTxt.innerText = "En Línea"; statusTxt.style.color = "var(--good)";
        btnChal.disabled = false;
        btnChal.onclick = () => challengeFriend(uid);
    } else {
        statusTxt.innerText = "Desconectado"; statusTxt.style.color = "#666";
        btnChal.disabled = true;
    }
    closeModal('friends');
    openModal('friend-profile');
}

function challengeFriend(fUid) {
    db.collection("users").doc(fUid).get().then(doc => {
        if(doc.exists && doc.data().peerId) {
            sendNotification(fUid, 'challenge', '¡Desafío 1v1!', user.name + ' te desafía a un duelo.');
            notify("Desafío enviado...", "info");
        }
    });
}

function acceptChallenge(uid, nid) {
    closeNotif(nid);
    db.collection("users").doc(uid).get().then(doc => {
        if(doc.exists && doc.data().peerId) {
            conn = peer.connect(doc.data().peerId);
            setupConnection();
        }
    });
}

function sendNotification(targetUid, type, title, body) {
    db.collection("users").doc(targetUid).collection("notifications").add({
        type: type, title: title, body: body, from: user.name, fromUid: user.uid, read: false, timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
}

/* === CHAT FLOTANTE === */
function openFloatingChat(friendName) {
    closeModal('friend-profile');
    if(openChats.includes(friendName)) return;
    openChats.push(friendName);

    const dock = document.getElementById('chat-dock');
    const win = document.createElement('div');
    win.className = 'chat-window'; win.id = 'win-'+friendName;
    win.innerHTML = `
        <div class="chat-header" onclick="toggleChatWin('${friendName}')">
            <span>${friendName}</span> 
            <span onclick="closeChatWin('${friendName}', event)">X</span>
        </div>
        <div class="chat-body" id="cb-${friendName}"></div>
        <div class="chat-input-area">
            <input class="chat-inp" id="ci-${friendName}" placeholder="Mensaje..." onkeydown="if(event.key==='Enter') sendChatMsg('${friendName}')">
        </div>
    `;
    dock.appendChild(win);
    listenChat(friendName);
}

function toggleChatWin(name) {
    const w = document.getElementById('win-'+name);
    w.classList.toggle('cw-minimized');
}

function closeChatWin(name, e) {
    e.stopPropagation();
    const w = document.getElementById('win-'+name);
    w.remove();
    openChats = openChats.filter(n => n !== name);
}

function sendChatMsg(targetName) {
    const inp = document.getElementById(`ci-${targetName}`);
    const text = filterBadWords(inp.value);
    if(!text) return;
    
    const chatId = [user.name, targetName].sort().join("_");
    db.collection("chats").doc(chatId).collection("msgs").add({
        from: user.name, text: text, time: Date.now()
    });
    inp.value = "";
}

function listenChat(targetName) {
    const chatId = [user.name, targetName].sort().join("_");
    db.collection("chats").doc(chatId).collection("msgs").orderBy("time", "asc").limit(50)
        .onSnapshot(snap => {
            const div = document.getElementById(`cb-${targetName}`);
            if(!div) return;
            div.innerHTML = "";
            snap.forEach(doc => {
                const d = doc.data();
                const msg = document.createElement('div');
                msg.className = `chat-msg ${d.from === user.name ? 'mine' : ''}`;
                msg.innerText = d.text;
                div.appendChild(msg);
            });
            div.scrollTop = div.scrollHeight;
        });
}

function openChatWithFriend() {
    if(currentFriendView) {
        openFloatingChat(currentFriendView.name);
    }
}
