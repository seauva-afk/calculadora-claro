/**
 * @fileoverview Este módulo gestiona toda la interacción con el almacenamiento local (localStorage)
 * para la persistencia de datos de la aplicación.
 */
import { formatCurrency } from './utils.js';

const DATA_KEY = 'remunerationData_v2026';

function getAllData() {
    return JSON.parse(localStorage.getItem(DATA_KEY)) || {};
}

function saveAllData(data) {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
}

export function getCurrentPeriodKey() {
    const mes = document.getElementById('configMes')?.value || '01';
    const anio = document.getElementById('configAnio')?.value || '2026';
    return `${anio}-${String(mes).padStart(2, '0')}`;
}

let saveTimeout;
const DEBOUNCE_DELAY = 500;

function debounceSave(fn) {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(fn, DEBOUNCE_DELAY);
}

export function saveAllCurrentData() {
    debounceSave(() => {
        const periodKey = getCurrentPeriodKey();
        const allData = getAllData();

        const allIds = [
            // Metas
            'sueldoBase', 'metaLineaNueva', 'metaMigracion', 'metaPortIn',
            'metaTvVoz', 'metaVentasFijoAt', 'metaSubFijoNeg', 'metaIngresosTec',
            'metaNps', 'metaUnidadesVentas', 'metaNoRetenidos', 'metaCantNoRetenidosCAV',
            'metaTPA', 'metaBrownfield', 'metaClaroUp',
            // Ejecución
            'lineaNueva', 'migracion', 'portIn', 'ventasFijoAt', 'subFijoNeg',
            'tvVoz', 'ingresosTec', 'nps', 'porcNoRetenidos', 'cantNoRetenidosCAV',
            'tpa', 'brownfield', 'claroUpEjec', 'unidadesVentas'
        ];

        const data = {};
        allIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) data[id] = el.value;
        });

        allData[periodKey] = data;
        saveAllData(allData);
    });
}

export function loadPeriodData() {
    const periodKey = getCurrentPeriodKey();
    const allData = getAllData();
    const periodData = allData[periodKey];

    if (periodData) {
        // Mapeo de migración para compatibilidad con versiones anteriores si es necesario
        const legacyMapping = {
            'salarioFijo': 'sueldoBase',
            'metaFijoAt': 'metaVentasFijoAt',
            'metaConv': 'metaUnidadesVentas',
            'fijoAt': 'ventasFijoAt',
            'convUnid': 'unidadesVentas',
            'fijoNegocios': 'subFijoNeg'
        };

        // Si los datos están en el formato antiguo (con config y achieved), los unificamos
        let dataToLoad = {};
        if (periodData.config || periodData.achieved) {
            dataToLoad = { ...periodData.config, ...periodData.achieved };
        } else {
            dataToLoad = periodData;
        }
        
        // Aplicar migración de claves antiguas a nuevas si es necesario
        Object.keys(legacyMapping).forEach(oldKey => {
            if (dataToLoad[oldKey] !== undefined && dataToLoad[legacyMapping[oldKey]] === undefined) {
                dataToLoad[legacyMapping[oldKey]] = dataToLoad[oldKey];
            }
        });

        Object.keys(dataToLoad).forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.value = dataToLoad[id];
                if (input.dataset && input.dataset.type === 'currency') {
                    formatCurrency(input);
                }
            }
        });
    } else {
        // Si no hay datos para el periodo, limpiar campos (excepto selectores de periodo)
        document.querySelectorAll('input').forEach(input => input.value = '');
    }
}
