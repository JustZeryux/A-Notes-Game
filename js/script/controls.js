/* === CONTROLS.JS - Funciones de UI y Skins (LIMPIO DE CONFLICTOS) === */

window.equipSkinFromSettings = function(skinId) {
    if (!window.user.equipped) window.user.equipped = {};
    window.user.equipped.skin = skinId;
    if(typeof save === 'function') save(); 
    if(window.notify) window.notify(skinId === 'default' ? "Skin desactivada" : "Skin equipada", "success");
    
    // Obtenemos los keys actuales del selector para actualizar la vista previa
    const select = document.getElementById('kb-mode-select');
    const k = parseInt(select ? select.value : 4);
    if(typeof window.updatePreview === 'function') window.updatePreview(k); 
};

window.equipUIFromSettings = function(uiId) {
    if(!window.user) return;
    if(!window.user.equipped) window.user.equipped = {}; 
    window.user.equipped.ui = uiId;
    
    if(window.db && window.user.name) {
        window.db.collection('users').doc(window.user.name).update({
            'equipped.ui': uiId
        }).then(() => {
            if(window.notify) window.notify("¡Marco de interfaz equipado!", "success");
            if(typeof window.updUI === 'function') window.updUI();
        });
    }
};

/* 🚨 NOTA IMPORTANTE: 
 Se eliminaron de aquí las funciones remapKey, renderLaneConfig, updatePreview, 
 cycleShape y updateLaneColor porque estaban sobrescribiendo y rompiendo el 
 sistema moderno que ya está integrado y blindado en settings.js.
*/
