/* === PROFILE.JS - Sistema de Perfil, HUD y Privacidad === */

// 1. GESTIÓN VISUAL (Auras Top 3 y Skins)
window.applyUIFrameVisuals = function(uiId, rankPos = 0) {
    let color = 'var(--accent)';
    let isNone = (!uiId || uiId === 'default');
    
    if(!isNone && typeof SHOP_ITEMS !== 'undefined') {
        const item = SHOP_ITEMS.find(x => x.id === uiId);
        if(item && item.color) color = item.color;
    }

    // Lógica del Aura Top 3 (Sombra exterior)
    let auraShadow = 'none';
    if(rankPos === 1) auraShadow = '0 0 40px #FFD700'; // Oro
    else if(rankPos === 2) auraShadow = '0 0 30px #C0C0C0'; // Plata
    else if(rankPos === 3) auraShadow = '0 0 20px #CD7F32'; // Bronce

    // Aplicar al Avatar Grande del Modal
    const avBig = document.getElementById('p-av-big');
    if(avBig) {
        if (isNone) {
            if(rankPos === 1) avBig.style.border = '4px solid #FFD700';
            else if(rankPos === 2) avBig.style.border = '4px solid #C0C0C0';
            else if(rankPos === 3) avBig.style.border = '4px solid #CD7F32';
            else avBig.style.border = '4px solid #333';
        } else {
            avBig.style.border = `4px solid ${color}`; // La UI Skin siempre gana el borde
        }
        
        // Se combinan la sombra de la Skin con la sombra del Top 3
        avBig.style.boxShadow = isNone ? auraShadow : `0 0 15px ${color}, inset 0 0 20px ${color}, ${auraShadow}`;
        if(rankPos === 1 && isNone) avBig.style.animation = "gold-pulse 2s infinite alternate";
        else avBig.style.animation = "none";
    }

    // Aplicar al Mini-Avatar del Menú Lateral
    const avMini = document.getElementById('m-av');
    if(avMini) {
        avMini.style.border = isNone ? 'none' : `3px solid ${color}`;
        avMini.style.boxShadow = isNone ? 'none' : `0 0 15px ${color}`;
    }

    // Aplicar a la Tarjeta del Usuario en el Menú
    const uCard = document.querySelector('.user-card');
    if(uCard) {
        uCard.style.borderLeft = isNone ? '4px solid transparent' : `4px solid ${color}`;
        uCard.style.background = isNone ? 'rgba(255, 255, 255, 0.05)' : `linear-gradient(90deg, ${color}22, transparent)`;
    }
};

// 2. ACTUALIZACIÓN DEL MENÚ PRINCIPAL (Tu propio perfil)
window.updUI = function() {
    if(!window.user || !window.cfg) return;

    // Stats básicos
    setText('m-name', user.name); setText('p-name', user.name); setText('ig-name', user.name);
    setText('h-pp', user.pp || 0); setText('h-sp', (user.sp || 0).toLocaleString());
    setText('m-rank', "LVL " + user.lvl);
    
    // Avatar Menu
    const mAv = document.getElementById('m-av');
    if(user.avatarData && mAv) { 
        mAv.style.backgroundImage = `url(${user.avatarData})`;
        mAv.textContent = ""; 
    }

    // Calcular XP
    let xpReq = Math.floor(1000 * Math.pow(user.lvl >= 10 ? 1.02 : 1.05, user.lvl - 1));
    const pct = Math.min(100, (user.xp / xpReq) * 100);
    setStyle('p-xp-bar', 'width', pct + "%"); 
    
    // Skins equipadas (Tu propio usuario)
    if (user.equipped) {
        applyUIFrameVisuals(user.equipped.ui, 0); // Opcional: Buscar tu propio rankPos si quieres brillar en el menú
    }
};

// 3. MOSTRAR PERFILES AL HACER CLIC (Tú o Amigos)
window.toggleProfileSettings = function(show) {
    const mainView = document.getElementById('profile-main-stats'); const settingsView = document.getElementById('profile-account-settings');
    if(mainView && settingsView) {
        mainView.style.display = show ? 'none' : 'blockwindow.showUserProfile = async function(targetName) {
    if (!window.db) return notify("Error de conexión", "error");
    
    window.toggleProfileSettings(false);
    const m = document.getElementById('modal-profile'); 
    if(m) m.style.display = 'flex';
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('profile-view').style.display = 'block';
    
    // Reset visual y remover efectos épicos
    setText('p-name', "Cargando...");
    setText('p-global-rank', "#--");
    const profilePanel = document.querySelector('#modal-profile .modal-panel');
    profilePanel.className = 'modal-panel'; // Quita las clases epic-top
    
    const badge = document.getElementById('p-top-badge');
    if(badge) badge.style.display = 'none';

    const avBig = document.getElementById('p-av-big');
    if(avBig) { avBig.style.backgroundImage = "none"; avBig.textContent = "G"; avBig.style.border = "4px solid #333"; avBig.style.boxShadow = "none"; avBig.style.animation = "none"; }

    const isMe = (window.user && targetName === window.user.name);
    document.getElementById('p-owner-actions').style.display = isMe ? 'flex' : 'none';
    document.getElementById('p-visitor-actions').style.display = isMe ? 'none' : 'flex';
    
    // Mostrar u ocultar botón de banner
    const btnBanner = document.getElementById('btn-edit-banner');
    if(btnBanner) btnBanner.style.display = isMe ? 'block' : 'none';

    try {
        const doc = await window.db.collection('users').doc(targetName).get();
        if (!doc.exists) { setText('p-name', "Usuario no encontrado"); return; }
        const d = doc.data();
        
        setText('p-name', targetName);
        setText('p-lvl-txt', "LVL " + (d.lvl || 1));
        setText('p-score', (d.score || 0).toLocaleString());
        setText('p-plays', (d.plays || 0).toLocaleString());
        setText('p-pp-display', (d.pp || 0).toLocaleString() + " PP");
        setText('p-sp-display', (d.sp || 0).toLocaleString());
        
        const isOnline = d.online ? "🟢 Conectado" : "⚪ Desconectado";
        setText('p-online-status', isOnline);
        setText('p-custom-status', d.customStatus || "");
        setText('p-bio', d.bio || "Este usuario no ha escrito una biografía.");

        // Cargar Avatar y Banner
        if(d.avatarData && avBig) { avBig.style.backgroundImage = `url(${d.avatarData})`; avBig.textContent = ""; }
        const headerBg = document.getElementById('p-header-bg');
        if(headerBg) {
            const bannerUrl = d.bannerData ? `url(${d.bannerData})` : "url('icon.png')";
            headerBg.style.backgroundImage = `linear-gradient(to bottom, transparent, #0a0a0a), ${bannerUrl}`;
        }

        // Privacidad de Ítems
        let skinName = "Oculto", uiName = "Oculto";
        let equippedUI = 'default';
        if (!d.hideItems || isMe) { 
            skinName = "Default"; uiName = "Ninguno";
            if (d.equipped && typeof SHOP_ITEMS !== 'undefined') {
                const sItem = SHOP_ITEMS.find(x => x.id === d.equipped.skin); if(sItem) skinName = sItem.name;
                const uItem = SHOP_ITEMS.find(x => x.id === d.equipped.ui); if(uItem) uiName = uItem.name;
            }
            equippedUI = d.equipped ? d.equipped.ui : 'default';
        }
        setText('p-equipped-skin', skinName);
        setText('p-equipped-ui', uiName);

        // Lógica de Amigos (Intacta)
        if (!isMe) {
            const btnAdd = document.getElementById('btn-add-friend');
            const friendsList = window.user.friends || [];
            if (btnAdd) {
                if (friendsList.includes(targetName)) {
                    btnAdd.innerText = "❌ ELIMINAR AMIGO"; btnAdd.style.background = "#FF3333"; btnAdd.style.color = "white";
                    btnAdd.onclick = () => { window.removeFriend(targetName); window.closeModal('profile'); };
                } else {
                    btnAdd.innerText = "➕ AGREGAR AMIGO"; btnAdd.style.background = "var(--good)"; btnAdd.style.color = "black";
                    btnAdd.onclick = () => { window.sendFriendRequestTarget(targetName); };
                }
            }
        }

        // RANKING CON ANIMACIONES ÉPICAS
        window.db.collection("users").orderBy("pp", "desc").get().then(snap => {
            let rankPos = 0; let index = 1;
            snap.forEach(uDoc => { if(uDoc.id === targetName) rankPos = index; index++; });
            
            if (rankPos > 0) {
                setText('p-global-rank', "#" + rankPos);
                
                // Si es Top 3, aplicar diseño de leyenda
                if (rankPos <= 3) {
                    profilePanel.classList.add(`epic-top-${rankPos}`);
                    if (badge) {
                        badge.innerText = `#${rankPos}`;
                        badge.style.display = 'block';
                        badge.style.animation = 'floatBadge 3s infinite ease-in-out alternate';
                    }
                }
            } else { 
                setText('p-global-rank', "#100+"); 
            }

            applyUIFrameVisuals(equippedUI, rankPos);
        }).catch(e => console.log("Ranking no disponible", e));

    } catch(e) { console.error("Error cargando perfil:", e); }
};

// Función para subir y guardar el Banner en Firebase
window.uploadBanner = async function(input) {
    if(!input.files || input.files.length === 0 || !window.user || !window.db) return;
    const file = input.files[0];
    notify("Subiendo banner, espera...", "info");
    
    try {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result;
            // Guardar en Firebase
            await window.db.collection('users').doc(window.user.name).update({ bannerData: base64 });
            window.user.bannerData = base64; // Actualizar local
            // Reflejar en pantalla de inmediato
            document.getElementById('p-header-bg').style.backgroundImage = `linear-gradient(to bottom, transparent, #0a0a0a), url(${base64})`;
            notify("¡Banner actualizado con éxito!", "success");
        };
        reader.readAsDataURL(file);
    } catch(e) { 
        console.error(e); notify("Error al subir el banner", "error"); 
    }
};
        settingsView.style.display = show ? 'block' : 'none';
    }
};



// 4. FUNCIONES EXTRA
window.removeFriend = async function(friendName) {
    if (!window.user || !window.db) return;
    try {
        window.user.friends = window.user.friends.filter(f => f !== friendName);
        await window.db.collection('users').doc(window.user.name).update({ friends: window.user.friends });
        notify(`Has eliminado a ${friendName}`, "info");
        if(typeof updUI === 'function') updUI();
    } catch (e) { notify("Error", "error"); }
};

window.openNotifPanel = function() {
    const p = document.getElementById('notif-panel');
    if(p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
};
