import { loadPeriodData, saveAllCurrentData } from './storage.js';
import { formatNumber, formatCurrency, getNumericValue, setBodyScroll } from './utils.js';

const domCache = {
    inputs: {},
    badges: {},
    displays: {},
    panels: {},
    modals: {},
    lists: {}
};

export function initDomCache() {
    const ids = [
        'lineaNueva', 'portIn', 'migracion', 'ventasFijoAt',
        'ingresosTec', 'tvVoz', 'porcNoRetenidos', 'cantNoRetenidosCAV',
        'nps', 'tpa', 'brownfield', 'claroUpEjec', 'unidadesVentas',
        'configMes', 'configAnio', 'sueldoBase', 'metaLineaNueva', 'metaMigracion',
        'metaPortIn', 'metaTvVoz', 'metaVentasFijoAt', 'metaSubFijoNeg', 'metaIngresosTec',
        'metaNps', 'metaUnidadesVentas', 'metaNoRetenidos', 'metaCantNoRetenidosCAV',
        'metaTPA', 'metaBrownfield', 'metaClaroUp', 'subFijoNeg'
    ];

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) domCache.inputs[id] = el;
    });

    const badgeIds = [
        'lineaNueva', 'portIn', 'migracion', 'ventasFijoAt', 'subFijoNeg',
        'ingresosTec', 'tvVoz', 'porcNoRetenidos', 'cantNoRetenidosCAV',
        'nps', 'tpa', 'brownfield', 'claroUpEjec', 'unidadesVentas'
    ];
    badgeIds.forEach(id => {
        const el = document.getElementById(`badge-${id}`);
        if (el) domCache.badges[id] = el;
    });

    const displayIds = [
        'metaLineaNueva', 'metaMigracion', 'metaPortIn', 'metaTvVoz',
        'metaVentasFijoAt', 'metaSubFijoNeg', 'metaIngresosTec', 'metaNps',
        'metaUnidadesVentas', 'metaNoRetenidos', 'metaCantNoRetenidosCAV',
        'metaTPA', 'metaBrownfield', 'metaClaroUp'
    ];
    displayIds.forEach(id => {
        const el = document.getElementById(`disp-${id}`);
        if (el) domCache.displays[id] = el;
    });

    domCache.panels.liveRemVar = document.getElementById('live-remVar');
    domCache.panels.liveCompliance = document.getElementById('live-compliance');
    domCache.panels.bottom = document.getElementById('bottom-panel-block');
    
    domCache.modals.config = document.getElementById('config-container');
    domCache.modals.reset = document.getElementById('reset-confirm-modal');
    
    domCache.lists.breakdown = document.getElementById('live-breakdown-list');
}

export function validateAndToggleError(input) {
    const value = input.value;
    const isValid = input.checkValidity();
    input.classList.toggle('input-error', !isValid);
    return isValid;
}

export function showToast(message, duration = 3000, type = 'success') {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;

    const messageEl = toast.querySelector('.toast-message');
    if (messageEl) messageEl.innerText = message;

    toast.className = `toast visible ${type}`;
    
    setTimeout(() => {
        toast.classList.remove('visible');
    }, duration);
}

export function updateUIWithResults(result) {
    if (!result || !result.ui) return;
    const ui = result.ui;

    const mapping = {
        'lineaNueva': { meta: 'metaLineaNueva', pc: ui.pcLineaNueva },
        'portIn': { meta: 'metaPortIn', pc: ui.pcPortIn },
        'migracion': { meta: 'metaMigracion', pc: ui.pcMigracion },
        'ventasFijoAt': { meta: 'metaVentasFijoAt', pc: ui.pcFijoAt },
        'subFijoNeg': { meta: 'metaSubFijoNeg', pc: ui.pcFijoNegocios },
        'ingresosTec': { meta: 'metaIngresosTec', pc: ui.pcIngresosTec },
        'tvVoz': { meta: 'metaTvVoz', pc: ui.pcTvVoz },
        'porcNoRetenidos': { meta: 'metaNoRetenidos', pc: ui.pcNoRetenidos },
        'cantNoRetenidosCAV': { meta: 'metaCantNoRetenidosCAV', pc: ui.pcCantNoRetenidosCAV },
        'nps': { meta: 'metaNps', pc: ui.pcNPS },
        'tpa': { meta: 'metaTPA', pc: ui.pcTPA },
        'brownfield': { meta: 'metaBrownfield', pc: ui.pcBrownfield },
        'claroUpEjec': { meta: 'metaClaroUp', pc: ui.pcClaroUp },
        'unidadesVentas': { meta: 'metaUnidadesVentas', pc: ui.pcConv }
    };

    Object.entries(mapping).forEach(([id, data]) => {
        const inputEl = domCache.inputs[id];
        const card = inputEl?.closest('.card');
        const metaVal = getNumericValue(data.meta) || 0;
        const dispMeta = domCache.displays[data.meta];

        if (dispMeta) {
            dispMeta.innerText = metaVal >= 1000000 
                ? (metaVal / 1000000).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + 'M'
                : formatNumber(metaVal);
        }

        const pc = data.pc || 0;
        const badge = domCache.badges[id];
        
        if (card) {
            card.style.setProperty('--progress-percent', `${Math.min(pc, 100)}%`);
            card.style.setProperty('--progress-overdraw', pc > 0 ? '1' : '0');

            // Agregar clase de completado para animaciones extra
            if (pc >= 100) {
                card.classList.add('is-completed');
            } else {
                card.classList.remove('is-completed');
            }

            // Interpolación de color mejorada (más vibrante)
            function lerp(a, b, t) { return a + (b - a) * t; }
            function rgb(r, g, b, a = 1) { return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`; }

            let color, borderColor;
            if (pc <= 0) {
                color = 'rgba(255,255,255,0.03)';
                borderColor = 'rgba(255,255,255,0.08)';
            } else if (pc < 80) {
                // Rojo Intenso a Naranja Vibrante
                const t = pc / 80;
                const r = lerp(255, 249, t);
                const g = lerp(49, 115, t);
                const b = lerp(49, 22, t);
                color = rgb(r, g, b, 0.25);
                borderColor = rgb(r, g, b, 0.45);
            } else if (pc < 100) {
                // Naranja a Verde Neón
                const t = (pc - 80) / 20;
                const r = lerp(249, 57, t);
                const g = lerp(115, 255, t);
                const b = lerp(22, 20, t);
                color = rgb(r, g, b, 0.30);
                borderColor = rgb(r, g, b, 0.55);
            } else {
                // Éxito Total: Verde Esmeralda Neón
                color = 'rgba(57, 255, 20, 0.35)';
                borderColor = 'rgba(57, 255, 20, 0.65)';
            }
            card.style.setProperty('--progress-color', color);
            card.style.setProperty('--progress-border-color', borderColor);
        }

        if (badge) {
            badge.innerText = `${Math.round(pc)}%`;
            badge.className = 'card-badge ' + (pc >= 100 ? 'high' : (pc >= 80 ? 'mid' : (pc > 0 ? 'low' : '')));
        }
    });

    if (domCache.panels.liveRemVar) domCache.panels.liveRemVar.innerText = `$ ${formatNumber(result.remVar)}`;
    if (domCache.panels.liveCompliance) domCache.panels.liveCompliance.innerText = `CUMPLIMIENTO: ${Math.round(result.totalVarPorc)}%`;

    if (domCache.lists.breakdown) {
        if (result.breakdown && result.weights && result.breakdown.ventasTotal !== undefined) {
            domCache.lists.breakdown.innerHTML = `
                <li><span>Ventas Totales <span class="discreet-percentage">(${Math.round(result.weights.ventas)}%)</span></span> <strong>$${formatNumber(result.breakdown.ventasTotal)}</strong></li>
                <li><span>No Retenidos <span class="discreet-percentage">(${Math.round(result.weights.noRetenidos)}%)</span></span> <strong>$${formatNumber(result.breakdown.noRetenidos)}</strong></li>
                <li><span>NPS <span class="discreet-percentage">(${Math.round(result.weights.nps)}%)</span></span> <strong>$${formatNumber(result.breakdown.nps)}</strong></li>
                <li><span>Convergencia <span class="discreet-percentage">(${result.weights.convergencia > 0 ? Math.round(result.weights.convergencia) + '%' : 'Transferido'})</span></span> <strong>$${formatNumber(result.breakdown.convergencia)}</strong></li>
                <li><span>Claro Up <span class="discreet-percentage">(Incentivo)</span></span> <strong>$${formatNumber(result.breakdown.claroUp)}</strong></li>
            `;
        } else {
            domCache.lists.breakdown.innerHTML = '<li style="text-align:center; padding: 20px; color: rgba(255,255,255,0.5); width: 100%; display: block;">Completa los datos</li>';
        }
    }

    updateDynamicTheme(result.totalVarPorc);
}

function updateDynamicTheme(percentage) {
    document.body.classList.remove('state-alert', 'state-mid', 'state-success');
    
    if (percentage >= 100) {
        document.body.classList.add('state-success');
    } else if (percentage >= 80) {
        document.body.classList.add('state-mid');
    } else {
        document.body.classList.add('state-alert');
    }
}

function reiniciar() {
    if (domCache.modals.reset) {
        domCache.modals.reset.classList.add('visible');
    } else {
        if (confirm("¿Reiniciar todo de forma segura? Todos los datos se borrarán.")) {
            localStorage.clear();
            document.querySelectorAll('input').forEach(input => input.value = '');
            setTimeout(() => window.location.reload(), 50);
        }
    }
}

export function initializeUI(calcCb, saveCb, updateP, getP) {
    initDomCache();

    const bottomPanel = domCache.panels.bottom;

    if (bottomPanel) {
        bottomPanel.onclick = (e) => {
            if (e.target.closest('.nav-icon-btn')) return;
            bottomPanel.classList.toggle('expanded');
        };

        document.addEventListener('click', (e) => {
            if (bottomPanel.classList.contains('expanded') && !bottomPanel.contains(e.target)) {
                bottomPanel.classList.remove('expanded');
            }
        });
    }

    const confirmResetBtn = document.getElementById('btn-confirm-reset');
    const cancelResetBtn = document.getElementById('btn-cancel-reset');

    if (confirmResetBtn) {
        confirmResetBtn.onclick = () => {
            localStorage.clear();
            document.querySelectorAll('input').forEach(input => input.value = '');
            if (domCache.modals.reset) domCache.modals.reset.classList.remove('visible');
            setTimeout(() => window.location.reload(), 50);
        };
    }

    if (cancelResetBtn) {
        cancelResetBtn.onclick = () => {
            if (domCache.modals.reset) domCache.modals.reset.classList.remove('visible');
        };
    }

    const binds = {
        'config-toggle': () => { 
            if (domCache.modals.config) domCache.modals.config.classList.add('visible');
            setBodyScroll(false);
        },
        'config-panel-close': () => {
            if (domCache.modals.config) domCache.modals.config.classList.remove('visible');
        },
        'reset-button': reiniciar
    };

    Object.entries(binds).forEach(([id, fn]) => {
        const el = document.getElementById(id);
        if (el) el.onclick = (e) => { e.preventDefault(); fn(); };
    });

    document.querySelectorAll('.close-button').forEach(btn => {
        btn.onclick = () => {
            const modal = btn.closest('.modal-overlay') || btn.closest('#config-container');
            if (modal) { modal.classList.remove('visible'); setBodyScroll(true); }
        };
    });

    document.querySelectorAll('input, select').forEach(i => {
        i.onfocus = () => {
            document.body.classList.add('keyboard-visible');
            setTimeout(() => {
                i.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        };
        i.onblur = () => document.body.classList.remove('keyboard-visible');

        i.oninput = () => { 
            if (i.dataset.type === 'currency') formatCurrency(i); 
            validateAndToggleError(i); 
            
            if (i.id === 'configMes' || i.id === 'configAnio') {
                updateP();
                loadPeriodData();
            }

            calcCb(); 
            saveAllCurrentData(); 
        };
    });

    // Guardado de seguridad antes de cerrar
    window.addEventListener('beforeunload', () => {
        saveAllCurrentData();
    });
}
