// Cobro del plan. Es MANUAL: el cliente le paga al entrenador por
// transferencia o en efectivo, toca "Ya pagué" y el entrenador lo
// confirma desde su panel ("marcar pagado" / "renovar"). La app no toca
// datos de tarjeta. El resto de la app solo mira `profiles.estado_pago` y
// `pago_vence_at`, que un cliente no puede cambiar (trigger de 0019).

// Precio, moneda y cómo pagar se cambian desde Vercel sin tocar código.
function precioMes(): number {
  const n = Number(process.env.PLAN_PRECIO ?? process.env.PLAN_PRECIO_USD);
  return Number.isFinite(n) && n > 0 ? n : 50;
}

function monedaPlan(): "MXN" | "USD" {
  return process.env.PLAN_MONEDA?.trim().toUpperCase() === "MXN" ? "MXN" : "USD";
}

export const PLAN = {
  nombre: "Plan mensual con seguimiento",
  get precio() {
    return precioMes();
  },
  get moneda() {
    return monedaPlan();
  },
  get simbolo() {
    return monedaPlan() === "MXN" ? "$" : "US$";
  },
  incluye: [
    "Rutina personalizada por bloques, con el paso a paso de cada ejercicio",
    "Ajustes de carga semana a semana",
    "Recomendación de comidas a tu medida, lista de compras y registro diario",
    "Seguimiento de tu entrenador desde su panel"
  ]
};

// Datos para pagar (banco, CLABE, titular, "efectivo en el gym"…): texto
// libre de la variable PAGO_INSTRUCCIONES. Sin ella, el entrenador se los
// pasa en persona.
export function instruccionesPago(): string | null {
  const t = process.env.PAGO_INSTRUCCIONES?.replace(/\\n/g, "\n").trim();
  return t ? t : null;
}

// "Ya pagué" se puede volver a tocar recién pasado este tiempo
export const HORAS_ENTRE_AVISOS = 12;

// ¿El último "ya pagué" del cliente sigue sin confirmar?
export function avisoPagoPendiente(perfil: { pago_avisado_at: string | null; pagado_at: string | null }): boolean {
  if (!perfil.pago_avisado_at) return false;
  return !perfil.pagado_at || Date.parse(perfil.pago_avisado_at) > Date.parse(perfil.pagado_at);
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
