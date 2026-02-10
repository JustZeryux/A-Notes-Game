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
