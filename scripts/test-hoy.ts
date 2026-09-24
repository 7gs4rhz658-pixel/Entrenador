// Tests del checklist de "Hoy": horarios, anclas del protocolo, qué
// aplica cada día, orden, porcentaje y racha.
import {
  aMinutos,
  aplicaHoy,
  armarDia,
  fmtHora,
  horaDelItem,
  horarioDelDia,
  porcentaje,
  racha,
  semanaDelProtocolo,
  siguientePendiente,
  type EntradaDia,
  type HechosDia
} from "../src/lib/hoy";
import type { CuestionarioNutricion, ProtocoloItem } from "../src/lib/types";

let fallos = 0;
function check(nombre: string, cond: boolean, detalle?: unknown) {
  if (cond) console.log(`  OK  ${nombre}`);
  else {
    fallos++;
    console.log(`  FAIL ${nombre}`, detalle ?? "");
  }
}

const cn: CuestionarioNutricion = {
  comidas: [
    { momento: "almuerzo", hora: "12:30" },
    { momento: "merienda", hora: "16:30" },
    { momento: "cena", hora: "20:00" }
  ],
  hora_entreno: "06:00",
  hora_despertar: "05:30",
  alergias: "",
  no_come: "",
  cocina: "cocino",
  batch_cooking: false,
  dia_batch: null,
  presupuesto: "medio",
  pais: "MX"
};

const item = (p: Partial<ProtocoloItem>): ProtocoloItem => ({
  id: p.id ?? "00000000-0000-0000-0000-000000000001",
  user_id: "u",
  protocolo_id: "p",
  segmento: "Suplementos",
  titulo: "x",
  detalle: "",
  porque: null,
  ancla: "en_el_dia",
  offset_min: 0,
  hora: null,
  dias: [1, 2, 3, 4, 5, 6, 7],
  aplica: "todos",
  semana_desde: null,
  semana_hasta: null,
  orden: 1,
  ...p
});

const vacio = (): HechosDia => ({ comidasMenu: new Set(), comidasManual: new Set(), entreno: false, ticks: new Set() });

// 1. Horas
check("aMinutos acepta HH:MM y HH:MM:SS", aMinutos("05:30") === 330 && aMinutos("19:45:00") === 1185);
check("aMinutos rechaza basura", aMinutos("") === null && aMinutos("25:00") === null && aMinutos("hola") === null);
check("fmtHora en 12 h", fmtHora("05:30") === "5:30 am" && fmtHora("19:30") === "7:30 pm" && fmtHora("12:00") === "12:00 pm" && fmtHora("00:15") === "12:15 am");

// 2. Horario del día y anclas
const h = horarioDelDia(cn, null);
check("comida con hora cargada", h.comida("cena").min === 20 * 60 && h.comida("cena").real);
check("comida sin hora: estimada, no real", !h.comida("desayuno").real);
check("despertar cargado", h.despertar.min === 330 && h.despertar.real);
check("dormir estimado tras la última comida", !h.dormir.real && h.dormir.min === 20 * 60 + 150);
const hTxt = horarioDelDia(cn, { cena: "19:30" });
check("las horas del entrenador pisan las del cuestionario", hTxt.comida("cena").min === 19 * 60 + 30);

check("después de entrenar = inicio + duración típica",
  horaDelItem(item({ ancla: "despues_entreno" }), h, 60)?.min === 7 * 60);
check("antes de entrenar = 30 min antes", horaDelItem(item({ ancla: "antes_entreno" }), h, 60)?.min === 5 * 60 + 30);
check("con la cena + desfase", horaDelItem(item({ ancla: "con_cena", offset_min: 15 }), h, 60)?.min === 20 * 60 + 15);
check("hora fija", horaDelItem(item({ ancla: "hora_fija", hora: "09:00:00" }), h, 60)?.min === 540);
check("en el día: sin hora", horaDelItem(item({ ancla: "en_el_dia" }), h, 60) === null);
const sinEntreno = horarioDelDia({ ...cn, hora_entreno: "" }, null);
check("sin hora de entreno: lo relativo al entreno no es 'real'",
  horaDelItem(item({ ancla: "despues_entreno" }), sinEntreno, 60)?.real === false);

// 3. ¿Aplica hoy?
check("fuera de los días elegidos no aplica", !aplicaHoy(item({ dias: [1, 4] }), 2, true, 1));
check("solo días de entreno", !aplicaHoy(item({ aplica: "entreno" }), 1, false, 1) && aplicaHoy(item({ aplica: "entreno" }), 1, true, 1));
check("solo días de descanso", !aplicaHoy(item({ aplica: "descanso" }), 1, true, 1));
check("progresión por semanas", !aplicaHoy(item({ semana_desde: 3 }), 1, true, 2) && aplicaHoy(item({ semana_desde: 3, semana_hasta: 4 }), 1, true, 4) && !aplicaHoy(item({ semana_hasta: 2 }), 1, true, 3));
check("semana del protocolo", semanaDelProtocolo("2026-09-01", "2026-09-01") === 1 && semanaDelProtocolo("2026-09-01", "2026-09-08") === 2 && semanaDelProtocolo("2026-09-01", "2026-08-20") === 1);

// 4. Armar el día (lunes de entreno)
const base: EntradaDia = {
  fecha: "2026-09-21",
  diaSemana: 1,
  cn,
  horarios: null,
  entreno: { diaId: "d1", nombre: "Pull", ejercicios: 6 },
  minutosEntreno: 60,
  menu: [
    { momento: "almuerzo", titulo: "Almuerzo", detalle: "" },
    { momento: "merienda", titulo: "Merienda", detalle: "" },
    { momento: "cena", titulo: "Cena", detalle: "" }
  ],
  aguaMl: 3400,
  protocolo: {
    inicio: "2026-09-21",
    items: [
      item({ id: "00000000-0000-0000-0000-00000000000a", titulo: "Creatina 5 g", ancla: "al_despertar" }),
      item({ id: "00000000-0000-0000-0000-00000000000b", titulo: "Whey 2 scoops", ancla: "despues_entreno", aplica: "entreno" }),
      item({ id: "00000000-0000-0000-0000-00000000000c", titulo: "Magnesio", ancla: "con_cena" }),
      item({ id: "00000000-0000-0000-0000-00000000000d", titulo: "Retinol", ancla: "antes_dormir", dias: [2, 4] })
    ]
  },
  hechos: vacio()
};
const dia = armarDia(base);
const orden = dia.map((i) => i.titulo.replace(/^Entreno · /, ""));
check("orden por hora: despertar, entreno, whey, almuerzo, merienda, cena, magnesio, agua",
  orden.join("|") === "Creatina 5 g|Pull|Whey 2 scoops|Almuerzo|Merienda|Cena|Magnesio|Agua: 3.4 L", orden);
check("el retinol no aplica el lunes", !orden.includes("Retinol"));
check("la cena va antes que el magnesio a la misma hora", orden.indexOf("Cena") < orden.indexOf("Magnesio"));
check("hora visible solo si es real", dia.find((i) => i.key === "agua")?.hora === "" && dia.find((i) => i.key === "entreno")?.hora === "06:00");

const descanso = armarDia({ ...base, fecha: "2026-09-23", diaSemana: 3, entreno: null });
check("día de descanso: sin entreno ni whey", !descanso.some((i) => i.tipo === "entreno" || i.titulo.startsWith("Whey")));

const sinMenu = armarDia({ ...base, menu: null, protocolo: null });
check("sin menú: comidas del cuestionario con enlace a Nutrición",
  sinMenu.filter((i) => i.tipo === "comida").length === 3 && sinMenu.every((i) => i.tipo !== "comida" || (i.href === "/nutricion" && !i.conMenu)));

// 5. Hechos, porcentaje y "ahora"
const hechos = vacio();
hechos.comidasMenu.add("almuerzo");
hechos.comidasManual.add("cena");
hechos.entreno = true;
hechos.ticks.add("p:00000000-0000-0000-0000-00000000000a");
const marcado = armarDia({ ...base, hechos });
const cena = marcado.find((i) => i.key === "comida:cena");
check("comida registrada a mano cuenta como hecha y no se desmarca desde acá", !!cena?.hecho && !!cena?.soloManual);
check("porcentaje del día", porcentaje(marcado) === 50, porcentaje(marcado));
check("porcentaje de lista vacía = null", porcentaje([]) === null);
const ahora = siguientePendiente(marcado, 15 * 60);
check("'ahora' a las 15:00 es la merienda (lo de la mañana quedó atrás)", ahora?.key === "comida:merienda", ahora?.key);
const noche = marcado.map((i) => (i.key === "agua" ? { ...i, hecho: true } : i));
check("'ahora' vuelve al primer pendiente si ya pasó todo lo de más tarde",
  siguientePendiente(noche, 23 * 60 + 50)?.key === "p:00000000-0000-0000-0000-00000000000b", siguientePendiente(noche, 23 * 60 + 50)?.key);

// 6. Racha
const d = (pcts: (number | null)[]) => pcts.map((pct, i) => ({ fecha: `d${i}`, pct }));
check("hoy incompleto no corta la racha", racha(d([20, 80, 90, 70, 40])) === 3);
check("hoy cumplido suma", racha(d([100, 80, 50])) === 2);
check("un día flojo corta", racha(d([0, 69, 100])) === 0);
check("antes de arrancar el plan corta", racha(d([90, 90, null, 100])) === 2);

console.log(fallos ? `\n${fallos} TEST(S) FALLARON` : "\nTODOS LOS TESTS PASAN");
if (fallos) process.exit(1);
