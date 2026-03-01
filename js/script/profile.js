/* === PROFILE.JS - Sistema de Perfil, HUD y Privacidad === */

// 1. GESTIÓN VISUAL (Auras Top 3 y Skins)
window.applyUIFrameVisuals = function(uiId, rankPos = 0) {
    let color = 'var(--accent)';
    let isNone = (!uiId || uiId === 'default');
    
    if(!isNone && typeof SHOP_ITEMS !== 'undefined') {
        const item = SHOP_ITEMS.find(x => x.id === uiId);
        if(item && item.color) color = item.color;
    }

    let auraShadow = 'none';
    if(rankPos === 1) auraShadow = '0 0 40px #FFD700';
    else if(rankPos === 2) auraShadow = '0 0 30px #C0C0C0';
    else if(rankPos === 3) auraShadow = '0 0 20px #CD7F32';

    // APLICAR AL AVATAR GRANDE DEL MODAL (Aseguramos bordes redondeados)
    const avBig = document.getElementById('p-av-big');
    if(avBig) {
        avBig.style.borderRadius = "20px"; // IMPORTANTE: Mantiene la forma
        
        if (isNone) {
            if(rankPos === 1) avBig.style.border = '4px solid #FFD700';
            else if(rankPos === 2) avBig.style.border = '4px solid #C0C0C0';
            else if(rankPos === 3) avBig.style.border = '4px solid #CD7F32';
            else avBig.style.border = '4px solid #333';
        } else {
            avBig.style.border = `4px solid ${color}`; 
        }
        
        avBig.style.boxShadow = isNone ? auraShadow : `0 0 15px ${color}, inset 0 0 20px ${color}, ${auraShadow}`;
        if(rankPos === 1 && isNone) avBig.style.animation = "gold-pulse 2s infinite alternate";
        else avBig.style.animation = "none";
    }

    // APLICAR AL MINI-AVATAR DEL MENÚ LATERAL
    const avMini = document.getElementById('m-av');
    if(avMini) {
        avMini.style.border = isNone ? 'none' : `3px solid ${color}`;
        avMini.style.boxShadow = isNone ? 'none' : `0 0 15px ${color}`;
    }

    // APLICAR A LA TARJETA DE USUARIO EN EL MENÚ
    const uCard = document.querySelector('.user-card');
    if(uCard) {
        uCard.style.borderLeft = isNone ? '4px solid transparent' : `4px solid ${color}`;
        uCard.style.background = isNone ? 'rgba(255, 255, 255, 0.05)' : `linear-gradient(90deg, ${color}22, transparent)`;
    }
};

// 2. ACTUALIZACIÓN DEL MENÚ PRINCIPAL (Tu propio perfil)
window.updUI = function() {
    if(!window.user || !window.cfg) return;

    setText('m-name', user.name); 
    setText('p-name', user.name); 
    setText('ig-name', user.name);
    setText('h-pp', user.pp || 0); 
    setText('h-sp', (user.sp || 0).toLocaleString());
    setText('m-rank', "LVL " + user.lvl);
    
    const mAv = document.getElementById('m-av');
    if(user.avatarData && mAv) { 
        mAv.style.backgroundImage = `url(${user.avatarData})`;
        mAv.textContent = ""; 
    }

    let xpReq = Math.floor(1000 * Math.pow(user.lvl >= 10 ? 1.02 : 1.05, user.lvl - 1));
    const pct = Math.min(100, (user.xp / xpReq) * 100);
    setStyle('p-xp-bar', 'width', pct + "%"); 
    
    // Buscar mi propia posición para brillar en el menú (Opcional, consume 1 lectura)
    if (window.db) {
        window.db.collection("users").orderBy("pp", "desc").get().then(snap => {
            let myRank = 0; let i = 1;
            snap.forEach(u => { if(u.id === user.name) myRank = i; i++; });
            if (user.equipped) applyUIFrameVisuals(user.equipped.ui, myRank);
        });
    } else {
        if (user.equipped) applyUIFrameVisuals(user.equipped.ui, 0);
    }
};

// 3. CAMBIAR VISTAS DENTRO DEL PERFIL
window.toggleProfileSettings = function(show) {
    const mainView = document.getElementById('profile-main-stats'); 
    const settingsView = document.getElementById('profile-account-settings');
    if(mainView && settingsView) {
        mainView.style.display = show ? 'none' : 'block'; 
        settingsView.style.display = show ? 'block' : 'none';
    }
};

// 4. MOSTRAR EL PERFIL CON ESTADOS Y ANIMACIONES ÉPICAS

                
// ==========================================
// MOSTRAR EL PERFIL (Cerradura de Privacidad)
// ==========================================
window.showUserProfile = async function(targetName) {
    if (!window.db) return notify("Error de conexión", "error");
    
    window.toggleProfileSettings(false);
    const m = document.getElementById('modal-profile'); 
    if(m) m.style.display = 'flex';
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('profile-view').style.display = 'block';
    
    setText('p-name', "Cargando...");
    setText('p-global-rank', "#--");
    
    const profilePanel = document.querySelector('#modal-profile .modal-panel');
    if(profilePanel) profilePanel.className = 'modal-panel'; 
    
    const badge = document.getElementById('p-top-badge');
    if(badge) badge.style.display = 'none';

    const isMe = (window.user && targetName === window.user.name);
    
    // --- RESET SEGURO DEL AVATAR ---
    const avBig = document.getElementById('p-av-big');
    if(avBig) { 
        avBig.style.backgroundImage = "none"; 
        setText('p-av-letter', "G"); // Ya no borra el input, solo cambia la letra
        avBig.style.border = "4px solid #333"; 
        avBig.style.boxShadow = "none"; 
        avBig.style.animation = "none"; 
    }

    // --- CERRADURAS DE SEGURIDAD (BOTONES Y CAMBIAR FOTO) ---
    document.getElementById('p-owner-actions').style.display = isMe ? 'flex' : 'none';
    document.getElementById('p-visitor-actions').style.display = isMe ? 'none' : 'flex';
    
    const btnBanner = document.getElementById('btn-edit-banner');
    if(btnBanner) btnBanner.style.display = isMe ? 'block' : 'none';

    const avOverlay = document.getElementById('p-av-overlay');
    const avInput = document.getElementById('avatar-upload-input');
    
    if (isMe) {
        if(avBig) avBig.style.cursor = 'pointer';
        if(avOverlay) avOverlay.style.display = 'block';
        if(avInput) avInput.disabled = false;
    } else {
        if(avBig) avBig.style.cursor = 'default';
        if(avOverlay) avOverlay.style.display = 'none'; // Foxy ya no tendrá el botón CAMBIAR
        if(avInput) avInput.disabled = true; // Input desactivado para visitantes
    }

    try {
        const doc = await window.db.collection('users').doc(targetName).get();
        if (!doc.exists) { setText('p-name', "Usuario no encontrado"); return; }
        const d = doc.data();
        
        setText('p-name', targetName);
        // LÓGICA DE TAGS (Predefinidos, Custom y Especiales Top)
        const tagEl = document.getElementById('p-user-tag');
        if (tagEl) {
            tagEl.style.display = 'none'; // Ocultar por defecto
            tagEl.className = 'player-tag'; // Resetear clases
            tagEl.style.background = ''; tagEl.style.color = ''; // Reset custom CSS
            
            // 1. Prioridad: ¿Es Top Global? (Se lo asignamos temporalmente, esto sobrescribe los comprados)
            let isTop = false;
            // Evaluamos el Top en la promesa de abajo, pero aquí cargamos su Tag normal:
            
            if (d.equipped && d.equipped.tag) {
                tagEl.style.display = 'inline-block';
                
                if (d.equipped.tag === 'tag_custom' && d.customTagData) {
                    // Es un Tag Customizado
                    tagEl.classList.add('tag-custom');
                    tagEl.innerText = d.customTagData.text || "CUSTOM";
                    tagEl.style.background = d.customTagData.bg || "#ff66aa";
                    tagEl.style.color = d.customTagData.color || "#ffffff";
                } else {
                    // Es un Tag comprado de la tienda
                    const sItem = typeof SHOP_ITEMS !== 'undefined' ? SHOP_ITEMS.find(x => x.id === d.equipped.tag) : null;
                    if (sItem) {
                        tagEl.classList.add(sItem.css);
                        tagEl.innerText = sItem.name;
                    } else {
                        tagEl.style.display = 'none';
                    }
                }
            }
        }
        setText('p-lvl-txt', "LVL " + (d.lvl || 1));
        setText('p-score', (d.score || 0).toLocaleString());
        setText('p-plays', (d.plays || 0).toLocaleString());
        setText('p-pp-display', (d.pp || 0).toLocaleString() + " PP");
        setText('p-sp-display', (d.sp || 0).toLocaleString());
        
        // Lógica real de Online/Offline con la regla de latidos (Heartbeat)
let isOnlineText = "⚪ Offline";
let bgStatus = "rgba(0,0,0,0.5)"; // Fondo gris por defecto

if (d.lastActive) {
    const timeSinceLastSignal = Date.now() - d.lastActive;
    // Si la última señal fue hace menos de 25 segundos (15s de latido + 10s de margen por lag de internet)
    if (timeSinceLastSignal <= 25000) {
        isOnlineText = "🟢 Conectado";
        bgStatus = "rgba(0, 255, 0, 0.15)"; // Fondo verdecito brillante
    }
} else if (d.online === true) { 
    // Respaldo por si usabas un booleano en lugar de tiempo
    isOnlineText = "🟢 Conectado";
    bgStatus = "rgba(0, 255, 0, 0.15)";
}

const statusEl = document.getElementById('p-online-status');
if (statusEl) {
    statusEl.innerText = isOnlineText;
    statusEl.style.background = bgStatus;
    if(isOnlineText.includes('Conectado')) {
        statusEl.style.border = "1px solid var(--good)";
        statusEl.style.color = "var(--good)";
    } else {
        statusEl.style.border = "1px solid #444";
        statusEl.style.color = "#aaa";
    }
}
        setText('p-custom-status', d.customStatus || "");
        setText('p-bio', d.bio || "Este usuario no ha escrito una biografía.");

        // Cargar Avatar sin destruir la estructura
        if(d.avatarData && avBig) { 
            avBig.style.backgroundImage = `url(${d.avatarData})`; 
            setText('p-av-letter', ""); 
        } else {
            setText('p-av-letter', targetName.charAt(0).toUpperCase());
        }

        const headerBg = document.getElementById('p-header-bg');
        if(headerBg) {
            const bannerUrl = d.bannerData ? `url(${d.bannerData})` : "url('icon.png')";
            headerBg.style.backgroundImage = `linear-gradient(to bottom, transparent, #0a0a0a), ${bannerUrl}`;
        }

        // Privacidad de Skins
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
// --- MOSTRAR CLAN AL LADO DEL NOMBRE ---
        let clanHTML = "";
        if (d.clan && d.clan.tag) {
            clanHTML = `<span class="clan-tag" style="--c:${d.clan.color}; font-size:1.2rem; margin-right:15px; margin-bottom:10px;">[${d.clan.tag}]</span>`;
        }
        
        // Reconstruimos el contenedor del nombre para incluir el Clan
        const nameContainer = document.getElementById('p-name').parentElement;
        nameContainer.innerHTML = `
            ${clanHTML}
            <h2 id="p-name" style="margin:0; font-size:3.5rem; font-weight:900; text-shadow:0 4px 15px rgba(0,0,0,0.8); color:white; line-height: 1; display:inline-block; vertical-align:middle;">${targetName}</h2>
            <span id="p-user-tag" class="player-tag" style="display:none; vertical-align:middle;">TAG</span>
        `;
        window.db.collection("users").orderBy("pp", "desc").get().then(snap => {
            let rankPos = 0; let index = 1;
            snap.forEach(uDoc => { if(uDoc.id === targetName) rankPos = index; index++; });
            
            if (rankPos > 0) {
                setText('p-global-rank', "#" + rankPos);
                if (rankPos <= 3 && profilePanel) {
                    profilePanel.classList.add(`epic-top-${rankPos}`);
                    if (badge) {
                        if (rankPos === 1) badge.innerHTML = `👑 #1`;
                        else if (rankPos === 2) badge.innerHTML = `#2`;
                        else if (rankPos === 3) badge.innerHTML = `#3`;
                        badge.style.display = 'block';
                    }
                }
            } else { setText('p-global-rank', "#100+"); }

            applyUIFrameVisuals(equippedUI, rankPos);
        }).catch(e => console.log("Ranking no disponible", e));

    } catch(e) { console.error("Error cargando perfil:", e); }
};

// ==========================================
// SUBIR FOTO DE PERFIL CORREGIDO
// ==========================================
window.uploadAvatar = async function(input) {
    if (!input.files || input.files.length === 0 || !window.user || !window.db) return;
    
    const file = input.files[0];
    if (file.size > 2 * 1024 * 1024) return notify("La imagen es muy pesada. Máximo 2MB.", "error");

    notify("Subiendo foto de perfil...", "info");
    
    try {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result;
            
            await window.db.collection('users').doc(window.user.name).update({ avatarData: base64 });
            window.user.avatarData = base64; 
            
            const avBig = document.getElementById('p-av-big');
            if(avBig) {
                avBig.style.backgroundImage = `url(${base64})`;
                setText('p-av-letter', ""); // Se borra la letra sin destruir el botón
            }
            
            if(typeof updUI === 'function') updUI();
            notify("¡Foto de perfil actualizada!", "success");
        };
        reader.readAsDataURL(file);
    } catch(e) { 
        console.error(e); notify("Error al subir la imagen", "error"); 
    }
};
// 5. FUNCIONES EXTRA
window.uploadBanner = async function(input) {
    if(!input.files || input.files.length === 0 || !window.user || !window.db) return;
    const file = input.files[0];
    notify("Subiendo banner, espera...", "info");
    
    try {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result;
            await window.db.collection('users').doc(window.user.name).update({ bannerData: base64 });
            window.user.bannerData = base64; 
            document.getElementById('p-header-bg').style.backgroundImage = `linear-gradient(to bottom, transparent, #0a0a0a), url(${base64})`;
            notify("¡Banner actualizado con éxito!", "success");
        };
        reader.readAsDataURL(file);
    } catch(e) { 
        console.error(e); notify("Error al subir el banner", "error"); 
    }
};

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

// ==========================================
// SUBIR FOTO DE PERFIL (AVATAR)
// ==========================================

window.checkCustomTag = function() {
    const sel = document.getElementById('sel-equip-tag').value;
    document.getElementById('custom-tag-creator').style.display = (sel === 'tag_custom') ? 'block' : 'none';
};

// Necesitas actualizar tu función `saveProfilePrivacy` actual para que guarde esto:
const oldSave = window.saveProfilePrivacy;
window.saveProfilePrivacy = async function() {
    if(!window.user || !window.db) return;
    
    // Obtenemos los valores de los tags
    const eqTag = document.getElementById('sel-equip-tag').value;
    const tagText = document.getElementById('inp-tag-text').value;
    const tagBg = document.getElementById('inp-tag-bg').value;
    const tagColor = document.getElementById('inp-tag-color').value;

    try {
        if(!window.user.equipped) window.user.equipped = {};
        window.user.equipped.tag = (eqTag === 'none') ? null : eqTag;

        let customData = window.user.customTagData || {};
        if (eqTag === 'tag_custom') {
            customData = { text: tagText.toUpperCase(), bg: tagBg, color: tagColor };
        }

        // Guárdalo junto a la bio y el estado que ya tenías
        await window.db.collection('users').doc(window.user.name).update({
            "equipped.tag": window.user.equipped.tag,
            customTagData: customData
        });
        
        window.user.customTagData = customData;
        notify("Perfil y Tags actualizados", "success");
        if(oldSave) oldSave(); // Ejecuta lo que ya tenías (Bio, Privacidad)
        showUserProfile(window.user.name);
    } catch(e) { console.error(e); notify("Error guardando tag", "error"); }
};

// Modifica `toggleProfileSettings(true)` para que llene la lista de tags que tienes comprados
