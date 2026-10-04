// Aviso diario para el cliente ("mañana te toca" + lo pendiente). Lo
// arma el cron a la tarde y también se puede previsualizar desde el
// panel del entrenador. Determinista, sin IA.

import { getDias, getProtocolo, getUltimaActividad } from "./data";
import { hoyDiaSemana, hoyFecha, nombreDia, sumarDias } from "./format";
import { aplicaHoy, diaDelProtocolo, faseDelDia, semanaDelProtocolo } from "./hoy";
import { recomendacionPara } from "./meal-plan-db";
import { nombreMomento } from "./nutrition";
import { estadoPago } from "./pagos";
import type { CargaPush } from "./push";
import { checkinPendiente } from "./stats";
import type { Profile } from "./types";

export async function armarAvisoDiario(c: Profile): Promise<CargaPush> {
  const hoy = hoyFecha();
  const manana = (hoyDiaSemana() % 7) + 1;
  const partes: string[] = [];
  let url = "/";

  const pago = estadoPago(c, hoy);
  if (pago.vencido) {
    partes.push("Tu mes venció: renueva para seguir con informes y el próximo bloque.");
    url = "/pago";
  } else if (pago.diasRestantes != null && pago.diasRestantes <= 3) {
    partes.push(
      pago.diasRestantes === 0
        ? "Tu mes vence hoy."
        : `Tu mes vence en ${pago.diasRestantes} día${pago.diasRestantes === 1 ? "" : "s"}.`
    );
  }

  const pendiente = await checkinPendiente(c.id);
  if (pendiente) {
    partes.push(`Te falta el check-in de la semana ${pendiente.semana} (1 minuto).`);
    if (url === "/") url = "/checkin";
  }

  const ultima = await getUltimaActividad(c.id);
  const diasSin = ultima ? Math.floor((Date.now() - new Date(ultima).getTime()) / 86_400_000) : null;
  if (diasSin != null && diasSin >= 4) {
    partes.push(`Hace ${diasSin} días que no registras nada. Vuelve con lo de mañana, sin drama.`);
  }

  const dias = await getDias(c.id);
  const diaM = dias.find((d) => d.dia_semana === manana);
  const entrena = diaM ? !diaM.es_descanso : false;
  const reco = await recomendacionPara(c.id, entrena ? "entreno" : "descanso", c.cuestionario_nutricion);
  const primera = reco?.comidas[0];
  const cabeza = entrena ? `${nombreDia(manana)}: ${diaM?.nombre || "entreno"}` : `${nombreDia(manana)}: descanso`;
  const comida = primera ? ` · ${primera.plato || nombreMomento(primera.momento)}` : "";
  const aviso = reco?.avisos[0] ? ` · ${reco.avisos[0]}` : "";
  const protocolo = await getProtocolo(c.id);
  const fechaM = sumarDias(hoy, 1);
  const diaProt = protocolo ? diaDelProtocolo(protocolo.inicio, fechaM) : 0;
  const faseM = protocolo ? faseDelDia(protocolo.protocolo.fases, diaProt) : null;
  const delProtocolo =
    protocolo && diaProt >= 1
      ? protocolo.items.filter((i) => aplicaHoy(i, manana, entrena, semanaDelProtocolo(protocolo.inicio, fechaM), faseM)).length
      : 0;
  const extra = delProtocolo ? ` · ${delProtocolo} de tu protocolo` : "";
  partes.unshift(`${cabeza}${comida}${aviso}${extra}`);

  // Mañana arranca el protocolo o cambia de fase: qué se suma
  if (protocolo && faseM != null && diaProt >= 1) {
    const fase = protocolo.protocolo.fases[faseM - 1];
    if (fase.desde_dia === diaProt) {
      const nuevos = [...new Set(protocolo.items.filter((i) => (i.fase_desde ?? 1) === faseM).map((i) => i.titulo))];
      partes.push(
        `Mañana empiezas la ${fase.nombre}${nuevos.length ? `: ${faseM === 1 ? "arrancas con" : "se suma"} ${nuevos.slice(0, 4).join(", ")}` : ""}.`
      );
    }
  } else if (protocolo && diaProt === 1) {
    partes.push("Mañana empieza tu protocolo: lo ves en Hoy, cada cosa a su hora.");
  }

  return {
    titulo: partes.length > 1 ? "Mañana te toca (y algo más)" : "Mañana te toca",
    cuerpo: partes.join(" "),
    url,
    tag: "diario"
  };
}
