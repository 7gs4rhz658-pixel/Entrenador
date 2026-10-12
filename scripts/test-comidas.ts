// Tests del menú: cuadre de proteína/carbohidratos/grasa, alimentos que el
// cliente no come y elección del alimento de la base (sinónimos, plural).
import {
  MENCIONA_GRAMOS,
  ajusteDeCantidades,
  ajustarAMacros,
  calcularTandas,
  cambiosDeGramos,
  chocaCon,
  elegir,
  grupoDe,
  listaCompras,
  metasDelAjuste,
  metasPorKcal,
  mismosAlimentos,
  palabrasAEvitar,
  redondearGramos,
  sinMedida,
  soloCambianCifras,
  totalesDe
} from "../src/lib/meal-plan";
import type { Ingredient, ItemComidaResuelto, MealPlanItem } from "../src/lib/types";

let fallos = 0;
function check(nombre: string, cond: boolean, detalle?: unknown) {
  if (cond) console.log(`  OK  ${nombre}`);
  else {
    fallos++;
    console.log(`  FAIL ${nombre}`, detalle ?? "");
  }
}

const ing = (nombre: string, kcal: number, p: number, c: number, g: number, alias: string | null = null, fuente: Ingredient["fuente"] = "usda"): Ingredient => ({
  id: nombre,
  nombre,
  marca: null,
  fuente,
  off_code: null,
  kcal_100: kcal,
  prot_100: p,
  carb_100: c,
  grasa_100: g,
  alias
});
const POLLO = ing("Pechuga de pollo (cruda)", 120, 22.5, 0, 2.6);
const CAMOTE = ing("Camote (cocido)", 76, 1.4, 17.7, 0.1, "camote hervido, batata hervida");
const AGUACATE = ing("Aguacate", 160, 2, 8.5, 14.7, "palta");
const HUEVO = ing("Huevo entero", 143, 12.6, 0.7, 9.5);
const BROCOLI = ing("Brócoli", 34, 2.8, 6.6, 0.4);
const SALMON = ing("Salmón (crudo)", 208, 20.4, 0, 13.4);

const item = (ingredient: Ingredient, cantidad_g: number, nota: string | null = null, tipo_dia: "entreno" | "descanso" = "entreno"): ItemComidaResuelto => ({
  tipo_dia,
  momento: "almuerzo",
  orden: 1,
  plato: "",
  nombre_pedido: ingredient.nombre,
  ingredient,
  cantidad_g,
  nota
});

// 1. Grupos
check("pollo y salmón van a la proteína", grupoDe(item(POLLO, 100)) === "p" && grupoDe(item(SALMON, 100)) === "p");
check("camote a carbohidratos, aguacate a grasa", grupoDe(item(CAMOTE, 100)) === "c" && grupoDe(item(AGUACATE, 100)) === "g");
check("verdura y lo que va por piezas no se toca", grupoDe(item(BROCOLI, 150)) === null && grupoDe(item(HUEVO, 150, "3 piezas")) === null);
check("gramos de cocina", redondearGramos(183) === 185 && redondearGramos(7.4) === 7 && redondearGramos(0.2) === 1);

// 2. Cuadre: el día de entreno del plan de OBED (1735 kcal, C 169, G 47)
// sube a lo que pide su propio texto (2150, P 140, C 250, G 65)
const PLATANO = ing("Plátano", 89, 1.1, 22.8, 0.3);
const GALLETAS = ing("Galletas de arroz", 387, 8.2, 81.5, 2.8);
const MIEL = ing("Miel", 304, 0.3, 82.4, 0);
const WHEY = ing("Proteína whey isolate", 370, 87, 3, 1.5);
const PESCADO = ing("Pescado blanco (crudo)", 82, 17.8, 0, 0.7);
const ACEITE = ing("Aceite de oliva", 884, 0, 0, 100);
const SEMILLAS = ing("Semillas de girasol", 584, 20.8, 20, 51.5);
const YOGUR = ing("Yogur griego descremado", 59, 10.2, 3.6, 0.4);
const dia = [
  item(GALLETAS, 18, "2 piezas"), item(MIEL, 15), item(PLATANO, 100, "1 pieza"), item(WHEY, 45),
  item(HUEVO, 150, "3 piezas"), item(YOGUR, 100), item(POLLO, 150), item(CAMOTE, 180), item(AGUACATE, 40),
  item(HUEVO, 50, "1 pieza"), item(SEMILLAS, 15), item(PESCADO, 150), item(CAMOTE, 180), item(BROCOLI, 150), item(ACEITE, 5)
];
const meta = { kcal: 2150, prot_g: 140, carb_g: 250, grasa_g: 65 };
const antes = totalesDe(dia, "entreno");
const despues = ajustarAMacros(dia, { entreno: meta, descanso: { kcal: 0, prot_g: 0, carb_g: 0, grasa_g: 0 } });
const t = totalesDe(despues, "entreno");
const cerca = (a: number, b: number, tol: number) => Math.abs(a - b) / b <= tol;
check("antes estaba lejos", !cerca(antes.carb_g, meta.carb_g, 0.1), antes);
check("después: carbohidratos y grasa a ±10 %, proteína a ±15 %", cerca(t.carb_g, meta.carb_g, 0.1) && cerca(t.grasa_g, meta.grasa_g, 0.1) && cerca(t.prot_g, meta.prot_g, 0.15), t);
check("brócoli y lo que va por piezas quedan igual", despues[13].cantidad_g === 150 && despues[4].cantidad_g === 150 && despues[2].cantidad_g === 100);
check("nada se dispara más de ×2.5", despues.every((d, k) => d.cantidad_g <= dia[k].cantidad_g * 2.5 + 5));
check("el otro tipo de día sin meta no se toca", ajustarAMacros([item(POLLO, 100, null, "descanso")], { entreno: meta, descanso: { kcal: 0, prot_g: 0, carb_g: 0, grasa_g: 0 } })[0].cantidad_g === 100);

// 3. Lo que el cliente no come
const evitar = palabrasAEvitar("no como tigo, arroz y maiz", "", "Alergias: mariscos");
check("palabras a evitar sin relleno", evitar.includes("arroz") && evitar.includes("maiz") && evitar.includes("marisco") && !evitar.includes("como"), evitar);
check("galletas de arroz chocan con arroz", chocaCon("Galletas de arroz", evitar) === "arroz" && chocaCon("Tortilla de maíz", evitar) === "maiz");
check("pollo no choca", chocaCon("Pechuga de pollo (cruda)", evitar) === null);

// 4. Elegir de la base: sinónimos, plural y la base propia antes que OFF
check("camote por su otro nombre", elegir("Batata hervida", [CAMOTE, POLLO])?.nombre === "Camote (cocido)");
check("plural y singular", elegir("Aguacates", [AGUACATE])?.nombre === "Aguacate");
check("crudo pedido elige crudo", elegir("Salmón", [ing("Salmón (cocido)", 206, 22, 0, 12.4), SALMON], "crudo")?.nombre === "Salmón (crudo)");
check("la base propia gana a un producto de marca", elegir("Aguacate", [ing("Aguacates", 205, 2, 9, 19, null, "off"), AGUACATE])?.fuente === "usda");

// Lista de compras y guía de cocina
const delMenu = (nombre: string, g: number) =>
  ({ tipo_dia: "entreno", ingredient_id: nombre, ingredient: ing(nombre, 100, 1, 1, 1), cantidad_g: g }) as unknown as MealPlanItem;
const compras = listaCompras([delMenu("Vinagre de manzana", 15), delMenu("Aceite de aguacate", 10), delMenu("Aguacate", 40), delMenu("Huevo entero", 100)], 5);
const practicoDe = (n: string) => compras.find((c) => c.nombre === n)?.practico ?? "";
check("vinagre de manzana no son manzanas", !/manzana/.test(practicoDe("Vinagre de manzana")), practicoDe("Vinagre de manzana"));
check("aceite de aguacate no son aguacates", !/aguacate/.test(practicoDe("Aceite de aguacate")), practicoDe("Aceite de aguacate"));
check("aguacate y huevo sí van en piezas", /aguacates?$/.test(practicoDe("Aguacate")) && /huevos$/.test(practicoDe("Huevo entero")), [practicoDe("Aguacate"), practicoDe("Huevo entero")]);
const tandas = calcularTandas([delMenu("Semillas de calabaza", 25), delMenu("Camote (cocido)", 250)], 5);
check(
  "las semillas no van al horno",
  tandas.flatMap((t) => t.items).every((i) => !/Semillas/.test(i.nombre)) && tandas.some((t) => t.tecnica === "Horno"),
  JSON.stringify(tandas)
);

// 5. Llevar un menú a otras calorías solo con gramos: el día de entreno
// del plan de salud intestinal de OBED (1869 kcal) a 2250 y a 1500
const ESPINACA = ing("Espinaca", 23, 2.9, 3.6, 0.4);
const SEMILLAS_CAL = ing("Semillas de calabaza", 559, 30.2, 10.7, 49.1);
const FRUTOS = ing("Frutos rojos (mix)", 47, 0.9, 11.4, 0.4);
const obed = [
  item(GALLETAS, 18, "2 piezas"), item(PLATANO, 100, "mediano"), item(MIEL, 15, "1 cucharada sopera"), item(WHEY, 30), item(FRUTOS, 100),
  item(HUEVO, 100, "en omelet"), item(ESPINACA, 150), item(YOGUR, 100), item(AGUACATE, 40),
  item(POLLO, 150), item(CAMOTE, 250), item(ACEITE, 15, "crudo, 1 cucharada (15 ml)"), item(HUEVO, 50, "cocido"), item(SEMILLAS_CAL, 25),
  item(POLLO, 130), item(CAMOTE, 160), item(BROCOLI, 150), item(AGUACATE, 40)
].map((i, k) => ({ ...i, momento: (["pre_entreno", "desayuno", "almuerzo", "merienda", "cena"] as const)[Math.min(4, Math.floor(k / 4))] }));
const sinMeta = { kcal: 0, prot_g: 0, carb_g: 0, grasa_g: 0 };
const delObed = totalesDe(obed, "entreno");
check("whey va por scoop: no se escala", grupoDe(item(WHEY, 30)) === null);
const m2250 = metasPorKcal(delObed, 2250);
check("la proteína de la meta queda como en el menú", m2250.prot_g === Math.round(delObed.prot_g) && m2250.carb_g > delObed.carb_g && m2250.grasa_g > delObed.grasa_g, m2250);
const referencia = { kcal: 1869, prot_g: 140, carb_g: 200, grasa_g: 60 };
check("con las calorías de la referencia, sus macros", metasDelAjuste(delObed, referencia, 1869) === referencia && metasDelAjuste(delObed, referencia, 2250).prot_g === Math.round(delObed.prot_g));
for (const kcal of [2250, 1500]) {
  const ajustado = ajusteDeCantidades(obed, { entreno: metasPorKcal(delObed, kcal), descanso: sinMeta }).items;
  const total = totalesDe(ajustado, "entreno");
  check(`${kcal} kcal: llega a ±0.5 %`, cerca(total.kcal, kcal, 0.005), total);
  check(`${kcal} kcal: proteína a ±5 %`, cerca(total.prot_g, delObed.prot_g, 0.05), total);
  check(
    `${kcal} kcal: mismos alimentos; huevos, whey, galletas y verduras igual`,
    mismosAlimentos(obed, ajustado) && [0, 3, 5, 6, 12, 16].every((k) => ajustado[k].cantidad_g === obed[k].cantidad_g),
    ajustado.map((a) => a.cantidad_g)
  );
}
const a2250 = ajusteDeCantidades(obed, { entreno: m2250, descanso: sinMeta });
check("2250 kcal: lista lo que cambió y no avisa", a2250.cambios.some((c) => /^Día de entreno · Comida: Camote \(cocido\) 250 → \d+ g$/.test(c)) && !a2250.aviso, a2250.cambios);
check("si llega sin ellas, las medidas de cocina no se tocan", [1, 2, 11].every((k) => a2250.items[k].cantidad_g === obed[k].cantidad_g && a2250.items[k].nota === obed[k].nota));
const a1400 = ajusteDeCantidades(obed, { entreno: metasPorKcal(delObed, 1400), descanso: sinMeta });
check(
  "1400 kcal: sin medidas no llega; con ellas sí, y la nota deja la medida",
  cerca(totalesDe(a1400.items, "entreno").kcal, 1400, 0.01) && a1400.items[2].cantidad_g < 15 && a1400.items[2].nota === null && a1400.items[11].nota === "crudo" && a1400.cambios.some((c) => c.endsWith("(ya no «1 cucharada sopera»)")),
  [a1400.items[2], a1400.items[11], a1400.cambios]
);
check("nota sin la medida", sinMedida("crudo, 1 cucharada (15 ml)") === "crudo" && sinMedida("mediano") === null && sinMedida("peso cocido; o papa") === "peso cocido; o papa");
const a1250 = ajusteDeCantidades(obed, { entreno: metasPorKcal(delObed, 1250), descanso: sinMeta });
check(
  "1250 kcal no se alcanza solo con gramos: avisa y nada baja de ×0.4",
  /no se llega: el día de entreno queda en \d+ kcal \(meta 1250\)/.test(a1250.aviso ?? "") && a1250.items.every((d, k) => d.cantidad_g >= obed[k].cantidad_g * 0.4 - 1),
  a1250.aviso
);

// 6. Qué cambió y la guía de cocina
const cambiado = obed.map((i, k) => (k === 10 ? { ...i, cantidad_g: 365 } : i));
const cambios = cambiosDeGramos(obed, cambiado);
check("lista lo que cambió de gramos", cambios.length === 1 && cambios[0].nombre === "Camote (cocido)" && cambios[0].antes === 250 && cambios[0].despues === 365, cambios);
check("otro alimento ya no son los mismos", !mismosAlimentos(obed, [...obed, item(PLATANO, 100)]));
const pasos = ["Sepáralos en tápers con el peso en la tapa (\"250g\" o \"160g\").", "Hornea a 200 °C por 35-40 minutos."];
check("la guía menciona gramos", MENCIONA_GRAMOS.test(pasos[0]) && !MENCIONA_GRAMOS.test(pasos[1]));
check("solo cifras: vale", soloCambianCifras(pasos, ["Sepáralos en tápers con el peso en la tapa (\"365g\" o \"235g\").", pasos[1]]));
check("otra palabra o un paso de menos: no vale", !soloCambianCifras(pasos, [pasos[0].replace("tápers", "recipientes"), pasos[1]]) && !soloCambianCifras(pasos, [pasos[0]]));

console.log(fallos ? `\n${fallos} TEST(S) FALLARON` : "\nTODOS LOS TESTS PASAN");
if (fallos) process.exit(1);
