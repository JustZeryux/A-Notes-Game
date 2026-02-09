window.onload = async () => {
    loadData();
    await initDB();
    
    if(auth) {
        auth.onAuthStateChanged(u => { 
            if(u) {
                loadUser(u.uid);
            }
        });
    }
    
    // Heartbeat
    setInterval(() => {
        if(user.uid && db) {
            db.collection("users").doc(user.uid).update({ lastSeen: firebase.firestore.FieldValue.serverTimestamp(), online: true });
        }
    }, 10000); 

    renderMenu();
    listenNotifications();
    checkUpdate();
    initOnline();
    
    document.addEventListener('click', unlockAudio);
};
