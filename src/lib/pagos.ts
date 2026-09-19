// Cobro del plan. Hoy es un checkout SIMULADO: acepta cualquier tarjeta
// con formato válido y marca al cliente como pagado. Para cobrar de
// verdad, reemplazá `procesarPago` por la integración del proveedor
// (Mercado Pago Checkout Pro o Stripe Checkout): el resto de la app solo
// mira `profiles.estado_pago`, así que el cambio queda contenido acá.

export const PLAN = {
  nombre: "Plan mensual con seguimiento",
  precio: 25000,
  moneda: "ARS",
  incluye: [
    "Rutina personalizada de 8 semanas con progresión ondulada",
    "Ajustes de carga semana a semana",
    "Plan de nutrición con macros y registro de comidas",
    "Seguimiento de tu entrenador desde su panel"
  ]
};

export const PAGO_SIMULADO = true;

export interface DatosTarjeta {
  titular: string;
  numero: string;
  vencimiento: string; // MM/AA
  cvv: string;
}

export interface ResultadoPago {
  ok: boolean;
  referencia?: string;
  error?: string;
}

export async function procesarPago(datos: DatosTarjeta): Promise<ResultadoPago> {
  const numero = datos.numero.replace(/\s+/g, "");
  if (datos.titular.trim().length < 3) return { ok: false, error: "Poné el nombre del titular." };
  if (!/^\d{13,19}$/.test(numero)) return { ok: false, error: "El número de tarjeta no es válido." };
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(datos.vencimiento.trim())) {
    return { ok: false, error: "El vencimiento tiene que ser MM/AA." };
  }
  if (!/^\d{3,4}$/.test(datos.cvv.trim())) return { ok: false, error: "Revisá el código de seguridad." };
  // Tarjeta de prueba clásica para simular un rechazo
  if (numero.endsWith("0002")) return { ok: false, error: "Pago rechazado por el banco (simulado)." };
  return { ok: true, referencia: `SIM-${Date.now().toString(36).toUpperCase()}` };
}
