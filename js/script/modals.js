/* === MODALS.JS - Gestión de ventanas flotantes === */

function changeSection(sec) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const map = { 'songs': 'nav-songs', 'multi': 'nav-multi', 'shop': 'nav-shop', 'settings': 'nav-settings', 'rank': 'nav-rank', 'friends': 'nav-friends' };
    const t = document.getElementById(map[sec]);
    if(t) t.classList.add('active');
}

window.openModal = function(id) {
    if (id === 'settings') { 
        if(typeof openSettingsMenu === 'function') openSettingsMenu(); 
    } 
    else if (id === 'profile') {
        if (window.user && window.user.name && window.user.name !== 'Guest') {
            if(typeof window.showUserProfile === 'function') window.showUserProfile(window.user.name);
        } else {
            const m = document.getElementById('modal-profile'); if(m) m.style.display='flex';
            document.getElementById('login-view').style.display = 'block';
            document.getElementById('profile-view').style.display = 'none';
        }
    }
    else {
        const m = document.getElementById('modal-'+id); if(m) m.style.display='flex';
        if(id==='upload') setText('upload-status', "");
    }
};

window.closeModal = function(id) {
    const el = document.getElementById('modal-' + id);
    if (el) el.style.display = 'none';

    // Cancelar la creación de sala si el usuario cierra la ventana de dificultad
    if(id === 'diff' && window.isCreatingLobby) {
        window.isCreatingLobby = false;
        if(window.notify) window.notify("Creación de sala cancelada", "info");
        document.querySelectorAll('.diff-card').forEach(c => {
            c.style.border = "2px solid #333";
            c.style.transform = "scale(1)";
        });
        const opts = document.getElementById('create-lobby-opts');
        if(opts) opts.style.display = 'none';
    }
};
