/**
 * @fileoverview Este archivo contiene la lógica principal para el cálculo de la remuneración variable,
 * basándose en las reglas de negocio definidas por la política PC-EST-VAR-27449-2026 UMMC.
 */
import { getNumericValue, timeToMinutes } from './utils.js';

// Objeto central que contiene todas las reglas de negocio, pesos, umbrales y tablas de pago.
const businessRules = {
    weights: {
        totalVariableMax: 0.50, // 50% del salario fijo mensual
        noRetenidos: 0.25,      // 25%
        nps: 0.10,              // 10%
        convergencia: 0.10,     // 10%
        ventas: 0.55            // 55%
    },
    // Tabla 2 — Factor de pago según cumplimiento — Política PC-EST-VAR-27449-2026
    payoutTiers: [
        { threshold: 140, value: 160 }, { threshold: 136, value: 150 },
        { threshold: 130, value: 140 }, { threshold: 126, value: 135 },
        { threshold: 120, value: 130 }, { threshold: 115, value: 125 },
        { threshold: 110, value: 120 }, { threshold: 105, value: 115 },
        { threshold: 100, value: 100 }, { threshold: 80,  value: 'linear' },
        { threshold: 0,   value: 0 }
    ],
    // Tabla 4 — Servicios Fijos (Internet/Fijo @ y TV+Voz) — valores por unidad
    fijoPaymentTiers: [
        { threshold: 120, pagoPorInternet: 60000, pagoPorVozTv: 6000 },
        { threshold: 110, pagoPorInternet: 50000, pagoPorVozTv: 3000 },
        { threshold: 100, pagoPorInternet: 40000, pagoPorVozTv: 2000 },
        { threshold: 90,  pagoPorInternet: 28000, pagoPorVozTv: 1500 },
        { threshold: 80,  pagoPorInternet: 20000, pagoPorVozTv: 1000 },
        { threshold: 0,   pagoPorInternet: 0,     pagoPorVozTv: 0 }
    ],
    // Tabla 5 — Pospago (Portación, Línea Nueva, Migración) — valores por unidad
    pospagoPaymentTiers: [
        { threshold: 120, pagoPortacion: 44000, pagoLineaNueva: 20000, pagoMigracion: 32000 },
        { threshold: 110, pagoPortacion: 41000, pagoLineaNueva: 18000, pagoMigracion: 30000 },
        { threshold: 100, pagoPortacion: 36000, pagoLineaNueva: 16000, pagoMigracion: 28000 },
        { threshold: 90,  pagoPortacion: 25000, pagoLineaNueva: 10000, pagoMigracion: 19000 },
        { threshold: 80,  pagoPortacion: 17000, pagoLineaNueva: 6000,  pagoMigracion: 12000 },
        { threshold: 0,   pagoPortacion: 0,     pagoLineaNueva: 0,     pagoMigracion: 0 }
    ],
    maxPayout: 160, // Máximo 160% al ≥140% de cumplimiento (Tabla 2)
    incentives: {
        claroUpValue: 4000,
        factorCap: 1.20
    },

    getVariablePayoutPercentage(compliance) {
        for (const tier of this.payoutTiers) {
            if (compliance >= tier.threshold) {
                return tier.value === 'linear' ? Math.min(compliance, 100) : tier.value;
            }
        }
        return 0;
    },

    getPaymentRates(tiers, compliance) {
        for (const tier of tiers) {
            if (compliance >= tier.threshold) {
                return tier;
            }
        }
        return tiers[tiers.length - 1];
    }
};

const pcCalculation = (achieved, meta) => (meta > 0 ? (achieved / meta) * 100 : 0);

    /**
     * Calcula la comisión por No Retenidos.
     * @param {Object} data - Datos de entrada.
     * @param {number} totalVarMax - Techo de la variable (50% salario).
     * @returns {Object} Dinero generado, cumplimiento y % de cumplimiento CAV.
     */
function calculateNoRetenidos(data, totalVarMax, noRetenidosWeight = businessRules.weights.noRetenidos) {
    const { metaNoRetenidos, porcNoRetenidos, metaCantNoRetenidosCAV, cantNoRetenidosCAV } = data;
    
    // Regla: El cumplimiento es inversamente proporcional al porcentaje de no retenidos.
    let cumplimiento = 0;
    if (porcNoRetenidos > 0) {
        cumplimiento = (metaNoRetenidos / porcNoRetenidos) * 100;
    } else if (porcNoRetenidos === 0 && metaNoRetenidos > 0) {
        // Si no hubo no retenidos y hay meta, se paga al máximo.
        cumplimiento = businessRules.maxPayout;
    }

    // El cumplimiento de cantidad (CAV) es un habilitador: si es < 80%, reduce el pago proporcionalmente.
    const pcCAV = pcCalculation(cantNoRetenidosCAV, metaCantNoRetenidosCAV || 1);
    let payout = businessRules.getVariablePayoutPercentage(cumplimiento);

    if (pcCAV < 80) {
        payout = Math.min((cumplimiento / 100) * (pcCAV / 100) * 100, 100);
    }

    const money = (totalVarMax * noRetenidosWeight) * (payout / 100);
    return { money, compliance: cumplimiento, pcCAV };
}

/**
 * Calcula la comisión por NPS (Satisfacción del Cliente).
 * @param {Object} data - Datos de entrada.
 * @param {number} totalVarMax - Techo de la variable.
 * @returns {Object} Dinero y cumplimiento.
 */
function calculateNPS(data, totalVarMax) {
    const { metaNps, nps, metaTPA, tpa } = data;
    const compliance = pcCalculation(nps, metaNps);
    let payout = businessRules.getVariablePayoutPercentage(compliance);

    // Penalizador TPA: Si el tiempo promedio de atención excede la meta, el NPS se paga 0.
    const tpaMinutes = timeToMinutes(tpa);
    if (metaTPA > 0 && tpaMinutes > metaTPA) {
        payout = 0;
    }

    const money = (totalVarMax * businessRules.weights.nps) * (payout / 100);
    return { money, compliance };
}

/**
 * Calcula la comisión por Convergencia (Unidades de Venta).
 * Si no hay meta, el peso (10%) se transfiere a No Retenidos.
 */
function calculateConvergencia(data, totalVarMax) {
    const { metaUnidadesVentas, unidadesVentas } = data;
    let weightTransferred = false;
    let compliance = 0;
    let payout = 0;
    let money = 0;

    if (metaUnidadesVentas > 0) {
        compliance = pcCalculation(unidadesVentas, metaUnidadesVentas);
        payout = businessRules.getVariablePayoutPercentage(compliance);
        money = (totalVarMax * businessRules.weights.convergencia) * (payout / 100);
    } else {
        weightTransferred = true;
    }

    return { money, compliance, weightTransferred };
}

/**
 * Orquestador del cálculo de VENTAS (Fijo, Pospago y Tecnología).
 * Aplica penalizadores por Brownfield y reglas de escenarios TyT.
 */
function calculateVentas(data) {
    const {
        metaVentasFijoAt, ventasFijoAt, metaPortIn, portIn, metaLineaNueva, lineaNueva,
        metaMigracion, migracion, tvVoz, metaTvVoz, ingresosTec, metaIngresosTec,
        metaBrownfield, brownfield, subFijoNeg, metaSubFijoNeg
    } = data;

    // 1. Cálculos de cumplimiento base
    const pcInternetFijo = pcCalculation((ventasFijoAt || 0) + (subFijoNeg || 0), (metaVentasFijoAt || 0) + (metaSubFijoNeg || 0));
    const pcPospago = pcCalculation((portIn || 0) + (lineaNueva || 0) + (migracion || 0), (metaPortIn || 0) + (metaLineaNueva || 0) + (metaMigracion || 0));
    const pcBrownfield = pcCalculation(brownfield, metaBrownfield);
    const cumpleBrownfield = pcBrownfield >= 100;

    // Factor de penalización por Brownfield
    const factorBrownfield = (metaBrownfield > 0 && !cumpleBrownfield) ? 0.50 : 1.0;

    let ventasMoney = 0;

    // 2. Cálculo FIJO
    const fijoRates = businessRules.getPaymentRates(businessRules.fijoPaymentTiers, pcInternetFijo);
    ventasMoney += (( (ventasFijoAt || 0) + (subFijoNeg || 0) ) * fijoRates.pagoPorInternet + (tvVoz * fijoRates.pagoPorVozTv));

    // 3. Cálculo POSPAGO
    const metaTotalPospago = (metaPortIn || 0) + (metaLineaNueva || 0) + (metaMigracion || 0);
    if (metaTotalPospago > 0 && pcPospago >= 80) {
        const pospagoRates = businessRules.getPaymentRates(businessRules.pospagoPaymentTiers, pcPospago);
        ventasMoney += ( (portIn * pospagoRates.pagoPortacion) + (lineaNueva * pospagoRates.pagoLineaNueva) + (migracion * pospagoRates.pagoMigracion) );
    }

    // Aplicar penalizador Brownfield a Fijo y Pospago
    ventasMoney *= factorBrownfield;

    // 4. Cálculo TECNOLOGÍA (TyT)
    let tecMoney = 0;
    if (metaIngresosTec > 0 && ingresosTec > 0) {
        const pcTyT = pcCalculation(ingresosTec, metaIngresosTec);
        let tasaTyT = 0;

        if (pcPospago < 80) {
            tasaTyT = 0;
        } else if (pcInternetFijo < 80) {
            tasaTyT = 0.004;
        } else if (pcPospago >= 100 && pcInternetFijo >= 100 && pcTyT >= 100) {
            tasaTyT = 0.020;
        } else if (pcPospago >= 80 && pcInternetFijo >= 80) {
            tasaTyT = 0.010;
        } else {
            tasaTyT = 0;
        }

        tecMoney = ingresosTec * tasaTyT;
        ventasMoney += tecMoney;
    }

    return { 
        money: ventasMoney, 
        pcInternetFijo, pcPospago, pcBrownfield, 
        pcTecTerm: pcCalculation(ingresosTec, metaIngresosTec),
        pcPortIn: pcCalculation(portIn, metaPortIn),
        pcLineaNueva: pcCalculation(lineaNueva, metaLineaNueva),
        pcMigracion: pcCalculation(migracion, metaMigracion),
        pcFijoAt: pcCalculation(ventasFijoAt, metaVentasFijoAt),
        pcFijoNegocios: pcCalculation(subFijoNeg, metaSubFijoNeg),
        pcTvVoz: pcCalculation(tvVoz, metaTvVoz)
    };
}

/**
 * Orquestador principal de la remuneración variable.
 * Suma todos los componentes y devuelve el resultado para la UI.
 */
function calculateRemuneration(data) {
    if (!data || data.sueldoBase <= 0) return { totalVarPorc: 0, remVar: 0, ui: {}, breakdown: {} };

    const totalVarMax = data.sueldoBase * businessRules.weights.totalVariableMax;

    const convergencia = calculateConvergencia(data, totalVarMax);
    let nrWeight = businessRules.weights.noRetenidos + (convergencia.weightTransferred ? businessRules.weights.convergencia : 0);
    
    const noRetenidos = calculateNoRetenidos(data, totalVarMax, nrWeight);
    const nps = calculateNPS(data, totalVarMax);
    const ventas = calculateVentas(data);

    const pcClaroUp = data.metaClaroUp > 0 ? (data.claroUpEjec / data.metaClaroUp) * 100 : 0;
    const claroUpMoney = data.claroUpEjec * businessRules.incentives.claroUpValue * Math.min(pcClaroUp / 100, businessRules.incentives.factorCap);

    const remVar = ventas.money + noRetenidos.money + nps.money + convergencia.money + claroUpMoney;
    const totalVarPorc = totalVarMax > 0 ? (remVar / totalVarMax) * 100 : 0;

    return {
        totalVarPorc, remVar, totalVarMax,
        ui: {
            pcPospago: ventas.pcPospago,
            pcFijo: ventas.pcInternetFijo,
            pcTotalComision: totalVarPorc,
            pcNoRetenidos: noRetenidos.compliance,
            pcNPS: nps.compliance,
            pcConv: convergencia.compliance,
            pcClaroUp: pcClaroUp,
            pcPortIn: ventas.pcPortIn,
            pcLineaNueva: ventas.pcLineaNueva,
            pcMigracion: ventas.pcMigracion,
            pcFijoAt: ventas.pcFijoAt,
            pcFijoNegocios: ventas.pcFijoNegocios,
            pcTvVoz: ventas.pcTvVoz,
            pcIngresosTec: ventas.pcTecTerm,
            pcBrownfield: ventas.pcBrownfield,
            pcCantNoRetenidosCAV: noRetenidos.pcCAV,
            pcTPA: data.metaTPA > 0 ? (data.metaTPA / (timeToMinutes(data.tpa) || 1)) * 100 : 0
        },
        breakdown: {
            ventasTotal: ventas.money,
            noRetenidos: noRetenidos.money,
            nps: nps.money,
            convergencia: convergencia.money,
            claroUp: claroUpMoney
        },
        weights: {
            ventas: (businessRules.weights.ventas * 100),
            noRetenidos: (nrWeight * 100),
            nps: (businessRules.weights.nps * 100),
            convergencia: (businessRules.weights.convergencia * 100),
            claroUp: 0 // Incentivo extra, no tiene peso en la variable base
        }
    };
}

export function calculateStandardPolicy() {
    const data = {
        sueldoBase: getNumericValue('sueldoBase', true),
        metaNps: getNumericValue('metaNps', true),
        nps: getNumericValue('nps', true),
        metaUnidadesVentas: getNumericValue('metaUnidadesVentas', true),
        unidadesVentas: getNumericValue('unidadesVentas', true),
        metaVentasFijoAt: getNumericValue('metaVentasFijoAt', true),
        ventasFijoAt: getNumericValue('ventasFijoAt', true),
        metaPortIn: getNumericValue('metaPortIn', true),
        portIn: getNumericValue('portIn', true),
        metaLineaNueva: getNumericValue('metaLineaNueva', true),
        lineaNueva: getNumericValue('lineaNueva', true),
        metaMigracion: getNumericValue('metaMigracion', true),
        migracion: getNumericValue('migracion', true),
        tvVoz: getNumericValue('tvVoz', true),
        metaTvVoz: getNumericValue('metaTvVoz', true),
        ingresosTec: getNumericValue('ingresosTec', true),
        metaIngresosTec: getNumericValue('metaIngresosTec', true),
        subFijoNeg: getNumericValue('subFijoNeg', true),
        metaSubFijoNeg: getNumericValue('metaSubFijoNeg', true),
        metaBrownfield: getNumericValue('metaBrownfield', true),
        brownfield: getNumericValue('brownfield', true),
        metaNoRetenidos: getNumericValue('metaNoRetenidos', true),
        porcNoRetenidos: getNumericValue('porcNoRetenidos', true),
        metaCantNoRetenidosCAV: getNumericValue('metaCantNoRetenidosCAV', true),
        cantNoRetenidosCAV: getNumericValue('cantNoRetenidosCAV', true),
        metaTPA: timeToMinutes(document.getElementById('metaTPA')?.value) || 0,
        tpa: document.getElementById('tpa')?.value || '0:00',
        metaClaroUp: getNumericValue('metaClaroUp', true),
        claroUpEjec: getNumericValue('claroUpEjec', true)
    };
    
    return calculateRemuneration(data);
}
