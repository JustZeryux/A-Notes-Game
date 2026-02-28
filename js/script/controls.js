/* === CONTROLS.JS - Creador visual de controles y teclas === */

window.equipSkinFromSettings = function(skinId) {
    if (!window.user.equipped) window.user.equipped = {};
    window.user.equipped.skin = skinId;
    if(typeof save === 'function') save(); 
    if(window.notify) window.notify(skinId === 'default' ? "Skin desactivada" : "Skin equipada", "success");
    if(typeof window.updatePreview === 'function') window.updatePreview(); 
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

window.renderLaneConfig = function(k) { 
    if(typeof window.asegurarModo === 'function') window.asegurarModo(k); 
    document.querySelectorAll('.kb-tab').forEach(t=>t.classList.remove('active')); 
    const tab = document.getElementById('tab-'+k);
    if(tab) tab.classList.add('active'); 
    
    const c = document.getElementById('lanes-container'); 
    if(!c) return;
    c.innerHTML=''; 
    
    for(let i=0; i<k; i++){ 
        const l = window.cfg.modes[k][i]; 
        const d = document.createElement('div'); d.className='l-col'; 
        const shapePath = (typeof PATHS !== 'undefined') ? (PATHS[l.s] || PATHS['circle']) : ""; 
        d.innerHTML=`<div class="key-bind ${typeof window.remapIdx!=='undefined' && window.remapIdx===i && typeof window.remapMode!=='undefined' && window.remapMode===k?'listening':''}" onclick="window.remapKey(${k},${i})">${l.k.toUpperCase()}</div><div class="shape-indicator" onclick="window.cycleShape(${k},${i})"><svg class="shape-svg-icon" viewBox="0 0 100 100"><path d="${shapePath}"/></svg></div><input type="color" class="col-pk" value="${l.c}" onchange="window.updateLaneColor(${k},${i},this.value)">`; 
        c.appendChild(d); 
    } 
};

window.updatePreview = function() {
    const box = document.getElementById('preview-box');
    if (!box) return;
    
    if(typeof window.asegurarModo === 'function') window.asegurarModo(4); 
    const sampleLane = window.cfg.modes[4][0];
    const shapePath = (typeof PATHS !== 'undefined') ? (PATHS[sampleLane.s] || PATHS['circle']) : "";
    const scale = window.cfg.noteScale || 1;
    const opacity = (window.cfg.noteOp || 100) / 100;
    const splashType = window.cfg.splashType || 'classic'; 
    
    const splashHTML = window.cfg.showSplash ? `
        <div class="splash-wrapper" style="position: absolute; top: 50%; left: 50%; z-index: 1;">
            <div class="splash-${splashType}" style="--c: ${sampleLane.c}; animation-iteration-count: infinite; animation-duration: 1.5s;"></div>
        </div>` : '';

    box.innerHTML = `
        <div class="preview-note" style="transform: scale(${scale}); opacity: ${opacity}; transition: 0.1s; position: relative; z-index: 2;">
            <svg viewBox="0 0 100 100" style="width:100%; height:100%; filter: drop-shadow(0 0 15px ${sampleLane.c});">
                <path d="${shapePath}" fill="${sampleLane.c}" stroke="white" stroke-width="5" />
            </svg>
        </div>
        ${splashHTML}
    `;
};

window.remapKey = function(k,i){ 
    if(document.activeElement) document.activeElement.blur(); 
    window.remapMode=k; window.remapIdx=i; 
    window.renderLaneConfig(k); 
};

window.updateLaneColor = function(k,i,v){ 
    window.cfg.modes[k][i].c=v; 
    window.updatePreview(); 
};

window.cycleShape = function(k,i){ 
    const shapes=['circle','arrow','square','diamond']; 
    const cur=shapes.indexOf(window.cfg.modes[k][i].s); 
    window.cfg.modes[k][i].s = shapes[(cur+1)%4]; 
    window.renderLaneConfig(k); window.updatePreview(); 
};
