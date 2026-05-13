/**
 * @fileoverview Este módulo contiene toda la lógica de validación de entradas
 * para la aplicación.
 */
import { getNumericValue } from './utils.js';

/**
 * Valida un solo elemento de entrada y alterna los estilos de error.
 * Verifica si el campo está vacío, si el valor de la moneda es numérico y si los campos numéricos son válidos.
 * @param {HTMLInputElement|HTMLSelectElement} input - El elemento de entrada a validar.
 * @param {boolean} showVisuals - Si es verdadero, aplica clases de error y muestra mensajes. Por defecto es verdadero.
 * @returns {boolean} Verdadero si es válido, falso en caso contrario.
 */
export function validateAndToggleError(input, showVisuals = true) {
    // Busca el mensaje de error por clase dentro del mismo contenedor del input.
    const errorMessageElement = input.parentElement ? input.parentElement.querySelector('.error-message') : null;
    let isValid = true;

    // Condición de validación: campo vacío o nulo.
    // Solo es "inválido" si es estrictamente obligatorio (el Sueldo Base).
    const isStrictlyMandatory = input.id === 'sueldoBase';
    
    if (!input.value || input.value.trim() === '') {
        isValid = isStrictlyMandatory ? false : true;
    }
    // Condición de validación: campo de moneda no numérico.
    else if (input.dataset.type === 'currency' && isNaN(getNumericValue(input.id))) {
        isValid = false;
    }
    // Condición de validación: campo numérico no válido.
    else if (input.type === 'number' && isNaN(parseFloat(input.value))) {
        isValid = false;
    }

    // Aplica o remueve las clases de error y la visibilidad del mensaje de error (solo si showVisuals es true).
    if (showVisuals) {
        if (!isValid) {
            input.classList.add('input-error'); // Resalta el borde del input en rojo.
            input.classList.remove('input-missing'); // Asegura que no tenga el estilo de "faltante".
            if (errorMessageElement && errorMessageElement.classList.contains('error-message')) {
                errorMessageElement.classList.add('visible'); // Muestra el mensaje de error.
            }
        } else {
            input.classList.remove('input-error');
            input.classList.remove('input-missing');
            if (errorMessageElement && errorMessageElement.classList.contains('error-message')) {
                errorMessageElement.classList.remove('visible'); // Oculta el mensaje de error.
            }
        }
    }

    return isValid;
}


/**
 * Valida todas las entradas relevantes en el formulario principal y en el panel de configuración.
 * Resalta los campos inválidos y el botón de configuración si el salario fijo no es válido.
 * @param {boolean} showVisuals - Si es verdadero, aplica efectos visuales de error. Por defecto es verdadero.
 * @returns {boolean} Verdadero si todas las entradas son válidas, falso en caso contrario.
 */
export function validateInputs(showVisuals = true) {
    let isFormValid = true;
    // Selecciona todas las entradas del panel de configuración y de las tarjetas de venta.
    const allInputs = Array.from(document.querySelectorAll('#config-panel input[type="number"], #config-panel input[type="text"][data-type="currency"], #config-panel select, #ventas-section input, #ventas-section select, .sales-cards .card input, .sales-cards .card select'));

    allInputs.forEach(input => {
        // Solo valida entradas visibles (para no validar campos ocultos o no aplicables).
        if (input.offsetParent !== null) {
            if (!validateAndToggleError(input, showVisuals)) {
                isFormValid = false;
            }
        }
    });

    // Validación especial para el sueldo base, destacando el botón de configuración si es inválido.
    const configToggle = document.getElementById('config-toggle');
    const sueldoBaseInput = document.getElementById('sueldoBase');
    const isSalarioValid = validateAndToggleError(sueldoBaseInput, showVisuals);
    
    if (showVisuals) {
        if (!isSalarioValid) {
            isFormValid = false;
            configToggle.classList.add('highlight'); // Aplica animación de "brillo" al botón de configuración.
        } else {
            configToggle.classList.remove('highlight');
        }
    } else if (!isSalarioValid) {
        isFormValid = false;
    }

    return isFormValid;
}

/**
 * Validates the inputs in the configuration panel.
 * @returns {boolean} True if all inputs are valid.
 */
export function validateConfigPanel() {
    let isPanelValid = true;
    const configInputs = document.querySelectorAll('#config-panel input[type="number"], #config-panel input[type="text"], #config-panel select');

    configInputs.forEach(input => {
        if (input.offsetParent !== null) {
            if (!validateAndToggleError(input)) {
                isPanelValid = false;
            }
        }
    });
    return isPanelValid;
}
