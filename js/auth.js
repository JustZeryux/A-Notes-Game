function loadUser(uid) {
    db.collection("users").doc(uid).onSnapshot(doc => {
        if(doc.exists) {
            user = doc.data();
            user.uid = uid;
            updateProfileUI();
            localStorage.setItem("last_uid", uid);
            checkInbox();
        }
    });
}

function loginGoogle() {
    if(!db) return notify("Sistema", "Error: Firebase no conectado", "error");
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider).then(result => {
        const u = result.user;
        const name = (u.displayName ? u.displayName.replace(/\s/g, '') : u.email.split('@')[0]).substring(0,15);
        handleAuthUser(name, true, u.uid);
    }).catch(e => notify("Login", "Error Google: " + e.message, "error"));
}

function handleAuthUser(name, isGoogle, uid) {
    const docId = uid || name; 
    db.collection("users").doc(docId).get().then(doc => {
        if(doc.exists) {
            loadUser(docId);
            closeModal('profile');
            notify("ACCESO", "¡Bienvenido de nuevo, " + name + "!", "success");
        } else {
            const newUser = {
                name: name, 
                pass: isGoogle ? "google-auth" : "local", 
                xp:0, lvl:1, sp:0, pp:0, plays:0, score:0, 
                friends:[], requests:[], online:true, 
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            };
            db.collection("users").doc(docId).set(newUser).then(() => {
                db.collection("leaderboard").doc(docId).set({
                    name:name, pp:0, score:0, lvl:1, avatarData: null
                });
                loadUser(docId);
                closeModal('profile');
                notify("REGISTRO", "Cuenta creada: " + name, "success");
            });
        }
    });
}

function login() {
    const u = document.getElementById('l-user').value;
    const p = document.getElementById('l-pass').value;
    if(!db) {
        // Fallback Local
        const d = localStorage.getItem(DB_KEY+u);
        if(d){const o=JSON.parse(d).user;if(o.pass===p){user=o;finishLogin(u);}else notify("Contraseña incorrecta","error");}else notify("Usuario local no encontrado","error");
        return;
    }
    db.collection("users").where("name", "==", u).where("pass", "==", p).get().then(snap => {
        if(!snap.empty) {
            const uid = snap.docs[0].id;
            loadUser(uid);
            closeModal('profile');
            notify("ACCESO", "Conectado como " + u, "success");
        } else {
            notify("ERROR", "Usuario o contraseña incorrectos", "error");
        }
    });
}

function register() {
    const u = document.getElementById('l-user').value;
    const p = document.getElementById('l-pass').value;
    if(!u || !p) return notify("ERROR", "Faltan datos", "error");
    
    db.collection("users").where("name", "==", u).get().then(snap => {
        if(!snap.empty) {
            notify("ERROR", "El nombre de usuario ya existe", "error");
        } else {
            handleAuthUser(u, false, u); 
        }
    });
}

function logout() {
    if(user.uid && db) db.collection("users").doc(user.uid).update({ online: false });
    if(auth) auth.signOut();
    localStorage.removeItem(LAST_KEY);
    location.reload();
}

function finishLogin(name) {
    localStorage.setItem(LAST_KEY, name);
    location.reload();
}

function changePassword() {
     const newPass = document.getElementById('new-pass').value;
     if(!newPass || newPass.length < 4) return notify("Contraseña muy corta", "error");
     if(user.pass === "google-auth") return notify("No puedes cambiar la contraseña de una cuenta Google aquí", "error");
     
     db.collection("users").doc(user.uid).update({ pass: newPass }).then(() => {
         notify("Contraseña actualizada", "success");
         document.getElementById('new-pass').value = "";
     });
}

function updateFirebaseScore() {
    if(db && user.uid) {
        db.collection("leaderboard").doc(user.uid).set({
            name: user.name, pp: user.pp, score: user.score, lvl: user.lvl, avatarData: user.avatarData || null
        }, { merge: true });
        db.collection("users").doc(user.uid).set({ name: user.name, score:user.score, pp:user.pp, lvl:user.lvl }, { merge: true });
    }
}
