/* === js/script/clans.js - SISTEMA DE CLANES === */

window.openClansModal = async function() {
    if (!window.user || !window.db) return notify("Conéctate primero.", "error");
    
    document.getElementById('modal-clans').style.display = 'flex';
    
    // Verificamos si el usuario tiene clan
    if (window.user.clan && window.user.clan.tag) {
        document.getElementById('clan-none-view').style.display = 'none';
        document.getElementById('clan-dash-view').style.display = 'block';
        loadClanDashboard(window.user.clan.tag);
    } else {
        document.getElementById('clan-none-view').style.display = 'block';
        document.getElementById('clan-dash-view').style.display = 'none';
        loadPopularClans();
    }
};

window.createClan = async function() {
    const name = document.getElementById('c-new-name').value.trim();
    const tag = document.getElementById('c-new-tag').value.trim().toUpperCase();
    const color = document.getElementById('c-new-color').value;

    if(name.length < 3) return notify("Nombre muy corto", "error");
    if(tag.length < 2 || tag.length > 4) return notify("El tag debe tener 2 a 4 letras", "error");
    if(window.user.sp < 50000) return notify("No tienes suficiente SP (50,000)", "error");

    try {
        // Verificar si el tag ya existe
        const clanRef = window.db.collection('clans').doc(tag);
        const doc = await clanRef.get();
        if(doc.exists) return notify("Este Tag ya está en uso", "error");

        // Cobrar y crear
        window.user.sp -= 50000;
        const clanData = {
            id: tag, name: name, color: color,
            owner: window.user.name,
            members: [window.user.name],
            spBank: 0, level: 1,
            upgrades: { xp: false, sp: false }
        };

        await clanRef.set(clanData);
        
        // Guardar en el usuario
        window.user.clan = { tag: tag, color: color };
        await window.db.collection('users').doc(window.user.name).update({
            sp: window.user.sp,
            clan: window.user.clan
        });

        notify("¡Clan fundado con éxito!", "success");
        if(typeof updUI === 'function') updUI();
        openClansModal();
    } catch(e) { console.error(e); notify("Error creando clan", "error"); }
};

window.loadClanDashboard = async function(tag) {
    try {
        const clanSnap = await window.db.collection('clans').doc(tag).get();
        if(!clanSnap.exists) {
            // El clan fue borrado
            window.user.clan = null;
            window.db.collection('users').doc(window.user.name).update({ clan: null });
            openClansModal();
            return;
        }

        const c = clanSnap.data();
        window.currentViewedClan = c; // Guardamos en RAM

        document.getElementById('c-dash-tag').innerText = `[${c.id}]`;
        document.getElementById('c-dash-tag').style.setProperty('--c', c.color);
        document.getElementById('c-dash-name').innerText = c.name;
        document.getElementById('c-dash-lvl').innerText = c.level;
        document.getElementById('c-dash-members').innerText = c.members.length;
        document.getElementById('c-dash-sp').innerText = (c.spBank || 0).toLocaleString();

        // Lista de miembros
        const mList = document.getElementById('c-dash-members-list');
        mList.innerHTML = '';
        c.members.forEach(m => {
            const isOwner = (m === c.owner) ? '👑' : '👤';
            mList.innerHTML += `<div style="padding:5px; border-bottom:1px solid #222;">${isOwner} ${m}</div>`;
        });

        // Botones de mejoras (solo el líder puede ver los botones activos)
        const isLider = (c.owner === window.user.name);
        const btnXp = document.getElementById('btn-upg-xp');
        const btnSp = document.getElementById('btn-upg-sp');
        
        btnXp.innerText = c.upgrades.xp ? "OBTENIDO" : "COMPRAR";
        btnXp.disabled = (!isLider || c.upgrades.xp);
        btnXp.style.opacity = btnXp.disabled ? '0.5' : '1';

        btnSp.innerText = c.upgrades.sp ? "OBTENIDO" : "COMPRAR";
        btnSp.disabled = (!isLider || c.upgrades.sp);
        btnSp.style.opacity = btnSp.disabled ? '0.5' : '1';

    } catch(e) { console.error(e); }
};

window.joinClan = async function(presetTag) {
    const tag = (presetTag || document.getElementById('c-join-tag').value).trim().toUpperCase();
    if(!tag) return;
    
    try {
        const cRef = window.db.collection('clans').doc(tag);
        const cDoc = await cRef.get();
        if(!cDoc.exists) return notify("Clan no encontrado", "error");
        
        const cData = cDoc.data();
        if(cData.members.length >= 10) return notify("El clan está lleno (Max 10)", "error");

        // Añadir a Firestore (Clanes)
        cData.members.push(window.user.name);
        await cRef.update({ members: cData.members });

        // Añadir a Firestore (Usuario)
        window.user.clan = { tag: cData.id, color: cData.color };
        await window.db.collection('users').doc(window.user.name).update({ clan: window.user.clan });

        notify(`Te has unido al clan ${cData.name}`, "success");
        openClansModal();
    } catch(e) { console.error(e); notify("Error uniéndose", "error"); }
};

window.leaveClan = async function() {
    if(!window.user.clan || !confirm("¿Seguro que quieres salir del clan?")) return;
    const tag = window.user.clan.tag;
    try {
        const cRef = window.db.collection('clans').doc(tag);
        const cDoc = await cRef.get();
        if(cDoc.exists) {
            let cData = cDoc.data();
            cData.members = cData.members.filter(m => m !== window.user.name);
            
            if(cData.members.length === 0) {
                await cRef.delete(); // Borrar si se queda vacío
            } else if (cData.owner === window.user.name) {
                cData.owner = cData.members[0]; // Pasar líder al siguiente
                await cRef.update({ members: cData.members, owner: cData.owner });
            } else {
                await cRef.update({ members: cData.members });
            }
        }

        window.user.clan = null;
        await window.db.collection('users').doc(window.user.name).update({ clan: null });
        notify("Has abandonado el clan", "info");
        openClansModal();
    } catch(e) { console.error(e); notify("Error al salir", "error"); }
};

window.donateToClan = async function() {
    const amt = parseInt(document.getElementById('c-donate-amount').value);
    if(isNaN(amt) || amt <= 0) return;
    if(window.user.sp < amt) return notify("No tienes suficiente SP", "error");

    try {
        window.user.sp -= amt;
        const tag = window.user.clan.tag;
        const cRef = window.db.collection('clans').doc(tag);
        
        await window.db.runTransaction(async (t) => {
            const doc = await t.get(cRef);
            let currentBank = doc.data().spBank || 0;
            t.update(cRef, { spBank: currentBank + amt });
            t.update(window.db.collection('users').doc(window.user.name), { sp: window.user.sp });
        });

        document.getElementById('c-donate-amount').value = '';
        notify(`Has donado ${amt} SP al clan`, "success");
        if(typeof updUI === 'function') updUI();
        loadClanDashboard(tag);
    } catch(e) { console.error(e); notify("Error donando", "error"); }
};

window.buyClanUpgrade = async function(type) {
    if(!window.currentViewedClan) return;
    const c = window.currentViewedClan;
    const cost = type === 'xp' ? 100000 : 250000;
    
    if((c.spBank || 0) < cost) return notify("El banco del clan no tiene SP suficiente", "error");

    try {
        const cRef = window.db.collection('clans').doc(c.id);
        let newUpgrades = c.upgrades || {};
        newUpgrades[type] = true;

        await cRef.update({ 
            spBank: c.spBank - cost,
            upgrades: newUpgrades,
            level: c.level + 1 
        });

        notify("¡Mejora de clan desbloqueada!", "success");
        loadClanDashboard(c.id);
    } catch(e) { console.error(e); notify("Error en la compra", "error"); }
};

window.loadPopularClans = async function() {
    try {
        const list = document.getElementById('c-popular-list');
        const snap = await window.db.collection('clans').orderBy('spBank', 'desc').limit(5).get();
        list.innerHTML = '';
        
        if(snap.empty) { list.innerHTML = 'No hay clanes creados aún.'; return; }

        snap.forEach(doc => {
            const c = doc.data();
            list.innerHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:10px; border-radius:5px; margin-bottom:5px;">
                    <div><span class="clan-tag" style="--c:${c.color}">[${c.id}]</span> <strong style="color:white;">${c.name}</strong></div>
                    <button class="action secondary" style="padding:2px 10px; font-size:0.8rem;" onclick="joinClan('${c.id}')">UNIRSE</button>
                </div>
            `;
        });
    } catch(e) { console.log(e); }
};
