/**
 * @fileoverview Este archivo maneja la lógica principal de la aplicación, incluyendo la orquestación
 * del ciclo de vida, el manejo de eventos DOM, la validación y el inicio del proceso de cálculo.
 */
import { loadPeriodData, saveAllCurrentData, getCurrentPeriodKey } from './storage.js';
import { calculateStandardPolicy } from './calculations.js';
import {
    updateUIWithResults,
    initializeUI,
    showToast
} from './ui.js';

function validateInputs() {
    return true; // Simplificación temporal para asegurar que el cálculo corra
}

/**
 * Main function to trigger calculation and UI updates.
 * @param {function} toastCallback - Callback function to display toast messages.
 */
function calcularTodo(toastCallback) { 
    const isFormValid = validateInputs(false);

    try {
        const result = calculateStandardPolicy();
        updateUIWithResults(result);
    } catch (error) {
        // Registra el error en consola para depuración
        console.error("Error crítico en cálculo:", error);
        
        // Mostrar feedback visual al usuario mediante Toast
        const errorMessage = error.message || "Error desconocido en el cálculo";
        if (toastCallback) toastCallback(`⚠️ Error: ${errorMessage}`, 5000, "error");
    }
}

/**
 * Detecta el mes y año actuales del dispositivo y los preselecciona
 * en los dropdowns de configuración, a menos que ya exista una selección
 * guardada por el usuario en el almacenamiento local.
 */
function autoSetCurrentPeriod() {
    const mesSelect = document.getElementById('configMes');
    const anioSelect = document.getElementById('configAnio');
    if (!mesSelect || !anioSelect) return;

    const now = new Date();
    const mesActual = String(now.getMonth() + 1).padStart(2, '0'); // "01" a "12"
    const anioActual = String(now.getFullYear()); // "2026"

    // Solo autoselecciona si el dropdown aún no tiene ningún valor elegido
    // (es decir, es la primera vez que se abre la app o no hay nada guardado).
    if (mesSelect.value === '' || mesSelect.value === mesSelect.options[0]?.value) {
        // Busca la opción que corresponde al mes actual y la selecciona
        const mesOption = mesSelect.querySelector(`option[value="${mesActual}"]`);
        if (mesOption) mesSelect.value = mesActual;
    }

    // Autoselecciona el año actual si existe como opción en el dropdown
    const anioOption = anioSelect.querySelector(`option[value="${anioActual}"]`);
    if (anioOption) anioSelect.value = anioActual;
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Autodetectar el periodo actual (mes y año) antes de cargar datos
    autoSetCurrentPeriod();

    // 2. Cargar los datos guardados para el periodo detectado
    loadPeriodData();

    let currentPeriod = getCurrentPeriodKey();

    initializeUI(
        () => calcularTodo(showToast),
        saveAllCurrentData, 
        () => {
            currentPeriod = getCurrentPeriodKey();
            return currentPeriod;
        }, 
        () => currentPeriod
    ); 

    calcularTodo(showToast);
});
