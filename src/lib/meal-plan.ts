// Recomendación de comidas: todo lo determinista y sin base de datos.
// Sanea lo que devuelve la IA, cuadra el menú con la referencia diaria y
// deriva la lista de compras, los avisos de preparación y las tandas de
// batch cooking. Resolver ingredientes y escribir en la base vive en
// meal-plan-db.ts.

import { macrosDe, sumarMacros, type Macros } from "./nutrition";
import type {
  BatchCooking,
  ComidaGenerada,
  CuestionarioNutricion,
  Ingredient,
  ItemComidaResuelto,
  MealPlanItem,
  Momento,
  PlanComidasGenerado,
  TipoDia
} from "./types";

const MOMENTOS: Momento[] = ["desayuno", "almuerzo", "merienda", "cena", "snack"];
export const TIPOS_DIA: TipoDia[] = ["entreno", "descanso"];

export function normalizarTexto(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── 1. Sanear el JSON de la IA ──────────────────────────────────

function normalizarComidas(raw: unknown, permitidos?: Momento[]): ComidaGenerada[] {
  const lista = Array.isArray(raw) ? raw : [];
  const out: ComidaGenerada[] = [];
  for (const c of lista) {
    const cc = (c ?? {}) as Partial<ComidaGenerada>;
    const momento = String(cc.momento ?? "").toLowerCase() as Momento;
    if (!MOMENTOS.includes(momento)) continue;
    if (permitidos && !permitidos.includes(momento)) continue;
    const ingredientes = (Array.isArray(cc.ingredientes) ? cc.ingredientes : [])
      .map((i) => {
        const ii = (i ?? {}) as { nombre?: unknown; gramos?: unknown; nota?: unknown };
        const gramos = Number(ii.gramos);
        return {
          nombre: String(ii.nombre ?? "").trim().slice(0, 80),
          gramos: Number.isFinite(gramos) ? Math.min(2000, Math.max(1, Math.round(gramos))) : 0,
          nota: ii.nota ? String(ii.nota).trim().slice(0, 80) : undefined
        };
      })
      .filter((i) => i.nombre && i.gramos > 0)
      .slice(0, 6);
    if (!ingredientes.length) continue;
    // "Desayuno" como nombre de plato no aporta nada
    let plato = String(cc.plato ?? "").trim().slice(0, 80);
    if (normalizarTexto(plato) === momento) plato = "";
    out.push({ momento, plato, ingredientes });
  }
  // Orden natural del día; los momentos repetidos se conservan en orden
  const pos = (m: Momento) => (permitidos ?? MOMENTOS).indexOf(m);
  return out.sort((a, b) => pos(a.momento) - pos(b.momento));
}

export function normalizarPlanComidas(raw: unknown, permitidos?: Momento[]): PlanComidasGenerado {
  const r = (raw ?? {}) as Partial<PlanComidasGenerado>;
  let entreno = normalizarComidas(r.entreno, permitidos);
  let descanso = normalizarComidas(r.descanso, permitidos);
  // Un solo menú (el .txt suele traerlo así): vale para los dos días
  if (!entreno.length && descanso.length) entreno = descanso;
  if (!descanso.length && entreno.length) descanso = entreno;
  return {
    nombre: String(r.nombre ?? "").trim().slice(0, 80) || "Recomendación de comidas",
    notas: r.notas ? String(r.notas).trim().slice(0, 400) : undefined,
    entreno,
    descanso
  };
}

// ── 3. Cuadrar con la referencia diaria ─────────────────────────

const esHidrato = (i: Ingredient) => i.carb_100 * 4 >= i.kcal_100 * 0.55 && i.kcal_100 >= 50;

// Si las calorías de un tipo de día se desvían más de 5 % de la
// referencia, escala los ingredientes ricos en carbohidratos (arroz,
// avena, pan, fruta...) para cerrar la diferencia. Nunca más de ×1.5 ni
// menos de ×0.6 para no deformar el plato.
export function cuadrarMacros(
  items: ItemComidaResuelto[],
  objetivo: Record<TipoDia, Macros>
): ItemComidaResuelto[] {
  const out = items.map((i) => ({ ...i }));
  for (const tipo of TIPOS_DIA) {
    const del = out.filter((i) => i.tipo_dia === tipo && i.ingredient);
    if (!del.length) continue;
    const total = sumarMacros(del.map((i) => macrosDe(i.ingredient!, i.cantidad_g))).kcal;
    const meta = objetivo[tipo].kcal;
    if (!meta || Math.abs(total - meta) / meta <= 0.05) continue;
    const hidratos = del.filter((i) => esHidrato(i.ingredient!));
    const kcalHidratos = sumarMacros(hidratos.map((i) => macrosDe(i.ingredient!, i.cantidad_g))).kcal;
    if (!kcalHidratos) continue;
    const factor = Math.min(1.5, Math.max(0.6, (kcalHidratos + (meta - total)) / kcalHidratos));
    for (const i of hidratos) i.cantidad_g = Math.max(10, Math.round((i.cantidad_g * factor) / 5) * 5);
  }
  return out;
}

// ── 5. Agrupar por momento (para las pantallas) ─────────────────

export interface ComidaDelPlan {
  momento: Momento;
  plato: string;
  items: MealPlanItem[];
  macros: Macros;
}

export function comidasPorMomento(items: MealPlanItem[], tipo: TipoDia): ComidaDelPlan[] {
  const del = items.filter((i) => i.tipo_dia === tipo).sort((a, b) => a.orden - b.orden);
  const mapa = new Map<Momento, MealPlanItem[]>();
  for (const i of del) (mapa.get(i.momento) ?? mapa.set(i.momento, []).get(i.momento)!).push(i);
  return MOMENTOS.filter((m) => mapa.has(m)).map((m) => {
    const lista = mapa.get(m)!;
    return {
      momento: m,
      plato: lista.find((i) => i.plato)?.plato ?? "",
      items: lista,
      macros: sumarMacros(lista.map((i) => macrosDe(i.ingredient, i.cantidad_g)))
    };
  });
}

// Orden de los momentos según el horario del cliente (si lo cargó)
export function ordenarPorHorario(comidas: ComidaDelPlan[], cn: CuestionarioNutricion | null): ComidaDelPlan[] {
  if (!cn?.comidas.length) return comidas;
  const pos = new Map(cn.comidas.map((c, i) => [c.momento, i]));
  return [...comidas].sort((a, b) => (pos.get(a.momento) ?? 99) - (pos.get(b.momento) ?? 99));
}

export function horaDe(momento: Momento, cn: CuestionarioNutricion | null): string {
  return cn?.comidas.find((c) => c.momento === momento)?.hora ?? "";
}

// ── 6. Lista de compras ─────────────────────────────────────────

// Peso aproximado por unidad, para pasar gramos a "unidades" en la lista
const UNIDADES: { patron: RegExp; gramos: number; uno: string; varios: string }[] = [
  { patron: /\bclara/, gramos: 33, uno: "clara", varios: "claras" },
  { patron: /\bhuevo/, gramos: 55, uno: "huevo", varios: "huevos" },
  { patron: /\bbanana|\bpl[aá]tano/, gramos: 120, uno: "banana", varios: "bananas" },
  { patron: /\bmanzana/, gramos: 180, uno: "manzana", varios: "manzanas" },
  { patron: /\bnaranja/, gramos: 150, uno: "naranja", varios: "naranjas" },
  { patron: /\bpera\b/, gramos: 160, uno: "pera", varios: "peras" },
  { patron: /\bmandarina/, gramos: 90, uno: "mandarina", varios: "mandarinas" },
  { patron: /\bkiwi/, gramos: 75, uno: "kiwi", varios: "kiwis" },
  { patron: /\bpalta|\baguacate/, gramos: 200, uno: "palta", varios: "paltas" },
  { patron: /\byogur/, gramos: 125, uno: "pote", varios: "potes" },
  { patron: /\btortilla de (trigo|ma[ií]z)|\brapidita/, gramos: 40, uno: "unidad", varios: "unidades" }
];

export interface ItemCompra {
  nombre: string;
  gramos: number;
  practico: string; // "1,4 kg", "14 huevos", "560 g"
}

function practico(nombre: string, gramos: number): string {
  const n = normalizarTexto(nombre);
  const u = UNIDADES.find((x) => x.patron.test(n));
  if (u) {
    const cant = Math.ceil(gramos / u.gramos);
    return `${cant} ${cant === 1 ? u.uno : u.varios}`;
  }
  if (gramos >= 1000) return `${(Math.ceil(gramos / 50) * 50 / 1000).toLocaleString("es-AR", { maximumFractionDigits: 2 })} kg`;
  return `${Math.ceil(gramos / 10) * 10} g`;
}

// Ingredientes de la semana: menú de entreno × días de entreno + menú de
// descanso × días de descanso.
// La base guarda muchos alimentos ya cocidos ("Arroz (cocido)"); en el
// súper se compran crudos. Factor de peso cocido → crudo por familia.
const A_CRUDO: { patron: RegExp; factor: number }[] = [
  { patron: /\barroz|\bquinoa|\bfideo|\bpasta|\bavena cocid/, factor: 0.4 },
  { patron: /\blenteja|\bgarbanzo|\bporoto|\bfrijol/, factor: 0.45 },
  { patron: /\bpollo|\bpechuga|\bcarne|\bvacun|\bcerdo|\bpescado|\bmerluza|\bsalm|\bpavo|\blomo|\bbife/, factor: 1.3 },
  { patron: /\bpapa|\bbatata|\bboniato|\bcalabaza|\bzapallo|\bzanahoria/, factor: 1.15 }
];

// Nombre para la lista: sin "(cocido)" y con "crudo" si se convirtió
export function aCompra(nombre: string, gramos: number): { nombre: string; gramos: number } {
  const n = normalizarTexto(nombre);
  const limpio = nombre.replace(/\s*\((cocid[oa]s?|hervid[oa]s?|crud[oa]s?)\)/i, "").trim();
  if (!/cocid|hervid/.test(n)) return { nombre: limpio, gramos };
  const regla = A_CRUDO.find((r) => r.patron.test(n));
  if (!regla) return { nombre: limpio, gramos };
  const sufijo = regla.factor < 1 ? " (crudo)" : "";
  return { nombre: `${limpio}${sufijo}`, gramos: gramos * regla.factor };
}

export function listaCompras(items: MealPlanItem[], diasEntreno: number): ItemCompra[] {
  const diasDescanso = 7 - diasEntreno;
  const mapa = new Map<string, { nombre: string; gramos: number }>();
  for (const i of items) {
    const veces = i.tipo_dia === "entreno" ? diasEntreno : diasDescanso;
    if (!veces) continue;
    const e = mapa.get(i.ingredient_id) ?? { nombre: i.ingredient.nombre, gramos: 0 };
    e.gramos += i.cantidad_g * veces;
    mapa.set(i.ingredient_id, e);
  }
  return [...mapa.values()]
    .map((e) => aCompra(e.nombre, e.gramos))
    .sort((a, b) => b.gramos - a.gramos)
    .map((e) => ({ nombre: e.nombre, gramos: Math.round(e.gramos), practico: practico(e.nombre, e.gramos) }));
}

export function textoCompras(lista: ItemCompra[]): string {
  return ["Compras de la semana:", ...lista.map((i) => `• ${i.nombre}: ${i.practico}`)].join("\n");
}

// ── 7. Avisos de preparación ("Mañana te toca") ─────────────────

// "Pechuga de pollo (cocida)" → "pechuga de pollo"
export function limpiarNombre(nombre: string): string {
  return nombre.replace(/\s*\([^)]*\)/g, "").trim().toLowerCase();
}

// La nota del ítem solo aporta si no repite lo que ya dice el nombre
export function notaUtil(nombre: string, nota: string | null | undefined): string | null {
  if (!nota) return null;
  const n = normalizarTexto(nombre);
  const t = normalizarTexto(nota);
  if (!t || n.includes(t)) return null;
  if (/^(cocid|crud|hervid)/.test(t) && /cocid|crud|hervid/.test(n)) return null;
  return nota;
}

const CONGELADO = /\bpollo|\bpechuga|\bcarne|\bvacuno|\bcerdo|\bpescado|\bmerluza|\bsalm[oó]n|\bpavo|\bhamburguesa|\blomo|\bnalga|\bbife/;
const REMOJO = /\blenteja|\bgarbanzo|\bporoto|\bfrijol|\balubia/;

export function avisosPreparacion(comidas: ComidaDelPlan[], cn: CuestionarioNutricion | null): string[] {
  const avisos: string[] = [];
  const vistos = new Set<string>();
  for (const c of comidas) {
    for (const i of c.items) {
      const n = normalizarTexto(i.ingredient.nombre);
      if (CONGELADO.test(n) && !vistos.has("frz:" + n)) {
        vistos.add("frz:" + n);
        avisos.push(`Sacá ${limpiarNombre(i.ingredient.nombre)} del freezer esta noche.`);
      }
      if (REMOJO.test(n) && !vistos.has("rem:" + n)) {
        vistos.add("rem:" + n);
        avisos.push(`Dejá ${limpiarNombre(i.ingredient.nombre)} en remojo desde hoy.`);
      }
      if (/\bavena/.test(n) && c.momento === "desayuno" && !vistos.has("avena")) {
        vistos.add("avena");
        avisos.push("Podés dejar la avena remojando en la heladera y mañana está lista.");
      }
    }
  }
  if (cn?.cocina === "como_fuera" && comidas.some((c) => c.momento === "almuerzo")) {
    avisos.push("Si mañana comés fuera, dejá listo el tupper del almuerzo.");
  }
  return avisos.slice(0, 4);
}

// ── 8. Batch cooking ────────────────────────────────────────────

// Primero manda cómo dice el nombre que se cocina ("hervida", "al horno");
// si no lo dice, el tipo de alimento.
const TECNICAS: { tecnica: string; patron: RegExp }[] = [
  { tecnica: "Hervido", patron: /hervid|\barroz|\bquinoa|\bfideo|\bpasta|\blenteja|\bgarbanzo|\bporoto/ },
  { tecnica: "Horno", patron: /horno|asad|\bbatata|\bboniato|\bpapa\b|\bpapas|\bcalabaza|\bzapallo|\bzanahoria|\bbr[oó]coli|\bcoliflor|\bberenjena|\bmorr[oó]n|\bcebolla/ },
  { tecnica: "Plancha o sartén", patron: CONGELADO }
];

export function calcularTandas(items: MealPlanItem[], diasEntreno: number): BatchCooking["tandas"] {
  const lista = listaCompras(items, diasEntreno);
  const tandas = TECNICAS.map((t) => ({ tecnica: t.tecnica, items: [] as { nombre: string; gramos_semana: number }[] }));
  for (const i of lista) {
    const n = normalizarTexto(i.nombre);
    // Lo que se come fresco o se hace en el momento no va al batch
    if (/\bpan\b|\byogur|\bleche|\bqueso|\blata|\benlatado|\bcopos|\bgalleta|\bavena|\bhuevo|\bclara|\bwhey|\bprote/.test(n)) continue;
    const t = tandas.find((x) => TECNICAS.find((y) => y.tecnica === x.tecnica)!.patron.test(n));
    if (t) t.items.push({ nombre: i.nombre, gramos_semana: i.gramos });
  }
  return tandas.filter((t) => t.items.length);
}

// Guía sin IA, por si el modelo falla o no está configurado
export function batchBasico(dia: number, tandas: BatchCooking["tandas"]): BatchCooking {
  const pasos: string[] = [];
  const horno = tandas.find((t) => t.tecnica === "Horno");
  const hervido = tandas.find((t) => t.tecnica === "Hervido");
  const plancha = tandas.find((t) => t.tecnica === "Plancha o sartén");
  if (horno) pasos.push(`Prendé el horno a 200 °C y poné a asar: ${horno.items.map((i) => i.nombre.toLowerCase()).join(", ")} (35-45 min).`);
  if (hervido) pasos.push(`Mientras tanto herví en ollas separadas: ${hervido.items.map((i) => i.nombre.toLowerCase()).join(", ")}.`);
  if (plancha) pasos.push(`Al final cociná a la plancha o sartén: ${plancha.items.map((i) => i.nombre.toLowerCase()).join(", ")}, en tandas, sin amontonar.`);
  pasos.push("Dejá enfriar todo destapado 20 minutos antes de guardar.");
  return {
    dia_semana: dia,
    tiempo_min: 60 + tandas.length * 20,
    tandas,
    pasos,
    conservacion: [
      "En heladera, en recipientes cerrados, dura 3 a 4 días.",
      "Lo que vayas a comer después del cuarto día va al freezer en porciones."
    ]
  };
}

// ── 9. Menú de un día para las pantallas ────────────────────────

export interface RecomendacionDia {
  tipo: TipoDia;
  comidas: ComidaDelPlan[];
  avisos: string[];
  notas: string | null;
}
