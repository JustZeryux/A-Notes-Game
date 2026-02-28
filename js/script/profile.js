/* === PROFILE.JS - Sistema de Perfil y HUD del juego === */

window.applyUIFrameVisuals = function(uiId) {
    let color = 'var(--accent)';
    let isNone = (!uiId || uiId === 'default');
    if(!isNone && typeof SHOP_ITEMS !== 'undefined') {
        const item = SHOP_ITEMS.find(x => x.id === uiId);
        if(item && item.color) color = item.color;
    }
    const avBig = document.getElementById('p-av-big');
    if(avBig) { avBig.style.border = isNone ? '4px solid #333' : `4px solid ${color}`; avBig.style.boxShadow = isNone ? 'none' : `0 0 25px ${color}`; }
    const uCard = document.querySelector('.user-card');
    if(uCard) { uCard.style.borderLeft = isNone ? '4px solid transparent' : `4px solid ${color}`; uCard.style.background = isNone ? 'rgba(255, 255, 255, 0.05)' : `linear-gradient(90deg, ${color}22, transparent)`; uCard.style.boxShadow = isNone ? 'none' : `-5px 0 15px ${color}44`; }
};

window.updUI = function() {
    if(!window.user || !window.cfg) return;

    if(cfg.middleScroll === undefined) cfg.middleScroll = false;
    if(cfg.trackOp === undefined) cfg.trackOp = 10;
    if(cfg.noteOp === undefined) cfg.noteOp = 100;
    if(cfg.noteScale === undefined) cfg.noteScale = 1;

    // Stats básicos
    setText('m-name', user.name); setText('p-name', user.name); setText('ig-name', user.name);
    setText('h-pp', user.pp); setText('h-sp', (user.sp || 0).toLocaleString());
    setText('p-score', (user.score || 0).toLocaleString()); setText('p-plays', (user.plays || 0).toLocaleString());
    setText('p-pp-display', (user.pp || 0).toLocaleString()); setText('p-sp-display', (user.sp || 0).toLocaleString());
    setText('m-rank', "LVL " + user.lvl); setText('p-lvl-txt', "LVL " + user.lvl);
    
    let xpReq = Math.floor(1000 * Math.pow(user.lvl >= 10 ? 1.02 : 1.05, user.lvl - 1));
    const pct = Math.min(100, (user.xp / xpReq) * 100);
    setStyle('p-xp-bar', 'width', pct + "%"); setText('p-xp-txt', `${Math.floor(user.xp)} / ${xpReq} XP`);
    
    // Avatar
    if(user.avatarData) { 
        const url = `url(${user.avatarData})`;
        setStyle('m-av', 'backgroundImage', url); setStyle('p-av-big', 'backgroundImage', url); setStyle('ig-av', 'backgroundImage', url);
        const headerBg = document.getElementById('p-header-bg');
        if(headerBg) headerBg.style.backgroundImage = `linear-gradient(to bottom, transparent, #0a0a0a), ${url}`;
    }
    if(user.bg) { const bg = document.getElementById('bg-image'); if(bg) { bg.src = user.bg; bg.style.opacity = 0.3; } }

    const rankEl = document.getElementById('p-global-rank');
    if(rankEl && rankEl.innerText === "#--") updateGlobalRank();

    // Skins y Marcos
    if (user.equipped) {
        let skinName = "Default"; let uiName = "Ninguno";
        if (typeof SHOP_ITEMS !== 'undefined') {
            const sItem = SHOP_ITEMS.find(x => x.id === user.equipped.skin); if(sItem) skinName = sItem.name;
            const uItem = SHOP_ITEMS.find(x => x.id === user.equipped.ui); if(uItem) uiName = uItem.name;
        }
        setText('p-equipped-skin', skinName); setText('p-equipped-ui', uiName);
        applyUIFrameVisuals(user.equipped.ui);
    }
    
    if(typeof applyCfg === 'function') applyCfg();

    // HUD del juego
    if (typeof st !== 'undefined') {
        const fcEl = document.getElementById('hud-fc'); const meanEl = document.getElementById('hud-mean'); const comboEl = document.getElementById('g-combo');
        if (fcEl) {
            fcEl.innerText = (cfg.showFC && st.fcStatus) ? st.fcStatus : "";
            if(st.fcStatus==="PFC") fcEl.style.color = "cyan"; else if(st.fcStatus==="GFC") fcEl.style.color = "gold"; else if(st.fcStatus==="FC") fcEl.style.color = "#12FA05"; else fcEl.style.color = "#F9393F";
        }
        if (meanEl) meanEl.innerText = (cfg.showMean && st.hitCount > 0) ? (st.totalOffset / st.hitCount).toFixed(2) + "ms" : "";
        if (comboEl) {
            if (st.cmb > 0) { comboEl.innerText = st.cmb; comboEl.style.opacity = '1'; comboEl.classList.remove('pulse'); void comboEl.offsetWidth; comboEl.classList.add('pulse'); } 
            else { comboEl.style.opacity = '0'; }
        }
    }
    
    const isGoogle = user.pass === "google-auth";
    const locSet = document.getElementById('local-acc-settings'); const gooSet = document.getElementById('google-acc-settings');
    if(locSet) locSet.style.display = isGoogle ? 'none' : 'block';
    if(gooSet) gooSet.style.display = isGoogle ? 'block' : 'none';
};

window.updateGlobalRank = function() {
    if(!window.db || window.user.name === "Guest") return;
    window.db.collection("leaderboard").orderBy("pp", "desc").limit(100).get().then(snap => {
        let rank = "#100+";
        snap.docs.forEach((doc, index) => { if(doc.id === window.user.name) rank = "#" + (index + 1); });
        setText('p-global-rank', rank);
    }).catch(e => console.log("Rank update limit", e));
};

window.toggleProfileSettings = function(show) {
    const mainView = document.getElementById('profile-main-stats'); const settingsView = document.getElementById('profile-account-settings');
    if(mainView && settingsView) {
        mainView.style.opacity = show ? "0" : "1"; settingsView.style.opacity = show ? "1" : "0";
        setTimeout(() => { mainView.style.display = show ? 'none' : 'block'; settingsView.style.display = show ? 'block' : 'none'; }, 100);
    }
};

window.showUserProfile = async function(targetName) {
    if (!window.db) return;
    window.toggleProfileSettings(false);
    
    const m = document.getElementById('modal-profile'); if(m) m.style.display='flex';
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('profile-view').style.display = 'block';
    
    setText('p-name', "Cargando..."); setText('p-lvl-txt', "LVL ?");
    
    const isMe = (targetName === window.user.name);
    document.getElementById('p-owner-actions').style.display = isMe ? 'flex' : 'none';
    document.getElementById('p-visitor-actions').style.display = isMe ? 'none' : 'flex';
    document.getElementById('p-av-big').style.cursor = isMe ? 'pointer' : 'default';
    document.getElementById('avatar-upload-input').disabled = !isMe;

    try {
        const doc = await window.db.collection('users').doc(targetName).get();
        if (!doc.exists) return notify("Usuario no encontrado", "error");
        
        const d = doc.data();
        setText('p-name', targetName); setText('p-lvl-txt', "LVL " + (d.lvl || 1));
        setText('p-score', (d.score || 0).toLocaleString()); setText('p-plays', (d.plays || 0).toLocaleString());
        setText('p-pp-display', (d.pp || 0).toLocaleString() + " PP"); setText('p-sp-display', (d.sp || 0).toLocaleString());
        
        const url = d.avatarData ? `url(${d.avatarData})` : "url('icon.png')";
        const avBig = document.getElementById('p-av-big'); if(avBig) avBig.style.backgroundImage = url;
        const headerBg = document.getElementById('p-header-bg'); if(headerBg) headerBg.style.backgroundImage = `linear-gradient(to bottom, transparent, #0a0a0a), ${url}`;
        
        let skinName = "Default"; let uiName = "Ninguno";
        if (d.equipped && typeof SHOP_ITEMS !== 'undefined') {
            const sItem = SHOP_ITEMS.find(x => x.id === d.equipped.skin); if(sItem) skinName = sItem.name;
            const uItem = SHOP_ITEMS.find(x => x.id === d.equipped.ui); if(uItem) uiName = uItem.name;
        }
        setText('p-equipped-skin', skinName); setText('p-equipped-ui', uiName);
        if (typeof applyUIFrameVisuals === 'function') applyUIFrameVisuals(d.equipped ? d.equipped.ui : 'default');

        if (!isMe) {
            const btnAdd = document.getElementById('btn-add-friend');
            const isFriend = window.user.friends && window.user.friends.includes(targetName);
            if (isFriend) { btnAdd.innerText = "✅ AMIGOS"; btnAdd.style.background = "#333"; btnAdd.style.color = "#888"; btnAdd.onclick = null; } 
            else { btnAdd.innerText = "➕ AGREGAR AMIGO"; btnAdd.style.background = "var(--good)"; btnAdd.style.color = "black"; btnAdd.onclick = () => { window.sendFriendRequestTarget(targetName); }; }
            document.getElementById('btn-chat-user').onclick = () => { window.openFloatingChat(targetName); window.closeModal('profile'); };
            document.getElementById('btn-challenge-user').onclick = () => { window.challengeFriend(targetName); };
        }
    } catch(e) { console.error(e); }
};
