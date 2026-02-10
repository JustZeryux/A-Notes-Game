/* === MAIN INITIALIZATION === */
window.onload = async () => { 
    // Ahora loadData es la encargada de verificar si hay un usuario logueado en la nube
    await loadData(); 
    
    initOnline(); 
    document.addEventListener('click', unlockAudio); 
    
    // El renderMenu ahora se llama dentro de loadData si hay sesión, 
    // pero lo llamamos aquí por si es Guest
    renderMenu(); 
    checkUpdate();
    
    // PRESENCE SYSTEM (HEARTBEAT)
    setInterval(() => {
        if(user.name !== "Guest" && db) {
            db.collection("users").doc(user.name).update({
                lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                online: true
            });
        }
    }, 10000); 
    setupNotificationsListener();
};

window.addEventListener('keydown', onKd); 
window.addEventListener('keyup', onKu);
