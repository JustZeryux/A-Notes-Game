/* === UPDATE CHECKER === */
function checkUpdate() {
    if(!db) return;
    db.collection("system").doc("status").get().then(doc => {
        if(doc.exists) {
            const data = doc.data();
            if(data.latestVersion > CURRENT_VERSION) {
                 notifyInteractive("update_note", "¡ACTUALIZACIÓN!", "Nueva versión disponible. Por favor recarga la página.", 10000);
            }
        }
    });
}

/* === AUTH === */
function loginGoogle() {
    if(!db) return notify("Error: Firebase no conectado", "error");
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider).then(result => {
        const u = result.user;
        const name = (u.displayName ? u.displayName.replace(/\s/g, '') : u.email.split('@')[0]).substring(0,15);
        handleAuthUser(name, true);
    }).catch(e => notify("Error Google: " + e.message, "error"));
}

function handleAuthUser(name, isGoogle) {
    db.collection("users").doc(name).get().then(doc => {
        if(doc.exists) {
            user = {...user, ...doc.data()};
            finishLogin(name);
        } else {
            // NEW USER
            const newUser = {
                name: name, pass: isGoogle ? "google-auth" : null, xp:0, lvl:1, pp:0, plays:0, score:0, 
                friends:[], avatarData:null, online:true, lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            };
            db.collection("users").doc(name).set(newUser);
            db.collection("leaderboard").doc(name).set({name:name, pp:0, score:0, lvl:1});
            user = newUser;
            finishLogin(name);
            notify("¡Bienvenido, " + name + "!", "success");
        }
    });
}

function login() {
    const u = document.getElementById('l-user').value;
    const p = document.getElementById('l-pass').value;
    if(!db) {
        // Local fallback
        const d = localStorage.getItem(DB_KEY+u);
        if(d){const o=JSON.parse(d).user;if(o.pass===p){user=o;finishLogin(u);}else notify("Contraseña incorrecta","error");}else notify("Usuario local no encontrado","error");
        return;
    }
    db.collection("users").doc(u).get().then(doc => {
        if(doc.exists) {
            const data = doc.data();
            if(data.pass === p && data.pass !== "google-auth") {
                user = {...user, ...data};
                finishLogin(u);
            } else notify("Contraseña incorrecta o usa Google", "error");
        } else notify("Usuario no encontrado", "error");
    });
}

function register() {
    const u = document.getElementById('l-user').value;
    const p = document.getElementById('l-pass').value;
    if(!u || !p) return notify("Datos incompletos", "error");
    if(!db) return notify("No hay conexión a la base de datos", "error");

    db.collection("users").doc(u).get().then(doc => {
        if(doc.exists) notify("El usuario ya existe", "error");
        else {
            handleAuthUser(u, false); 
        }
    });
}

function finishLogin(name) {
    localStorage.setItem(LAST_KEY, name);
    location.reload();
}

function changePassword() {
     const newPass = document.getElementById('new-pass').value;
     if(!newPass || newPass.length < 4) return notify("Contraseña muy corta", "error");
     if(user.pass === "google-auth") return notify("No puedes cambiar la contraseña de una cuenta Google aquí", "error");
     
     db.collection("users").doc(user.name).update({ pass: newPass }).then(() => {
         user.pass = newPass; save();
         notify("Contraseña actualizada", "success");
         document.getElementById('new-pass').value = "";
     });
}

/* === PERSISTENCIA INDEXEDDB === */
function initDB() {
    return new Promise((resolve) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = e => { if (!e.target.result.objectStoreNames.contains(DB_STORE)) e.target.result.createObjectStore(DB_STORE, { keyPath: "id" }); };
        req.onsuccess = e => { idb = e.target.result; loadAllSongs(); resolve(); };
    });
}
function saveSongToDB(id, buf) { if(!idb) return; const tx = idb.transaction(DB_STORE, "readwrite"); tx.objectStore(DB_STORE).put({ id: id, buffer: buf }); }
function loadAllSongs() {
    if(!idb) return;
    const tx = idb.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).getAll();
    req.onsuccess = async () => {
        const results = req.result;
        if(!st.ctx) st.ctx = new (window.AudioContext||window.webkitAudioContext)();
        for(const item of results) {
            try {
                if(item.buffer.byteLength === 0) continue;
                const decoded = await st.ctx.decodeAudioData(item.buffer.slice(0)); 
                const map = genMap(decoded, 4);
                if(!ramSongs.find(s => s.id === item.id)) ramSongs.push({ id: item.id, buf: decoded, map: map });
                if(!user.songs.find(s => s.id === item.id)) user.songs.push({ id: item.id });
            } catch(e) { console.error("Error DB:", e); }
        }
        renderMenu(); 
    };
}

/* === DATA & AUTH === */
function loadData(){
    const l=localStorage.getItem(LAST_KEY);
    if(l){ const d=JSON.parse(localStorage.getItem(DB_KEY+l)); if(d){ user={...user, ...d.user}; if(d.cfg)cfg={...cfg,...d.cfg}; } }
    applyCfg();
    updUI();
}
function save(){ if(user.name!=="Guest") localStorage.setItem(DB_KEY+user.name, JSON.stringify({user,cfg})); updUI(); }
function logout(){ 
    if(db && user.name !== "Guest") db.collection("users").doc(user.name).update({ online: false });
    localStorage.removeItem(LAST_KEY); 
    location.reload(); 
}

/* === FIREBASE RANKING === */
function openLeaderboard() {
    if(db) {
        db.collection("leaderboard").orderBy("pp", "desc").limit(50)
        .onSnapshot((querySnapshot) => {
            const l = document.getElementById('rank-list'); l.innerHTML=''; 
            let i = 1;
            querySnapshot.forEach((doc) => {
                const d = doc.data();
                const tr = document.createElement('tr');
                if(d.name===user.name) {
                    tr.className='rank-row-me';
                    document.getElementById('p-global-rank').innerText = "#" + i;
                    if(d.pp > user.pp) { user.pp = d.pp; save(); }
                }
                let avHtml = '<div class="rank-av"></div>';
                if(d.avatarData) avHtml = `<div class="rank-av" style="background-image:url(${d.avatarData})"></div>`;
                
                tr.innerHTML = `<td>#${i++}</td><td>${avHtml}${d.name}</td><td style="color:var(--blue)">${d.pp}pp</td>`;
                l.appendChild(tr);
            });
        });
        openModal('rank');
    } else {
        notify("Firebase no configurado. Mostrando local.", "error");
        const l = document.getElementById('rank-list'); l.innerHTML=''; 
        const all = [...BOTS, {n:user.name, p:user.pp}];
        all.sort((a,b)=>b.p - a.p);
        all.forEach((p,i)=>{
            const tr = document.createElement('tr');
            if(p.n===user.name) tr.className='rank-row-me';
            tr.innerHTML = `<td>#${i+1}</td><td><div class="rank-av"></div>${p.n}</td><td style="color:var(--blue)">${p.p}pp</td>`;
            l.appendChild(tr);
        });
        openModal('rank');
    }
}

function updateFirebaseScore() {
    if(db && user.name !== "Guest") {
        db.collection("leaderboard").doc(user.name).set({
            name: user.name, pp: user.pp, score: user.score, lvl: user.lvl, avatarData: user.avatarData
        }, { merge: true });
        db.collection("users").doc(user.name).set({ name: user.name, score:user.score, pp:user.pp, lvl:user.lvl }, { merge: true });
    }
}
