// js/main.js

window.onload = async () => { 
    loadData(); // Está en auth.js
    await initDB(); // Está en auth.js
    initOnline(); // Está en online.js
    
    document.addEventListener('click', unlockAudio); // Está en game.js
    renderMenu(); // Está en ui.js
    checkUpdate(); // Está en auth.js
    
    // Sistema de presencia
    setInterval(() => {
        if(user.name !== "Guest" && db) {
            db.collection("users").doc(user.name).update({
                lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                online: true
            });
        }
    }, 10000); 
    
    setupNotificationsListener(); // Está en ui.js
};

// Listeners globales de teclado
window.addEventListener('keydown', onKd); 
window.addEventListener('keyup', onKu);
