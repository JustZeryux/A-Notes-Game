/* ==========================================================
   SHOP_AUDIO.JS - Tienda de Artículos (Skins y Marcos)
   ========================================================== */

window.openShop = function() {
    if(typeof setText === 'function') setText('shop-sp', (window.user.sp || 0).toLocaleString());
    const grid = document.getElementById('shop-items');
    
    if(grid && typeof SHOP_ITEMS !== 'undefined') {
        grid.innerHTML = '';
        SHOP_ITEMS.forEach(item => {
            const owned = window.user.inventory && window.user.inventory.includes(item.id);
            const div = document.createElement('div');
            div.className = 'shop-item';
            
            if (owned) {
                div.style.borderColor = "var(--good)";
                div.style.background = "#1a221a"; 
            }
            
            const typeTag = item.type === 'skin' 
                ? (item.fixed ? '<span class="tag-fix">COLOR FIJO</span>' : '<span class="tag-cust">TU COLOR</span>') 
                : '<span class="tag-ui">UI</span>';

            let iconHTML = '';
            
            if (item.type === 'skin') {
                const pathData = (typeof SKIN_PATHS !== 'undefined' && SKIN_PATHS[item.shape]) ? SKIN_PATHS[item.shape] : "";
                const displayColor = item.fixed ? item.color : 'white'; 
                
                iconHTML = `
                    <div class="shop-preview-box">
                        <svg viewBox="0 0 100 100" style="filter:drop-shadow(0 0 8px ${displayColor}); width:60px; height:60px;">
                            <path d="${pathData}" fill="${displayColor}" stroke="white" stroke-width="3" />
                        </svg>
                    </div>`;
            } else {
                iconHTML = `<div class="shop-preview-box" style="border: 3px solid ${item.color}; border-radius:10px;"></div>`;
            }

            div.innerHTML = `
                ${iconHTML}
                <div class="shop-name">${item.name}</div>
                <div class="shop-desc">${item.desc}</div>
                ${typeTag}
                <div class="shop-price" style="${owned ? 'color:var(--good)' : ''}">
                    ${owned ? '✔ EN INVENTARIO' : item.price.toLocaleString() + ' SP'}
                </div>
                ${!owned ? `<button class="btn-small btn-add" onclick="window.buyItem('${item.id}',${item.price})">COMPRAR</button>` : ''}
            `;
            grid.appendChild(div);
        });
    }
    const m = document.getElementById('modal-shop');
    if(m) m.style.display='flex';
};

window.buyItem = function(id, price) {
    if ((window.user.sp || 0) < price) return window.notify("SP Insuficientes", "error");
    window.user.sp -= price;
    
    if (!window.user.inventory) window.user.inventory = [];
    window.user.inventory.push(id);
    
    if(typeof save === 'function') save(); 
    if(window.notify) window.notify("¡Comprado!", "success"); 
    
    window.openShop(); 
    if(typeof window.updUI === 'function') window.updUI();
};

window.equipItem = function(id, type) {
    // Función legacy (Mantenida por seguridad si algún botón viejo la usa)
    console.log("Use equipSkinFromSettings or equipUIFromSettings instead.");
};
