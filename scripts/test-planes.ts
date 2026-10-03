// Tests de la generación de planes: saneado de la respuesta de la IA y
// plantilla sin IA.
import { normalizarPlan, planPlantilla } from "../src/lib/plan-generator";
import { objetivosDiarios, gramosEquivalentes } from "../src/lib/nutrition";
import type { Ingredient } from "../src/lib/types";

let fallos = 0;
function check(nombre: string, cond: boolean, detalle?: unknown) {
  if (cond) console.log(`  OK  ${nombre}`);
  else {
    fallos++;
    console.log(`  FAIL ${nombre}`, detalle ?? "");
  }
}

// 1. Respuesta "sucia" de la IA: días repetidos, valores fuera de rango,
//    enums inválidos, ejercicio sin nombre.
const sucio = {
  nombre_bloque: "  Hipertrofia 3 días  ",
  dias: [
    {
      dia_semana: 1,
      nombre: "Empuje",
      ejercicios: [
        { nombre: "Press banca", grupo_muscular: "pecho", unidad: "kg", progresion: "compuesto",
          series: 14, rep_min: 8, rep_max: 6, peso_inicial_kg: 60.3, incremento_kg: 3, descanso_seg: 9999 },
        { nombre: "", grupo_muscular: "pecho" },
        { nombre: "Flexiones", grupo_muscular: "pecho", unidad: "peso_corporal", progresion: "compuesto",
          series: 3, rep_min: 10, rep_max: 15 }
      ]
    },
    { dia_semana: 1, nombre: "Repetido", ejercicios: [{ nombre: "Sentadilla", grupo_muscular: "invalido", progresion: "compuesto" }] },
    { dia_semana: 12, nombre: "Fuera de rango", ejercicios: [{ nombre: "Remo", grupo_muscular: "espalda" }] },
    { dia_semana: 4, nombre: "Vacío", ejercicios: [] }
  ]
};
const plan = normalizarPlan(sucio, [1, 3, 5]);
check("nombre del bloque recortado", plan.nombre_bloque === "Hipertrofia 3 días");
check("día vacío descartado; días 1, 3 y 5 (repetido y fuera de rango reubicados en los disponibles)",
  plan.dias.map((d) => d.dia_semana).join() === "1,3,5", plan.dias.map((d) => d.dia_semana));
const press = plan.dias[0].ejercicios[0];
check("series acotadas a 10", press.series === 10, press.series);
check("rep_max nunca menor que rep_min", press.rep_max >= press.rep_min, [press.rep_min, press.rep_max]);
check("peso redondeado a 0,25", press.peso_inicial_kg === 60.25, press.peso_inicial_kg);
check("incremento inválido → 2,5", press.incremento_kg === 2.5);
check("descanso acotado a 600", press.descanso_seg === 600);
check("ejercicio sin nombre descartado", plan.dias[0].ejercicios.length === 2);
const flex = plan.dias[0].ejercicios[1];
check("peso corporal fuerza progresión solo_reps", flex.progresion === "solo_reps", flex.progresion);
check("descripción y tips autogenerados si faltan", !!flex.descripcion && (flex.tips?.length ?? 0) > 0);
check("grupo inválido → se deduce del nombre (sentadilla → pierna)", plan.dias[1].ejercicios[0].grupo_muscular === "pierna", plan.dias[1].ejercicios[0].grupo_muscular);

// 2. Sin ningún día válido → error
let tiro = false;
try {
  normalizarPlan({ dias: [{ dia_semana: 2, ejercicios: [] }] });
} catch {
  tiro = true;
}
check("plan sin ejercicios tira error", tiro);

// 3. Plantilla según días y equipamiento
const p3 = planPlantilla({
  experiencia: "principiante", dias_disponibles: [2, 4, 6], minutos_sesion: 60,
  equipamiento: "gimnasio", lesiones: "", preferencias: ""
});
check("plantilla 3 días: empuje / tracción / pierna en mar, jue, sáb",
  p3.dias.map((d) => `${d.dia_semana}:${d.nombre}`).join() === "2:Empuje,4:Tracción,6:Pierna",
  p3.dias.map((d) => `${d.dia_semana}:${d.nombre}`));
const p1 = planPlantilla({
  experiencia: "principiante", dias_disponibles: [1], minutos_sesion: 30,
  equipamiento: "sin_equipo", lesiones: "", preferencias: ""
});
check("plantilla 1 día sin equipo: cuerpo completo con peso corporal",
  p1.dias.length === 1 && p1.dias[0].ejercicios.every((e) => e.unidad !== "kg" || e.nombre.includes("goblet") || e.nombre.includes("mancuerna")),
  p1.dias[0].ejercicios.map((e) => `${e.nombre}/${e.unidad}`));
check("plantilla sin cuestionario no explota", planPlantilla(null).dias.length === 3);

// 4. Macros por objetivo
const base = { edad: 30, sexo: "masculino" as const, peso_kg: 80, altura_cm: 180, nivel_actividad: "ligero" as const };
const sup = objetivosDiarios({ ...base, objetivo: "superavit" }, true);
const def = objetivosDiarios({ ...base, objetivo: "deficit" }, true);
const man = objetivosDiarios({ ...base, objetivo: "mantenimiento" }, false);
check("superávit > mantenimiento > déficit en kcal", sup.kcal > man.kcal && man.kcal > def.kcal, [sup.kcal, man.kcal, def.kcal]);
check("proteína 2 g/kg (160) y 2,2 en déficit (176)", sup.prot_g === 160 && def.prot_g === 176);
check("los macros cierran con las kcal (±40)",
  Math.abs(sup.prot_g * 4 + sup.carb_g * 4 + sup.grasa_g * 9 - sup.kcal) <= 40, sup);
check("agua: 35 ml/kg + 600 en entreno = 3400", sup.agua_ml === 3400, sup.agua_ml);

// 5. Sustitución por regla de tres
const frutos: Ingredient = { id: "a", nombre: "Frutos rojos", marca: null, fuente: "manual", off_code: null, kcal_100: 47, prot_100: 0.9, carb_100: 11.4, grasa_100: 0.4 };
const manzana: Ingredient = { id: "b", nombre: "Manzana", marca: null, fuente: "usda", off_code: null, kcal_100: 52, prot_100: 0.3, carb_100: 13.8, grasa_100: 0.2 };
check("150 g frutos rojos → 124 g manzana igualando carbos", gramosEquivalentes(frutos, 150, manzana, "carb") === 124);
check("150 g frutos rojos → 136 g manzana igualando kcal", gramosEquivalentes(frutos, 150, manzana, "kcal") === 136);
const aceite: Ingredient = { ...manzana, id: "c", nombre: "Aceite", kcal_100: 884, prot_100: 0, carb_100: 0, grasa_100: 100 };
check("igualar carbos con un ingrediente sin carbos → null", gramosEquivalentes(frutos, 150, aceite, "carb") === null);

console.log(fallos === 0 ? "\nTODOS LOS TESTS PASAN" : `\n${fallos} TEST(S) FALLARON`);
process.exit(fallos === 0 ? 0 : 1);
