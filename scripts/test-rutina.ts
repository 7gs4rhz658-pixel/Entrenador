// Tests de las rutinas del entrenador por fases: lectura del plan (fases,
// cadencias, parciales, superseries), qué toca cada semana, la guía de
// cadencia y la progresión "del plan".
import { diasParaOrdinales, normalizarPlan } from "../src/lib/plan-generator";
import { planSiguienteFijo } from "../src/lib/progression";
import {
  activoEnSemana,
  clasificarEjercicio,
  etapaDelBloque,
  faseDeSemana,
  faseQueEmpieza,
  grupoSuperserie,
  parcialesDeFase,
  parsearTempo,
  pasosDeLaSerie,
  pasosDeRespaldo,
  repsDeSerie,
  secuenciaCadencia,
  tempoConNota,
  textoRep
} from "../src/lib/rutina";
import { infoEjercicio } from "../src/lib/exercise-info";
import type { FaseRutina } from "../src/lib/types";

let fallos = 0;
function check(nombre: string, cond: boolean, detalle?: unknown) {
  if (cond) console.log(`  OK  ${nombre}`);
  else {
    fallos++;
    console.log(`  FAIL ${nombre}`, detalle ?? "");
  }
}
const tt = (t: ReturnType<typeof parsearTempo>) => t?.texto ?? null;

// ── Cadencia ──
const base = parsearTempo("3-5-3-0")!;
check("parsea 3-5-3-0", base.concentrico === 3 && base.contraccion === 5 && base.excentrico === 3 && base.estiramiento === 0);
check("parsea con guiones largos y sin el cuarto número", tt(parsearTempo("1–0–3")) === "1-0-3-0");
check("tempo inválido → null", parsearTempo("lento") === null && parsearTempo("0-0-0-0") === null);
check("prensa: 5 s abajo en estiramiento → 3-0-3-5", tt(tempoConNota(base, "5s isometría abajo en estiramiento + 10 parciales")) === "3-0-3-5");
check("peso muerto rumano: 5s estiramiento abajo → 3-0-3-5", tt(tempoConNota(base, "5s estiramiento abajo")) === "3-0-3-5");
check("talones: estiramiento + punta → 3-5-3-5", tt(tempoConNota(base, "5s isometría en estiramiento + 5s en punta")) === "3-5-3-5");
check("cruces: 'cruce abajo' es contracción → 3-5-3-0", tt(tempoConNota(base, "5s cruce abajo")) === "3-5-3-0");
check("bajada en 3s fija el regreso", tt(tempoConNota(parsearTempo("1-0-2-0"), "Pesado, bajada en 3s")) === "1-0-3-0");
check("rest-pause: '10s descanso' no es cadencia", tt(tempoConNota(base, "al fallo + 10s descanso + 10 parciales")) === "3-5-3-0");
check("texto de la repetición", textoRep(base, { fuerza: "Empuja", regreso: "Baja" }) === "Empuja 3 s → aprieta 5 s → baja 3 s", textoRep(base, { fuerza: "Empuja", regreso: "Baja" }));

// ── Clasificación por nombre ──
const cl = (n: string) => clasificarEjercicio(n);
check("curl femoral es pierna", cl("Curl Femoral Tumbado").grupo === "pierna");
check("press francés es brazo y no compuesto", cl("Press Francés Declinado").grupo === "brazo" && !cl("Press Francés Declinado").compuesto);
check("press militar es hombro y compuesto", cl("Press Militar Sentado (Mancuernas)").grupo === "hombro" && cl("Press Militar Sentado").compuesto);
check("face pull es hombro; encogimientos espalda", cl("Face Pull Polea Alta").grupo === "hombro" && cl("Encogimientos Trapecio").grupo === "espalda");
check("rueda abdominal: core y peso corporal", cl("Rueda Abdominal (Ab Wheel)").grupo === "core" && cl("Rueda Abdominal").pesoCorporal);
check("fondos lastrados no son peso corporal", !cl("Fondos Paralelas (Lastrados)").pesoCorporal);
check("referencia técnica: katana", infoEjercicio("Extensiones Tríceps Katana", "brazo").descripcion.includes("detrás de la cabeza"));
check("referencia técnica: laterales en polea baja", infoEjercicio("Elevaciones Laterales Polea", "hombro").descripcion.startsWith("Polea baja"));
check("referencia técnica: curl femoral no cae en bíceps", infoEjercicio("Curl Femoral Tumbado", "pierna").descripcion.includes("Boca abajo"));
check("referencia: dominadas antes que jalón", infoEjercicio("Dominadas con Lastre o Jalón Pesado", "espalda").descripcion.startsWith("Colgado"));
check("sin referencia específica → genérica", !infoEjercicio("Ejercicio raro", "otro").especifica);

// ── Días "Día N" ──
check("3 días → lunes, miércoles, viernes", diasParaOrdinales(3).join() === "1,3,5");
check("5 días con L-S disponibles → L a V", diasParaOrdinales(5, [1, 2, 3, 4, 5, 6]).join() === "1,2,3,4,5");
check("3 días con solo L-M-M → esos tres", diasParaOrdinales(3, [1, 2, 3]).join() === "1,2,3");
check("parciales de la fase en las reglas", JSON.stringify(parcialesDeFase(["Series de 20: 10 repeticiones completas ultra lentas seguidas de 10 parciales cortas."])) === '{"completas":10,"parciales":10}');

// ── Lectura de un plan por fases (como lo devuelve la IA) ──
const fuente = `FASE 1
Día 1: Push • Press Inclinado Mancuernas: 4 series × 20 reps
Día 2: Pull • Curl Araña Barra Z / Curl Martillo: 3 series × 20 reps cada uno (5s isometría en pico)
Día 5: Arms • Elevaciones Laterales Máquina: 3 series de 20 reps al fallo + 10s descanso + 10 parciales`;
const raw = {
  nombre_bloque: "Macrociclo",
  total_semanas: 8,
  notas_entrenador: "Métricas de éxito: +10 % de carga.",
  fases: [
    {
      nombre: "Oclusión",
      semana_desde: 1,
      semana_hasta: 4,
      reglas: ["Cadencia 3‑5‑3‑0", "Series de 20: 10 repeticiones completas seguidas de 10 parciales cortas."],
      tempo: { concentrico: 3, contraccion: 5, excentrico: 3, estiramiento: 0 },
      dias: [
        { dia: 1, nombre: "Push", ejercicios: [{ nombre: "Press Inclinado Mancuernas", series: 4, reps: "20" }, { nombre: "Prensa 45°", series: 4, reps: "20", nota: "5s isometría abajo en estiramiento" }] },
        { dia: 2, nombre: "Pull", ejercicios: [{ nombre: "Curl Araña Barra Z / Curl Martillo", series: 3, reps: "20", nota: "5s isometría en pico" }, { nombre: "Sentadilla Búlgara", series: 3, reps: "15-20", por_lado: true }] },
        {
          dia: 5,
          nombre: "Arms",
          ejercicios: [
            { nombre: "Curl Predicador", series: 3, reps: "20", superserie: 1 },
            { nombre: "Press Francés Declinado", series: 3, reps: "20", superserie: 1 },
            { nombre: "Elevaciones Laterales Máquina", series: 3, reps: "20", parciales: 10, nota: "Al fallo + 10s descanso + 10 parciales" },
            { nombre: "Rueda Abdominal", series: 3, reps: "10-12" }
          ]
        }
      ]
    },
    {
      nombre: "Tensión mecánica",
      semana_desde: 5,
      semana_hasta: 8,
      reglas: ["6 a 10 repeticiones, RIR 0-1"],
      tempo: { concentrico: 1, contraccion: 0, excentrico: 3, estiramiento: 0 },
      descanso_seg: 120,
      rir: 1,
      dias: [{ dia: 1, nombre: "Push", ejercicios: [{ nombre: "Press Inclinado Mancuernas", series: 4, reps: "6–8" }] }]
    }
  ]
};
const plan = normalizarPlan(raw, [1, 2, 3, 4, 5, 6], { desdeTexto: true, fuente });
const dia = (n: number) => plan.dias.find((d) => d.dia_semana === n)!;
check("3 días ordinales (Día 1, 2, 5) → lunes, miércoles, viernes", plan.dias.map((d) => d.dia_semana).join() === "1,3,5", plan.dias.map((d) => d.dia_semana));
check("las dos fases del lunes en el mismo día", dia(1).ejercicios.length === 3 && dia(1).nombre === "Push");
const [inc1, prensa, inc2] = dia(1).ejercicios;
check("fase 1: semanas 1-4; fase 2: semanas 5-8", inc1.semana_desde === 1 && inc1.semana_hasta === 4 && inc2.semana_desde === 5 && inc2.semana_hasta === 8);
check("cadencia de la fase en cada ejercicio", inc1.tempo?.texto === "3-5-3-0" && inc2.tempo?.texto === "1-0-3-0");
check("la nota corrige la cadencia (prensa 3-0-3-5)", prensa.tempo?.texto === "3-0-3-5", prensa.tempo);
check("10 parciales de la fase en las series de 20", inc1.parciales === 10 && prensa.parciales === 10);
check("fase 2: rango 6-8 y descanso de la fase", inc2.rep_min === 6 && inc2.rep_max === 8 && inc2.descanso_seg === 120);
check("'A / B … cada uno' son dos ejercicios", dia(3).ejercicios.map((e) => e.nombre).join("|") === "Curl Araña Barra Z|Curl Martillo|Sentadilla Búlgara", dia(3).ejercicios.map((e) => e.nombre));
const bulgara = dia(3).ejercicios[2];
check("búlgara 15-20 por lado, sin parciales (rango)", bulgara.por_lado === true && bulgara.parciales == null && bulgara.rep_min === 15);
const brazos = dia(5).ejercicios;
check("superserie 1 en los dos", brazos[0].superserie === "1" && brazos[1].superserie === "1");
check("rest-pause: sin parciales dentro de la serie", brazos[2].parciales == null && !!brazos[2].nota);
check("rueda abdominal → peso corporal (solo_reps)", brazos[3].unidad === "peso_corporal" && brazos[3].progresion === "solo_reps");
check("grupo por nombre (francés → brazo)", brazos[1].grupo_muscular === "brazo");
check("fases saneadas (guion raro → -)", plan.fases?.length === 2 && plan.fases[0].reglas[0] === "Cadencia 3-5-3-0" && plan.fases[1].rir === 1);
check("notas para el entrenador", plan.notas_entrenador === "Métricas de éxito: +10 % de carga.");
const otraVez = normalizarPlan(JSON.parse(JSON.stringify(plan)));
check("sanear un borrador guardado no cambia nada", JSON.stringify(otraVez) === JSON.stringify(plan));
const editado = JSON.parse(JSON.stringify(plan));
editado.dias[0].ejercicios[1].tempo = parsearTempo("2-0-2-0");
check("la cadencia editada a mano se respeta", normalizarPlan(editado).dias[0].ejercicios[1].tempo?.texto === "2-0-2-0");

// ── Qué toca cada semana ──
const fases = plan.fases as FaseRutina[];
check("semana 3: press de fase 1 sí, de fase 2 no", activoEnSemana(inc1, 3) && !activoEnSemana(inc2, 3));
check("semana 5: al revés", !activoEnSemana(inc1, 5) && activoEnSemana(inc2, 5));
check("sin fase: todas las semanas", activoEnSemana({}, 7));
check("fase de la semana 6 = 2", faseDeSemana(fases, 6)?.numero === 2);
check("en la semana 4 avisa que empieza la fase 2", faseQueEmpieza(fases, 4)?.numero === 2 && faseQueEmpieza(fases, 3) === null);
check("etapa del bloque con fases", etapaDelBloque({ fases, progresion: "plan" }, 2) === "Fase 1 · Oclusión");
check("etapa sin fases (ondulada)", etapaDelBloque({ fases: [], progresion: "ondulada" }, 4).startsWith("Fase 4 · Descarga"));

// ── La serie ──
check("20 reps con 10 parciales → 10 + 10", JSON.stringify(repsDeSerie(inc1)) === '{"completas":10,"parciales":10}');
const pasosSerie = pasosDeLaSerie({ ...inc1, verbos: { fuerza: "Sube", regreso: "Baja" } }, 90);
check("la serie paso a paso", pasosSerie.length === 3 && pasosSerie[0].startsWith("10 repeticiones completas: sube 3 s → aprieta 5 s → baja 3 s") && pasosSerie[1].includes("10 parciales"), pasosSerie);
const sec = secuenciaCadencia(base, null, 10, 10);
check("guía: preparación + 10 × 3 tramos + parciales", sec.length === 32 && sec[31].tipo === "parciales" && sec[31].seg === 10);
check("guía: la serie dura 3 + 110 + 10 s", sec.reduce((n, p) => n + p.seg, 0) === 123);
const secLado = secuenciaCadencia(parsearTempo("3-5-3-0")!, null, 2, 0, true);
check("guía por lado: cambia de lado y repite", secLado.filter((p) => p.tipo === "cambio").length === 1 && secLado.filter((p) => p.lado === 2 && p.tipo === "tramo").length === 6);
check("superserie: grupos consecutivos", grupoSuperserie(brazos, 1).join() === "0,1" && grupoSuperserie(brazos, 2).join() === "2");
const respaldo = pasosDeRespaldo(prensa);
check("explicación sin IA: técnica + cadencia + nota", respaldo.pasos[0].includes("prensa") && respaldo.pasos.some((p) => p.includes("pausa estirado 5 s")) && respaldo.pasos.some((p) => p.includes("Indicación del plan")), respaldo.pasos);

// ── Progresión "del plan" ──
const cfg = { progresion: "compuesto" as const, unidad: "kg" as const, incremento_kg: 2.5, rep_min: 6, rep_max: 8 };
const serie = (n: number, reps: number, peso: number) => ({ serie: n, reps, peso_kg: peso, rir: 1, al_fallo: false, completado: true });
const planBase = { series: 3, reps: 6, peso_kg: 40, al_fallo: false };
const tope = planSiguienteFijo(cfg, planBase, [serie(1, 8, 40), serie(2, 8, 40), serie(3, 8, 40)]);
check("tope del rango en todas → +2,5 kg y vuelve al piso", tope.peso_kg === 42.5 && tope.reps === 6 && tope.series === 3, tope);
const corto = planSiguienteFijo(cfg, planBase, [serie(1, 8, 40), serie(2, 7, 40), serie(3, 6, 40)]);
check("una serie sin llegar al tope → mismo peso", corto.peso_kg === 40, corto);
check("sin registros → mismo peso", planSiguienteFijo(cfg, planBase, []).peso_kg === 40);
const definir = planSiguienteFijo(cfg, { ...planBase, peso_kg: null }, [serie(1, 6, 35), serie(2, 6, 37.5)]);
check("peso a definir: toma el máximo registrado", definir.peso_kg === 37.5, definir);
const fijo20 = planSiguienteFijo({ ...cfg, rep_min: 20, rep_max: 20, progresion: "aislamiento" }, { series: 4, reps: 20, peso_kg: 10, al_fallo: false }, [1, 2, 3, 4].map((n) => serie(n, 20, 10)));
check("20 de 20 en las 4 series → sube un escalón (nunca descarga)", fijo20.peso_kg === 12.5 && fijo20.reps === 20, fijo20);
check("al fallo se mantiene", planSiguienteFijo({ ...cfg, progresion: "al_fallo" }, { ...planBase, al_fallo: true }, []).al_fallo);

console.log(fallos ? `${fallos} TEST(S) FALLARON` : "TODOS LOS TESTS PASAN");
if (fallos) process.exit(1);
