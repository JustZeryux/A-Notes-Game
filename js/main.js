/* === MAIN INITIALIZATION (FIXED STARTUP) === */

// Cazador de errores global para debug
window.onerror = function(message, source, lineno, colno, error) {
    console.error("Error Global:", message, "en línea", lineno);
    // No usamos alert para no bloquear el hilo principal si es un error menor
    return false; 
};

window.onload = async () => { 
    console.log("Iniciando sistema...");

    // Verificar si las librerías críticas cargaron
    if (typeof firebase === 'undefined') {
        alert("Error: Firebase no cargó. Revisa tu conexión.");
        return;
    }

    // Esperar un momento breve para asegurar que globals.js se procesó
    if (typeof user === 'undefined' || typeof cfg === 'undefined') {
        console.warn("Variables globales tardando en cargar...");
        await new Promise(r => setTimeout(r, 100)); // Espera 100ms
    }

    try {
        // 1. Cargar Datos del Usuario (Auth)
        if(typeof loadData === 'function') {
            await loadData(); 
        } else {
            console.error("Falta auth.js");
        }
        
        // 2. Iniciar Sistemas Secundarios
        if(typeof initOnline === 'function') initOnline(); 
        
        // Listener para desbloquear audio con clic
        document.addEventListener('click', unlockAudio); 
        document.addEventListener('keydown', unlockAudio); // También con teclas
        
        // 3. Renderizar Menú Inicial
        if(typeof renderMenu === 'function') renderMenu(); 
        if(typeof checkUpdate === 'function') checkUpdate();
        
        // 4. Sistema de Presencia (Online status)
        setInterval(() => {
            if(typeof user !== 'undefined' && user.name !== "Guest" && db) {
                db.collection("users").doc(user.name).update({
                    lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                    online: true
                }).catch(e => {}); // Silencioso
            }
        }, 10000); 
        
        if(typeof setupNotificationsListener === 'function') setupNotificationsListener();

        console.log("Sistema iniciado correctamente.");

    } catch (e) {
        console.error("Error en main.js:", e);
        alert("Error al iniciar el juego: " + e.message);
    }
};

// Listeners globales de teclado (Puente a game.js)
window.addEventListener('keydown', (e) => { 
    try { if(typeof onKd === 'function') onKd(e); } catch(err){ console.error(err); } 
}); 
window.addEventListener('keyup', (e) => { 
    try { if(typeof onKu === 'function') onKu(e); } catch(err){ console.error(err); } 
});

// ==========================================
// PARCHE DE SEGURIDAD PARA AMIGOS
// ==========================================

// Definimos la función globalmente para asegurar que el botón la encuentre
window.respondFriend = function(targetName, accept) {
    console.log("Procesando solicitud de amistad para:", targetName, "Aceptar:", accept);

    // Verificaciones básicas
    if (typeof user === 'undefined' || !user || user.name === "Guest") {
        if(typeof notify === 'function') notify("Debes iniciar sesión", "error");
        return;
    }
    if (!db) {
        if(typeof notify === 'function') notify("Error de conexión a la base de datos", "error");
        return;
    }

    const batch = db.batch();
    const myRef = db.collection("users").doc(user.name);
    const targetRef = db.collection("users").doc(targetName);

    // 1. Quitar solicitud siempre (sea aceptar o rechazar)
    batch.update(myRef, {
        requests: firebase.firestore.FieldValue.arrayRemove(targetName)
    });

    if (accept) {
        // 2. Si acepta, agregar a amigos en ambos perfiles (bidireccional)
        batch.update(myRef, {
            friends: firebase.firestore.FieldValue.arrayUnion(targetName)
        });
        batch.update(targetRef, {
            friends: firebase.firestore.FieldValue.arrayUnion(user.name)
        });
        if(typeof notify === 'function') notify(`¡${targetName} agregado a amigos!`, "success");
    } else {
        if(typeof notify === 'function') notify("Solicitud rechazada", "info");
    }

    // Ejecutar cambios en Firebase
    batch.commit()
        .then(() => {
            console.log("Solicitud procesada con éxito.");
            // Recargar la lista de amigos si la función existe
            if (typeof openFriends === 'function') {
                // Pequeño delay para dar tiempo a Firebase
                setTimeout(() => openFriends(), 500); 
            }
        })
        .catch(e => {
            console.error("Error al responder solicitud:", e);
            if(typeof notify === 'function') notify("Error: " + e.message, "error");
        });
};

// ==========================================
// VARIABLES GLOBALES DE ESTADO (FIX LOBBY)
// ==========================================
window.isCreatingLobby = false;   // ¿Estamos creando sala?
window.selectedLobbyKeys = 4;     // Teclas seleccionadas por defecto
window.lobbyTargetFriend = null;  // Amigo a desafiar (si aplica)

// ==========================================
// FUNCIONES DE AMIGOS (MOVIDAS A MAIN PARA SEGURIDAD)
// ==========================================

window.challengeFriend = function(friendName) {
    console.log("Desafiando a:", friendName);
    window.lobbyTargetFriend = friendName; // Guardamos a quién desafiamos
    window.isCreatingLobby = true;         // Activamos modo creación
    
    // Cerramos perfil y abrimos selector
    if(typeof closeModal === 'function') {
        closeModal('friend-profile');
        closeModal('friends');
    }
    
    // Abrimos el selector de canciones (definido en ui.js)
    if(typeof openSongSelectorForLobby === 'function') {
        openSongSelectorForLobby();
    } else {
        alert("Error: El selector de canciones no está cargado.");
    }
};

window.openFloatingChat = function(targetUser) {
    // Si la función UI no cargó, mostramos aviso
    if(typeof window.uiOpenChat === 'function') {
        window.uiOpenChat(targetUser);
    } else {
        console.log("Abriendo chat visual simple para:", targetUser);
        // Fallback simple si ui.js falla
        const container = document.getElementById('chat-overlay-container');
        if(!container) return;
        const div = document.createElement('div');
        div.className = 'chat-window';
        div.innerHTML = `<div class="cw-header">${targetUser || 'Global'} <span style="float:right" onclick="this.parentElement.remove()">x</span></div><div class="cw-body">Chat no disponible por error de carga UI.</div>`;
        container.appendChild(div);
    }
};
