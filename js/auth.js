/* === AUTH SYSTEM (FIXED) === */

// Configurar persistencia para que la sesión no se cierre al recargar
if (firebase.auth) {
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .catch((error) => console.error("Error persistencia:", error));
}

// Chequear actualizaciones del juego
function checkUpdate() {
    if (!db) return;
    db.collection("system").doc("status").get().then(doc => {
        if (doc.exists && doc.data().latestVersion > CURRENT_VERSION) {
            notifyInteractive("update_note", "¡ACTUALIZACIÓN!", "Nueva versión disponible. Por favor recarga la página.", 10000);
        }
    });
}

/* === FUNCIÓN DE GUARDADO (CRÍTICA) === */
function save() {
    // 1. Guardar copia rápida en navegador
    const saveData = { user: user, cfg: cfg };
    
    if (user.name !== "Guest") {
        localStorage.setItem(DB_KEY + user.name, JSON.stringify(saveData));
        
        // 2. Guardar en la Nube (Firestore)
        if (db) {
            db.collection("users").doc(user.name).set({
                name: user.name,
                score: user.score,
                pp: user.pp,
                lvl: user.lvl,
                sp: user.sp,
                scores: user.scores || {},
                avatarData: user.avatarData || null,
                bg: user.bg || null,
                savedCfg: cfg // Guardamos tu configuración en la nube también
            }, { merge: true }).then(() => {
                console.log("Progreso guardado en nube.");
            }).catch(e => console.error("Error guardando en nube:", e));
        }
    } else {
        // Si es Guest, solo guardamos la config localmente
        localStorage.setItem(DB_KEY + "Guest_CFG", JSON.stringify(cfg));
    }
    
    if(typeof updUI === 'function') updUI();
}

/* === CARGA DE DATOS (LOGIN AUTOMÁTICO) === */
async function loadData() {
    // Mostrar pantalla de carga para evitar ver "Guest" por error
    const loader = document.getElementById('loading-overlay');
    if(loader) {
        loader.style.display = 'flex';
        document.getElementById('loading-text').innerText = "Conectando...";
    }

    // 1. Preguntar a Firebase si ya hay sesión iniciada
    firebase.auth().onAuthStateChanged(async (u) => {
        if (u) {
            // USUARIO DETECTADO (Google o Email)
            console.log("Sesión activa detectada:", u.email);
            // Limpiar nombre para usarlo como ID
            const cleanName = (u.displayName ? u.displayName.replace(/[^a-zA-Z0-9]/g, '') : u.email.split('@')[0]).substring(0, 15);
            await fetchUserProfile(cleanName);
        } else {
            // NO HAY SESIÓN FIREBASE -> Checar si hay sesión local antigua
            const localName = localStorage.getItem(LAST_KEY);
            if (localName && localName !== "Guest") {
                console.log("Intentando login local legacy:", localName);
                await fetchUserProfile(localName);
            } else {
                console.log("Entrando como Invitado");
                loadGuestConfig();
                finishLoad();
            }
        }
    });
}

// Descargar perfil de la base de datos
async function fetchUserProfile(name) {
    if (!db) { finishLoad(); return; }

    try {
        const doc = await db.collection("users").doc(name).get();
        if (doc.exists) {
            const data = doc.data();
            // Rellenar datos faltantes si la cuenta es vieja
            if (data.sp === undefined) data.sp = 0;
            if (data.scores === undefined) data.scores = {};

            user = { ...user, ...data };
            
            // Cargar configuración si existe
            if(data.savedCfg) cfg = { ...cfg, ...data.savedCfg };
            else applyCfg(); // Aplicar defaults

            localStorage.setItem(LAST_KEY, name);
            notify("Bienvenido de nuevo, " + name, "success");
        } else {
            // El usuario existe en Auth pero no en DB (Raro, lo recreamos)
            await handleAuthUser(name, true);
            return;
        }
    } catch (e) {
        console.error("Error cargando perfil:", e);
        notify("Error de red. Jugando offline.", "error");
        loadGuestConfig();
    }
    finishLoad();
}

function loadGuestConfig() {
    const localCfg = localStorage.getItem(DB_KEY + "Guest_CFG");
    if (localCfg) cfg = { ...cfg, ...JSON.parse(localCfg) };
    user.name = "Guest";
}

function finishLoad() {
    if(typeof applyCfg === 'function') applyCfg();
    if(typeof updUI === 'function') updUI();
    const loader = document.getElementById('loading-overlay');
    if(loader) loader.style.display = 'none';
    if(typeof renderMenu === 'function') renderMenu();
}

/* === LOGIN Y REGISTRO === */

function loginGoogle() {
    if (!db) return notify("Error: Firebase no conectado", "error");
    const provider = new firebase.auth.GoogleAuthProvider();

    firebase.auth().signInWithPopup(provider).then((result) => {
        // onAuthStateChanged se encargará del resto automáticamente
    }).catch(e => notify("Error Google: " + e.message, "error"));
}

async function handleAuthUser(name, isGoogle) {
    try {
        const docRef = db.collection("users").doc(name);
        const doc = await docRef.get();

        if (doc.exists) {
            // Ya existe, recargar para que onAuthStateChanged lo tome
            location.reload();
        } else {
            // Crear usuario nuevo
            const newUser = {
                name: name,
                pass: isGoogle ? "google-auth" : null,
                xp: 0, lvl: 1, pp: 0, sp: 0, plays: 0, score: 0,
                friends: [], avatarData: null,
                online: true,
                lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                scores: {}
            };
            
            // AWAIT IMPORTANTE: Esperar confirmación de escritura
            await docRef.set(newUser);
            await db.collection("leaderboard").doc(name).set({ name: name, pp: 0, score: 0, lvl: 1 });

            user = newUser;
            notify("Cuenta creada con éxito", "success");
            
            // Esperar un poco para asegurar propagación antes de recargar
            setTimeout(() => {
                localStorage.setItem(LAST_KEY, name);
                location.reload();
            }, 1500);
        }
    } catch (e) {
        console.error(e);
        notify("Error DB: " + e.message, "error");
    }
}

function login() {
    const u = document.getElementById('l-user').value.trim();
    const p = document.getElementById('l-pass').value.trim();

    if (!u || !p) return notify("Ingresa datos", "error");

    db.collection("users").doc(u).get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            if (data.pass === "google-auth") {
                notify("Usa el botón de Google", "error");
            } else if (data.pass === p) {
                localStorage.setItem(LAST_KEY, u);
                location.reload();
            } else {
                notify("Contraseña incorrecta", "error");
            }
        } else {
            notify("Usuario no encontrado", "error");
        }
    }).catch(e => notify("Error conexión", "error"));
}

function register() {
    const u = document.getElementById('l-user').value.trim();
    const p = document.getElementById('l-pass').value.trim();

    if (!u || !p) return notify("Datos incompletos", "error");
    // Validación de seguridad para IDs
    if (/[^a-zA-Z0-9]/.test(u)) return notify("Usuario solo letras y números", "error");

    db.collection("users").doc(u).get().then(doc => {
        if (doc.exists) notify("Usuario ya existe", "error");
        else createLocalUser(u, p);
    });
}

async function createLocalUser(name, pass) {
    try {
        notify("Creando usuario...", "info");
        const newUser = {
            name: name, pass: pass, xp: 0, lvl: 1, pp: 0, sp: 0, plays: 0, score: 0,
            friends: [], avatarData: null, online: true, lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
            scores: {}
        };
        
        await db.collection("users").doc(name).set(newUser);
        await db.collection("leaderboard").doc(name).set({ name: name, pp: 0, score: 0, lvl: 1 });

        notify("Registrado. Iniciando...", "success");
        setTimeout(() => {
            localStorage.setItem(LAST_KEY, name);
            location.reload();
        }, 1500);
    } catch (e) { notify("Error al registrar", "error"); }
}

function logout() {
    if (db && user.name !== "Guest") db.collection("users").doc(user.name).update({ online: false });
    localStorage.removeItem(LAST_KEY);
    if (firebase.auth) firebase.auth().signOut();
    location.reload();
}

/* === FUNCIONES EXTRA (RANKING, ETC) === */
function openLeaderboard() {
    if (db) {
        db.collection("leaderboard").orderBy("pp", "desc").limit(50)
            .onSnapshot((querySnapshot) => {
                const l = document.getElementById('rank-list'); l.innerHTML = '';
                let i = 1;
                querySnapshot.forEach((doc) => {
                    const d = doc.data();
                    const tr = document.createElement('tr');
                    if (d.name === user.name) {
                        tr.className = 'rank-row-me';
                        document.getElementById('p-global-rank').innerText = "#" + i;
                        if (d.pp > user.pp) { user.pp = d.pp; save(); }
                    }
                    let avHtml = '<div class="rank-av"></div>';
                    if (d.avatarData) avHtml = `<div class="rank-av" style="background-image:url(${d.avatarData})"></div>`;
                    tr.innerHTML = `<td>#${i++}</td><td>${avHtml}${d.name}</td><td style="color:var(--blue)">${d.pp}pp</td>`;
                    l.appendChild(tr);
                });
            });
        openModal('rank');
    } else {
        notify("Firebase no configurado", "error");
    }
}

function updateFirebaseScore() {
    if (db && user.name !== "Guest") {
        db.collection("leaderboard").doc(user.name).set({
            name: user.name, pp: user.pp, score: user.score, lvl: user.lvl, avatarData: user.avatarData
        }, { merge: true });
        db.collection("users").doc(user.name).set({ name: user.name, score: user.score, pp: user.pp, lvl: user.lvl, sp: user.sp, scores: user.scores }, { merge: true });
    }
}

function changePassword() {
    const newPass = document.getElementById('new-pass').value;
    if (!newPass || newPass.length < 4) return notify("Contraseña muy corta", "error");
    if (user.pass === "google-auth") return notify("Cuenta Google no permite cambio de pass", "error");

    db.collection("users").doc(user.name).update({ pass: newPass }).then(() => {
        user.pass = newPass; save();
        notify("Contraseña actualizada", "success");
        document.getElementById('new-pass').value = "";
    });
}

// === COMPATIBILIDAD CON MAIN.JS (NO BORRAR) ===
// Estas funciones se mantienen vacías o como puente para evitar errores si main.js las llama
async function initDB() { return Promise.resolve(); } 
function saveSongToDB() {}
function loadAllSongs() {}
