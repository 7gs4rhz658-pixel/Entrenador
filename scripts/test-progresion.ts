// Test rápido del motor de progresión ondulada de 4 semanas.
import {
  acotarSugerencia,
  cumplioPlan,
  faseDe,
  planSiguiente,
  redondearAlIncremento,
  type ConfigEjercicio,
  type PlanBase,
  type RegistroSerie
} from "../src/lib/progression";

let fallos = 0;
function check(nombre: string, cond: boolean, detalle?: unknown) {
  if (cond) console.log(`  OK  ${nombre}`);
  else {
    fallos++;
    console.log(`  FAIL ${nombre}`, detalle ?? "");
  }
}

const logs = (
  series: { reps: number; peso?: number | null; rir?: number | null }[]
): RegistroSerie[] =>
  series.map((s, i) => ({
    serie: i + 1,
    reps: s.reps,
    peso_kg: s.peso === undefined ? null : s.peso,
    rir: s.rir ?? null,
    al_fallo: false,
    completado: true
  }));

// Fases
check("fase de semana 1..8 = 1,2,3,4,1,2,3,4",
  [1, 2, 3, 4, 5, 6, 7, 8].map(faseDe).join() === "1,2,3,4,1,2,3,4");

// Ciclo completo de un aislamiento 10–15 con 20 kg
const cruce: ConfigEjercicio = {
  progresion: "aislamiento", unidad: "kg", incremento_kg: 2.5, rep_min: 10, rep_max: 15
};
const s1: PlanBase = { series: 3, reps: 10, peso_kg: 20, al_fallo: false };
const ok = (reps: number, peso: number) => logs([{reps, peso},{reps, peso},{reps, peso}]);

let r = planSiguiente(cruce, 1, s1, null, ok(10, 20));
check("sem 1→2: mismo peso, tope de reps (15 × 20 kg)", r.reps === 15 && r.peso_kg === 20, r);
const s2: PlanBase = { ...s1, reps: 15 };

r = planSiguiente(cruce, 2, s2, s1, ok(15, 20));
check("sem 2→3: sube peso, piso de reps (10 × 22,5 kg)", r.reps === 10 && r.peso_kg === 22.5, r);
const s3: PlanBase = { ...s1, reps: 10, peso_kg: 22.5 };

r = planSiguiente(cruce, 3, s3, s2, ok(10, 22.5));
check("sem 3→4: descarga 50 % (10 × 12,5 kg)", r.reps === 10 && r.peso_kg === 12.5, r);
const s4: PlanBase = { ...s1, reps: 10, peso_kg: 12.5 };

r = planSiguiente(cruce, 4, s4, s3, ok(10, 12.5));
check("sem 4→5: reinicia con el peso de la sem 3 (10 × 22,5 kg), no el original",
  r.reps === 10 && r.peso_kg === 22.5, r);

// Red de seguridad: en la semana 2 no llegó al piso → no sube
r = planSiguiente(cruce, 2, s2, s1, logs([{reps:12,peso:20},{reps:9,peso:20},{reps:8,peso:20}]));
check("sem 2→3 sin llegar al piso: mantiene 20 kg", r.peso_kg === 20 && r.reps === 10, r);

// Compuesto con rango por defecto 8–12
const press: ConfigEjercicio = {
  progresion: "compuesto", unidad: "kg", incremento_kg: 2.5, rep_min: null, rep_max: null
};
const p1: PlanBase = { series: 3, reps: 8, peso_kg: 70, al_fallo: false };
r = planSiguiente(press, 1, p1, null, ok(8, 70));
check("compuesto sem 1→2: 12 reps × 70", r.reps === 12 && r.peso_kg === 70, r);

// Peso a definir: el primer registro fija la base y sigue la fase
const tri: PlanBase = { series: 3, reps: 10, peso_kg: null, al_fallo: false };
r = planSiguiente(cruce, 1, tri, null, logs([{reps:10,peso:25},{reps:10,peso:27.5},{reps:9,peso:27.5}]));
check("peso a definir → toma el máximo (27,5) y pasa a fase 2 (15 reps)",
  r.peso_kg === 27.5 && r.reps === 15, r);
r = planSiguiente(cruce, 1, tri, null, []);
check("peso a definir sin registros → sigue null", r.peso_kg === null, r);

// Sin peso: ondula en reps (flexiones 15–20)
const flex: ConfigEjercicio = {
  progresion: "solo_reps", unidad: "peso_corporal", incremento_kg: 2.5, rep_min: 15, rep_max: 20
};
const f1: PlanBase = { series: 3, reps: 15, peso_kg: null, al_fallo: false };
r = planSiguiente(flex, 1, f1, null, ok(15, 0));
check("solo_reps sem 1→2: 20 reps", r.reps === 20, r);
const f2 = { ...f1, reps: 20 };
r = planSiguiente(flex, 2, f2, f1, ok(20, 0));
check("solo_reps sem 2→3: 17 reps (piso + 2)", r.reps === 17, r);
const f3 = { ...f1, reps: 17 };
r = planSiguiente(flex, 3, f3, f2, ok(17, 0));
check("solo_reps sem 3→4: descarga 9 reps", r.reps === 9, r);
const f4 = { ...f1, reps: 9 };
r = planSiguiente(flex, 4, f4, f3, ok(9, 0));
check("solo_reps sem 4→5: reinicia en 17", r.reps === 17, r);

// al_fallo: se mantiene
const cuello: ConfigEjercicio = {
  progresion: "al_fallo", unidad: "sin_peso", incremento_kg: 2.5, rep_min: null, rep_max: null
};
const c: PlanBase = { series: 3, reps: null, peso_kg: null, al_fallo: true };
r = planSiguiente(cuello, 2, c, c, logs([{reps:20},{reps:15},{reps:12}]));
check("al_fallo se mantiene", r.al_fallo && r.reps === null && r.peso_kg === null);

// Redondeo y acotado de la sugerencia de IA
check("redondeo 11,25 → 12,5 con paso 2,5", redondearAlIncremento(11.25, 2.5) === 12.5);
check("redondeo nunca baja del incremento", redondearAlIncremento(0.4, 2.5) === 2.5);
check("acotar: sugerencia razonable (24) pasa → 25", acotarSugerencia(22.5, 24, 2.5) === 25);
check("acotar: sugerencia loca (60) se recorta a +15 % → 25", acotarSugerencia(22.5, 60, 2.5) === 25);
check("acotar: sugerencia muy baja (5) se recorta a −15 % → 20", acotarSugerencia(22.5, 5, 2.5) === 20);

// cumplioPlan estricto con peso
check("cumplioPlan falla si un set quedó corto",
  !cumplioPlan(p1, logs([{reps:8,peso:70},{reps:8,peso:70},{reps:7,peso:70}])));
check("cumplioPlan ok con reps de más",
  cumplioPlan(p1, logs([{reps:9,peso:70},{reps:8,peso:72.5},{reps:8,peso:70}])));

console.log(fallos === 0 ? "\nTODOS LOS TESTS PASAN" : `\n${fallos} TEST(S) FALLARON`);
process.exit(fallos === 0 ? 0 : 1);
