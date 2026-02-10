/* === AUTH.JS (CORREGIDO Y ROBUSTO) === */

// Configurar persistencia para que no se desconecte al recargar
if(firebase.auth) {
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .catch((error) => console.error("Error persistencia:", error));
}

function checkUpdate() {
    if(!db) return;
    db.collection("system").doc("status").get().then(doc => {
        if(doc.exists && doc.data().latestVersion > CURRENT_VERSION) {
             notifyInteractive("update_note", "¡ACTUALIZACIÓN!", "Nueva versión disponible. Por favor recarga la página.", 10000);
        }
    });
}

// === SISTEMA DE LOGIN GOOGLE ===
function loginGoogle() {
    if(!db) return notify("Error: Firebase no conectado", "error");
    const provider = new firebase.auth.GoogleAuthProvider();
    
    firebase.auth().signInWithPopup(provider).then(async (result) => {
        const u = result.user;
        // Limpiamos el nombre de caracteres extraños para usarlo como ID
        const cleanName = (u.displayName ? u.displayName.replace(/[^a-zA-Z0-9]/g, '') : u.email.split('@')[0]).substring(0,15);
        await handleAuthUser(cleanName, true);
    }).catch(e => notify("Error Google: " + e.message, "error"));
}

// === MANEJO DE USUARIO (EL ARREGLO IMPORTANTE) ===
async function handleAuthUser(name, isGoogle) {
    try {
        // Mostrar carga para que el usuario espere
        notify("Verificando cuenta...", "info", 2000);
        
        const docRef = db.collection("users").doc(name);
        const doc = await docRef.get();

        if(doc.exists) {
            let data = doc.data();
            // Migración de datos viejos si faltan campos
            if(data.sp === undefined) data.sp = 0;
            if(data.scores === undefined) data.scores = {};
            
            user = {...user, ...data};
            finishLogin(name);
        } else {
            // CREAR NUEVO USUARIO
            const newUser = {
                name: name, 
                pass: isGoogle ? "google-auth" : null, // Si es Google, no guardamos pass
                xp:0, lvl:1, pp:0, sp:0, plays:0, score:0, 
                friends:[], avatarData:null, 
                online:true, 
                lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                scores: {}
            };

            // AWAIT: ESPERAR A QUE SE GUARDE ANTES DE CONTINUAR
            await docRef.set(newUser);
            await db.collection("leaderboard").doc(name).set({name:name, pp:0, score:0, lvl:1});
            
            user = newUser;
            notify("¡Cuenta creada con éxito!", "success");
            
            // Esperar 1.5 segundos para asegurar que Firebase propagó los datos
            setTimeout(() => finishLogin(name), 1500); 
        }
    } catch (e) {
        console.error(e);
        notify("Error en base de datos: " + e.message, "error");
    }
}

function login() {
    const u = document.getElementById('l-user').value.trim();
    const p = document.getElementById('l-pass').value.trim();
    
    if(!u || !p) return notify("Ingresa usuario y contraseña", "error");

    db.collection("users").doc(u).get().then(doc => {
        if(doc.exists) {
            const data = doc.data();
            if(data.pass === "google-auth") {
                notify("Esta cuenta usa Google. Usa el botón de Google.", "error");
            } else if(data.pass === p) {
                user = {...user, ...data};
                finishLogin(u);
            } else {
                notify("Contraseña incorrecta", "error");
            }
        } else {
            notify("Usuario no encontrado", "error");
        }
    }).catch(e => notify("Error de conexión", "error"));
}

function register() {
    const u = document.getElementById('l-user').value.trim();
    const p = document.getElementById('l-pass').value.trim();
    
    if(!u || !p) return notify("Datos incompletos", "error");
    if(/[^a-zA-Z0-9]/.test(u)) return notify("El usuario solo puede tener letras y números", "error");

    db.collection("users").doc(u).get().then(doc => {
        if(doc.exists) notify("El usuario ya existe", "error");
        else {
            createLocalUser(u, p);
        }
    });
}

async function createLocalUser(name, pass) {
    try {
        notify("Creando usuario...", "info");
        const newUser = {
            name: name, pass: pass, xp:0, lvl:1, pp:0, sp:0, plays:0, score:0, 
            friends:[], avatarData:null, online:true, lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
            scores: {}
        };
        // AWAIT CRÍTICO AQUÍ
        await db.collection("users").doc(name).set(newUser);
        await db.collection("leaderboard").doc(name).set({name:name, pp:0, score:0, lvl:1});
        
        user = newUser;
        notify("Registrado con éxito. Entrando...", "success");
        setTimeout(() => finishLogin(name), 1500);
    } catch(e) { notify("Error al registrar: " + e.message, "error"); }
}

function finishLogin(name) {
    localStorage.setItem(LAST_KEY, name);
    location.reload();
}

function logout(){ 
    if(db && user.name !== "Guest") db.collection("users").doc(user.name).update({ online: false });
    localStorage.removeItem(LAST_KEY); 
    if(firebase.auth) firebase.auth().signOut();
    location.reload(); 
}

/* FUNCIONES DE DB ADICIONALES */
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
    } else { notify("Firebase no configurado", "error"); }
}

function updateFirebaseScore() {
    if(db && user.name !== "Guest") {
        db.collection("leaderboard").doc(user.name).set({
            name: user.name, pp: user.pp, score: user.score, lvl: user.lvl, avatarData: user.avatarData
        }, { merge: true });
        db.collection("users").doc(user.name).set({ name: user.name, score:user.score, pp:user.pp, lvl:user.lvl, sp:user.sp, scores: user.scores }, { merge: true });
    }
}
