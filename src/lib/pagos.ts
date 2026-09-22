// Cobro del plan. Hoy es un checkout SIMULADO: acepta cualquier tarjeta
// con formato válido y marca al cliente como pagado. Para cobrar de
// verdad, reemplazá `procesarPago` por la integración del proveedor
// (Mercado Pago Checkout Pro o Stripe Checkout): el resto de la app solo
// mira `profiles.estado_pago`, así que el cambio queda contenido acá.

// El precio se cambia desde Vercel (variable PLAN_PRECIO_USD) sin tocar
// código; si no está definida vale 50.
function precioMes(): number {
  const n = Number(process.env.PLAN_PRECIO_USD);
  return Number.isFinite(n) && n > 0 ? n : 50;
}

export const PLAN = {
  nombre: "Plan mensual con seguimiento",
  get precio() {
    return precioMes();
  },
  moneda: "USD",
  simbolo: "US$",
  incluye: [
    "Rutina personalizada de 8 semanas con progresión ondulada",
    "Ajustes de carga semana a semana",
    "Recomendación de comidas a tu medida, lista de compras y registro diario",
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

// ── Vigencia del mes ────────────────────────────────────────────

export const DIAS_POR_PAGO = 30;

export interface EstadoPago {
  pagado: boolean;
  vencido: boolean;
  vence: string | null; // YYYY-MM-DD
  diasRestantes: number | null; // negativo si venció
}

// Fecha hasta la que cubre un pago hecho hoy: 30 días desde hoy o desde
// el vencimiento vigente si todavía no pasó (renovar antes no pierde días).
export function nuevoVencimiento(venceActual: string | null, hoy: string): string {
  const base = venceActual && venceActual > hoy ? venceActual : hoy;
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + DIAS_POR_PAGO);
  return d.toISOString().slice(0, 10);
}

export function estadoPago(
  perfil: { estado_pago: "pendiente" | "pagado"; pago_vence_at: string | null },
  hoy: string
): EstadoPago {
  if (perfil.estado_pago !== "pagado") return { pagado: false, vencido: false, vence: null, diasRestantes: null };
  if (!perfil.pago_vence_at) return { pagado: true, vencido: false, vence: null, diasRestantes: null };
  const dias = Math.round((new Date(`${perfil.pago_vence_at}T12:00:00Z`).getTime() - new Date(`${hoy}T12:00:00Z`).getTime()) / 86_400_000);
  return { pagado: true, vencido: dias < 0, vence: perfil.pago_vence_at, diasRestantes: dias };
}
