// Tests del checklist de "Hoy": horarios, anclas del protocolo, qué
// aplica cada día, orden, porcentaje y racha.
import {
  aMinutos,
  aplicaHoy,
  armarDia,
  diaDelProtocolo,
  faseDelDia,
  fmtHora,
  infoFase,
  horaDelItem,
  horarioDelDia,
  porcentaje,
  racha,
  semanaDelProtocolo,
  siguientePendiente,
  type EntradaDia,
  type HechosDia
} from "../src/lib/hoy";
import { tituloComida } from "../src/lib/nutrition";
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
  fase_desde: null,
  fase_hasta: null,
  orden: 1,
  ...p
});

const vacio = (): HechosDia => ({ comidasMenu: new Set(), comidasManual: new Set(), entreno: false, ticks: new Set() });

// 1. Horas
check("aMinutos acepta HH:MM y HH:MM:SS", aMinutos("05:30") === 330 && aMinutos("19:45:00") === 1185);
check("aMinutos rechaza basura", aMinutos("") === null && aMinutos("25:00") === null && aMinutos("hola") === null);
check("fmtHora en 12 h", fmtHora("05:30") === "5:30 am" && fmtHora("19:30") === "7:30 pm" && fmtHora("12:00") === "12:00 pm" && fmtHora("00:15") === "12:15 am");

// 2. Horario del día y anclas
const h = horarioDelDia(cn);
check("comida con hora cargada", h.comida("cena").min === 20 * 60 && h.comida("cena").real);
check("comida sin hora: estimada, no real", !h.comida("desayuno").real);
check("despertar cargado", h.despertar.min === 330 && h.despertar.real);
check("dormir estimado tras la última comida", !h.dormir.real && h.dormir.min === 20 * 60 + 150);

check("después de entrenar = inicio + duración típica",
  horaDelItem(item({ ancla: "despues_entreno" }), h, 60)?.min === 7 * 60);
check("antes de entrenar = 30 min antes", horaDelItem(item({ ancla: "antes_entreno" }), h, 60)?.min === 5 * 60 + 30);
check("con la cena + desfase", horaDelItem(item({ ancla: "con_cena", offset_min: 15 }), h, 60)?.min === 20 * 60 + 15);
check("hora fija", horaDelItem(item({ ancla: "hora_fija", hora: "09:00:00" }), h, 60)?.min === 540);
check("en el día: sin hora", horaDelItem(item({ ancla: "en_el_dia" }), h, 60) === null);
const sinEntreno = horarioDelDia({ ...cn, hora_entreno: "" });
check("sin hora de entreno: lo relativo al entreno no es 'real'",
  horaDelItem(item({ ancla: "despues_entreno" }), sinEntreno, 60)?.real === false);

// 3. ¿Aplica hoy?
check("fuera de los días elegidos no aplica", !aplicaHoy(item({ dias: [1, 4] }), 2, true, 1));
check("solo días de entreno", !aplicaHoy(item({ aplica: "entreno" }), 1, false, 1) && aplicaHoy(item({ aplica: "entreno" }), 1, true, 1));
check("solo días de descanso", !aplicaHoy(item({ aplica: "descanso" }), 1, true, 1));
check("progresión por semanas", !aplicaHoy(item({ semana_desde: 3 }), 1, true, 2) && aplicaHoy(item({ semana_desde: 3, semana_hasta: 4 }), 1, true, 4) && !aplicaHoy(item({ semana_hasta: 2 }), 1, true, 3));
check("lo atado al entreno no aplica en descanso aunque diga 'todos'", !aplicaHoy(item({ ancla: "antes_entreno", aplica: "todos" }), 3, false, 1) && aplicaHoy(item({ ancla: "antes_entreno" }), 1, true, 1));
check("semana del protocolo", semanaDelProtocolo("2026-09-01", "2026-09-01") === 1 && semanaDelProtocolo("2026-09-01", "2026-09-08") === 2 && semanaDelProtocolo("2026-09-01", "2026-08-20") === 1);

// 4. Armar el día (lunes de entreno)
const base: EntradaDia = {
  fecha: "2026-09-21",
  diaSemana: 1,
  cn,
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

// Agrupación: lo del mismo segmento a la misma hora es una sola casilla
const rutina = armarDia({
  ...base,
  protocolo: {
    inicio: "2026-09-21",
    items: [
      item({ id: "00000000-0000-0000-0000-0000000000c1", segmento: "Cara", titulo: "Limpiador suave (mañana)", detalle: "20 s", ancla: "al_despertar", orden: 1 }),
      item({ id: "00000000-0000-0000-0000-0000000000c2", segmento: "Cara", titulo: "Protector solar", detalle: "rostro y cuello", porque: "fotoprotección", ancla: "al_despertar", orden: 2 }),
      item({ id: "00000000-0000-0000-0000-0000000000c3", segmento: "Suplementos", titulo: "Creatina 5 g", ancla: "al_despertar", orden: 3 }),
      item({ id: "00000000-0000-0000-0000-0000000000c4", segmento: "Cara", titulo: "Retinol", ancla: "antes_dormir", orden: 4 })
    ]
  }
});
const cara = rutina.filter((i) => i.segmento === "Cara");
check("misma hora y segmento: una casilla; otra hora: otra casilla", cara.length === 2, cara.map((c) => c.titulo));
check("la casilla agrupada lleva los nombres, sin '(mañana)'", cara[0].titulo === "Limpiador suave, Protector solar", cara[0].titulo);
check("la clave es la del primer ítem", cara[0].key === "p:00000000-0000-0000-0000-0000000000c1");
check("detalle y por qué juntos", cara[0].detalle === "20 s · rostro y cuello" && cara[0].porque === "Protector solar: fotoprotección", cara[0]);
check("otro segmento a la misma hora va aparte", rutina.some((i) => i.titulo === "Creatina 5 g"));

const conAgua = armarDia({
  ...base,
  protocolo: { inicio: "2026-09-21", items: [item({ id: "00000000-0000-0000-0000-0000000000a1", segmento: "Hidratación", titulo: "Agua 3-4 L" })] }
});
check("si el protocolo trae el agua, no se repite la de la app", conAgua.filter((i) => /agua/i.test(i.titulo)).length === 1 && !conAgua.some((i) => i.key === "agua"));

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

// 7. Horas del menú por tipo de día y pre/post-entreno
const cnTemprano: CuestionarioNutricion = { ...cn, comidas: [], hora_entreno: "05:00", hora_despertar: undefined };
const hEntreno = horarioDelDia(cnTemprano, { pre_entreno: "04:30", post_entreno: "06:30", desayuno: "09:30" }, 75);
const hDescanso = horarioDelDia(cnTemprano, { desayuno: "08:30" }, 75);
check("la hora del menú manda (entreno 9:30, descanso 8:30)",
  hEntreno.comida("desayuno").min === 9 * 60 + 30 && hDescanso.comida("desayuno").min === 8 * 60 + 30);
check("pre-entreno sin hora propia: media hora antes del entreno",
  horarioDelDia(cnTemprano).comida("pre_entreno").min === 4 * 60 + 30);
check("post-entreno sin hora propia: al terminar + 15 min",
  horarioDelDia(cnTemprano, {}, 75).comida("post_entreno").min === 5 * 60 + 75 + 15);
check("despertar estimado antes de la primera comida aunque sea de madrugada",
  !hEntreno.despertar.real && hEntreno.despertar.min === 4 * 60);
check("con el post-entreno usa la hora del batido",
  horaDelItem(item({ ancla: "con_post_entreno" }), hEntreno, 75)?.min === 6 * 60 + 30);
check("15 min antes de entrenar = entreno − 15",
  horaDelItem(item({ ancla: "antes_entreno", offset_min: -15 }), hEntreno, 75)?.min === 4 * 60 + 45);
check("con el pre-entreno no aplica en descanso", !aplicaHoy(item({ ancla: "con_pre_entreno" }), 7, false, 1));

const diaV = armarDia({
  fecha: "2026-10-05",
  diaSemana: 1,
  cn: cnTemprano,
  entreno: { diaId: "d1", nombre: "Pecho", ejercicios: 5 },
  minutosEntreno: 75,
  menu: [
    { momento: "desayuno", titulo: "Desayuno", detalle: "", hora: "09:30" },
    { momento: "pre_entreno", titulo: "Pre-entreno", detalle: "", hora: "04:30" },
    { momento: "post_entreno", titulo: "Post-entreno", detalle: "", hora: "06:30" }
  ],
  aguaMl: null,
  protocolo: null,
  hechos: vacio()
});
check("pre, entreno, post y desayuno en orden",
  diaV.map((i) => i.key).join(",") === "comida:pre_entreno,entreno,comida:post_entreno,comida:desayuno",
  diaV.map((i) => i.key));

// 8. Fases
const fases = [
  { nombre: "Fase 1", desde_dia: 1, nota: "Salud intestinal" },
  { nombre: "Fase 2", desde_dia: 8, nota: null },
  { nombre: "Fase 3", desde_dia: 15, nota: null }
];
check("día del protocolo", diaDelProtocolo("2026-10-05", "2026-10-05") === 1 && diaDelProtocolo("2026-10-05", "2026-10-12") === 8);
check("fase del día", faseDelDia(fases, 1) === 1 && faseDelDia(fases, 7) === 1 && faseDelDia(fases, 8) === 2 && faseDelDia(fases, 40) === 3);
check("sin fases no hay fase", faseDelDia([], 10) === null);
const creatina = item({ titulo: "Creatina", fase_desde: 2 });
check("lo de la fase 2 no aplica en la 1", !aplicaHoy(creatina, 1, true, 1, 1) && aplicaHoy(creatina, 1, true, 2, 2) && aplicaHoy(creatina, 1, true, 3, 3));
check("hasta una fase", !aplicaHoy(item({ fase_hasta: 1 }), 1, true, 2, 2) && aplicaHoy(item({ fase_hasta: 1 }), 1, true, 1, 1));
check("si el protocolo no tiene fases, la fase del ítem no cuenta", aplicaHoy(creatina, 1, true, 1, null));

const conFases = armarDia({
  fecha: "2026-10-06",
  diaSemana: 2,
  cn,
  entreno: null,
  minutosEntreno: 60,
  menu: null,
  aguaMl: null,
  protocolo: { inicio: "2026-10-05", fases, items: [item({ id: "00000000-0000-0000-0000-0000000000f1", titulo: "Omega 3" }), { ...creatina, id: "00000000-0000-0000-0000-0000000000f2" }] },
  hechos: vacio()
});
check("en la fase 1 solo aparece lo de la fase 1", conFases.filter((i) => i.tipo === "protocolo").map((i) => i.titulo).join() === "Omega 3");

const info = infoFase(fases, "2026-10-05", "2026-10-10", [item({ titulo: "Omega 3" }), creatina, item({ titulo: "DIM", fase_desde: 3 })]);
check("info de la fase: número, día y próxima",
  info?.numero === 1 && info.total === 3 && info.dia === 6 && info.hasta === "2026-10-11" &&
    info.proxima?.fecha === "2026-10-12" && info.proxima.nuevos.join() === "Creatina" && info.nuevos.join() === "Omega 3",
  info);
const info3 = infoFase(fases, "2026-10-05", "2026-10-20", [creatina]);
check("la última fase no tiene próxima", info3?.numero === 3 && info3.proxima === null && info3.hasta === null && info3.diaDeLaFase === 2);
const antes = infoFase(fases, "2026-10-05", "2026-10-03", []);
check("antes de empezar: fase 1 con día ≤ 0", antes?.numero === 1 && antes.dia === -1);

// Título de cada comida: el plato solo si dice algo más que el momento
check("plato distinto se suma", tituloComida("cena", "Cena ligera") === "Cena · Cena ligera");
check("plato igual al momento no se repite", tituloComida("almuerzo", "Comida") === "Comida" && tituloComida("pre_entreno", "Pre-entreno") === "Pre-entreno");

console.log(fallos ? `\n${fallos} TEST(S) FALLARON` : "\nTODOS LOS TESTS PASAN");
if (fallos) process.exit(1);
