/**
 * @fileoverview Este módulo contiene funciones de utilidad reutilizables que asisten
 * en tareas comunes como el manejo de valores numéricos del DOM, formateo, animaciones
 * y utilidades de rendimiento como `debounce`.
 */
// Utility functions

/**
 * Gets the numeric value of an input element by ID, removing format characters.
 * @param {string} id - The ID of the input element.
 * @param {boolean} returnNullIfEmpty - If true, returns null if the input is empty.
 * @returns {number|null} The parsed numeric value or null/0.
 */
export function getNumericValue(id, returnNullIfEmpty = false) {
    const input = document.getElementById(id);
    if (!input) return returnNullIfEmpty ? null : 0;

    const rawValue = input.value.trim();
    if (rawValue === '') return returnNullIfEmpty ? null : 0;

    // Solo eliminamos los puntos (separadores de miles) si es un campo de moneda (currency).
    // En inputs de tipo 'number', el punto es un separador decimal y debe mantenerse.
    const isCurrency = input.dataset && input.dataset.type === 'currency';
    // Reemplazamos \D (todo lo que no sea dígito) por vacío para monedas
    const valueToParse = isCurrency ? rawValue.replace(/\D/g, '') : rawValue;

    const value = parseFloat(valueToParse) || 0;
    return value;
}

/**
 * Formats a number with dot thousand separators and no decimals (ES locale).
 * @param {number} num - The number to format.
 * @returns {string} The formatted number string.
 */
export function formatNumber(num) {
    if (isNaN(num) || num === null || num === undefined) {
        return '0';
    }
    return num.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Formats an input value as currency (ES locale) during typing.
 * @param {HTMLInputElement} input - The input element to format.
 */
export function formatCurrency(input) {
    let value = input.value.replace(/\D/g, '');
    let selectionStart = input.selectionStart;
    let originalLength = input.value.length;
    if (value) {
        let formattedValue = new Intl.NumberFormat('es-ES').format(value);
        input.value = formattedValue;
        let newLength = formattedValue.length;
        selectionStart = selectionStart + (newLength - originalLength);
        input.setSelectionRange(selectionStart, selectionStart);
    }
}

/**
 * Animates a numeric change in a DOM element's innerText.
 * @param {HTMLElement} element - The DOM element to animate.
 * @param {number} startValue - The starting value for the animation.
 * @param {number} endValue - The target value for the animation.
 * @param {number} duration - The duration of the animation in milliseconds.
 */
export function animateNumberChange(element, startValue, endValue, duration, suffix = '') {
    if (isNaN(endValue) || endValue === null || endValue === undefined) endValue = 0;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const currentValue = startValue + (endValue - startValue) * progress;
        element.innerText = Math.round(currentValue) + suffix;
        if (progress < 1) {
            requestAnimationFrame(step);
        }
    };
    requestAnimationFrame(step);
}

/**
 * Returns a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called after it stops being called for
 * N milliseconds. If `immediate` is passed, trigger the function on the
 * leading edge instead of the trailing.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The number of milliseconds to wait after the last call.
 * @param {boolean} immediate - If true, trigger the function on the leading edge.
 * @returns {Function} The debounced function.
 */
export function debounce(func, wait, immediate) {
    let timeout;
    let result;

    return function () {
        const context = this;
        const args = arguments;

        const later = function () {
            timeout = null;
            if (!immediate) {
                result = func.apply(context, args);
            }
        };

        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) {
            result = func.apply(context, args);
        }

        return result;
    };
}

/**
 * Habilita o deshabilita el scroll del cuerpo del documento.
 * @param {boolean} enable - True para habilitar, false para deshabilitar.
 */
export function setBodyScroll(enable) {
    document.body.classList.toggle('body-no-scroll', !enable);
    
    // Accesibilidad: Enfocar el modal si se deshabilita el scroll
    if (!enable) {
        const visibleModal = document.querySelector('.modal-overlay.visible, #config-container.visible');
        if (visibleModal) {
            visibleModal.focus();
        }
    }
}

/**
 * Convierte un formato de tiempo flexible (MM:SS o solo MM) a minutos numéricos.
 * @param {string} timeStr - El tiempo en formato MM:SS o MM.
 * @returns {number} El tiempo total en minutos decimales.
 */
export function timeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const parts = timeStr.trim().split(':').map(Number);
    
    if (parts.length === 2) {
        // Formato MM:SS
        const minutes = parts[0];
        const seconds = parts[1] || 0;
        return minutes + (seconds / 60);
    } else if (parts.length === 1) {
        // Formato solo MM o solo segundos si se desea, pero aquí lo tomamos como minutos
        return parts[0] || 0;
    } else if (parts.length === 3) {
        // Legacy H:MM:SS por si acaso queda algún dato viejo
        return (parts[0] * 60) + parts[1] + (parts[2] / 60);
    }
    return parseFloat(timeStr) || 0;
}
