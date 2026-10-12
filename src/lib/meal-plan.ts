// Recomendación de comidas: todo lo determinista y sin base de datos.
// Sanea lo que devuelve la IA, cuadra el menú con la referencia diaria y
// deriva la lista de compras, los avisos de preparación y las tandas de
// batch cooking. Resolver ingredientes y escribir en la base vive en
// meal-plan-db.ts.

import { ETIQUETAS_TIPO_DIA, macrosDe, nombreMomento, sumarMacros, type Macros } from "./nutrition";
import type {
  BatchCooking,
  ComidaGenerada,
  CuestionarioNutricion,
  HorariosMenu,
  Ingredient,
  ItemComidaResuelto,
  MacrosBase,
  MealPlanItem,
  Momento,
  PlanComidasGenerado,
  TipoDia
} from "./types";

const MOMENTOS: Momento[] = ["desayuno", "almuerzo", "merienda", "cena", "snack", "pre_entreno", "post_entreno"];
export const TIPOS_DIA: TipoDia[] = ["entreno", "descanso"];
const MAX_INGREDIENTES = 8;

// "9:30" → "09:30"; cualquier otra cosa → null
export function horaValida(v: unknown): string | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(v ?? "").trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

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

// ── Cantidades del texto → gramos ───────────────────────────────

// La IA copia la cantidad como la escribe el entrenador ("2 piezas", "1
// cucharada"); los gramos los pone el código, siempre iguales.
const PESO_PIEZA: [RegExp, number][] = [
  [/\bclara/, 33],
  [/\bhuevo/, 50],
  [/\bgalleta.*(arroz|quinoa|quinua)|\brice cake/, 9],
  [/\bpl[aá]tano|\bbanana/, 100],
  [/\btortilla de harina/, 40],
  [/\btortilla/, 30],
  [/\bbolillo|\btelera/, 70],
  [/\bpan\b/, 30],
  [/\bmanzana/, 180],
  [/\bnaranja/, 150],
  [/\bpera\b/, 160],
  [/\bmandarina/, 90],
  [/\bkiwi/, 75],
  [/\bdurazno/, 150],
  [/\bdatil/, 8],
  [/\baguacate|\bpalta/, 140],
  [/\bpepino/, 200],
  [/\bzanahoria/, 60],
  [/\bjicama/, 300],
  [/\btomate|\bjitomate/, 120],
  [/\byogur/, 125]
];
const POR_UNIDAD: Record<string, number> = { scoop: 30, cucharada: 15, cucharadita: 5, taza: 240 };
const LIBRE_G = 50; // "cantidad libre": una porción chica para que cuente en el menú

export function aGramos(
  nombre: string,
  cantidadRaw: unknown,
  unidadRaw: unknown,
  gramosIA: unknown,
  nota: string
): { gramos: number; nota: string } {
  const cantidad = Number(cantidadRaw);
  const unidad = String(unidadRaw ?? "").toLowerCase();
  const respaldo = Number(gramosIA);
  const n = normalizarTexto(nombre);
  const conNota = (extra: string) => ({ nota: nota || extra });
  // Sin unidad (el menú que arma la IA): vienen gramos directos
  if (!unidad) return { gramos: respaldo, nota };
  if (unidad === "libre" || (cantidadRaw == null && unidad !== "g")) {
    // Fijo (la estimación de la IA cambia de una vez a otra)
    return { gramos: /\bensalada/.test(n) ? 2 * LIBRE_G : LIBRE_G, ...conNota("cantidad libre") };
  }
  if (!Number.isFinite(cantidad) || cantidad <= 0) return { gramos: respaldo, nota };
  if (unidad === "g" || unidad === "ml") return { gramos: cantidad, nota };
  if (unidad === "pieza") {
    const peso = PESO_PIEZA.find(([p]) => p.test(n))?.[1];
    const piezas = `${cantidad} ${cantidad === 1 ? "pieza" : "piezas"}`;
    if (peso) return { gramos: cantidad * peso, ...conNota(piezas) };
    return { gramos: respaldo > 0 ? respaldo : cantidad * 100, ...conNota(piezas) };
  }
  const porUnidad = POR_UNIDAD[unidad];
  // "1 cucharadita (5 ml)" a veces llega como 5 cucharaditas: si la cantidad
  // se parece más a los gramos que estimó la IA, son gramos
  if (porUnidad && unidad !== "taza") {
    const comoGramos = respaldo > 0 ? Math.abs(respaldo - cantidad) < Math.abs(respaldo - cantidad * porUnidad) : cantidad > 6;
    if (comoGramos) return { gramos: cantidad, nota };
  }
  if (porUnidad) {
    const texto = `${cantidad} ${unidad}${cantidad === 1 ? "" : "s"}`;
    return { gramos: cantidad * porUnidad, ...conNota(texto) };
  }
  return { gramos: respaldo > 0 ? respaldo : cantidad, nota };
}

// Comida tal como la devuelve la IA, antes de decidir su momento
interface ComidaCruda extends Omit<ComidaGenerada, "momento"> {
  momento: Momento | null;
  etiqueta: string;
}

function normalizarComidas(raw: unknown, permitidos?: Momento[]): ComidaCruda[] {
  const lista = Array.isArray(raw) ? raw : [];
  const out: ComidaCruda[] = [];
  for (const c of lista) {
    const cc = (c ?? {}) as Partial<ComidaGenerada> & { etiqueta?: unknown };
    const dicho = String(cc.momento ?? "").toLowerCase() as Momento;
    const momento = MOMENTOS.includes(dicho) ? dicho : null;
    if (permitidos && (!momento || !permitidos.includes(momento))) continue;
    const ingredientes = (Array.isArray(cc.ingredientes) ? cc.ingredientes : [])
      .map((i) => {
        const ii = (i ?? {}) as { nombre?: unknown; gramos?: unknown; nota?: unknown; cantidad?: unknown; unidad?: unknown };
        const nombre = String(ii.nombre ?? "").trim().slice(0, 80);
        const { gramos, nota } = aGramos(nombre, ii.cantidad, ii.unidad, ii.gramos, ii.nota ? String(ii.nota).trim() : "");
        return {
          nombre,
          gramos: Number.isFinite(gramos) ? Math.min(2000, Math.max(1, Math.round(gramos))) : 0,
          nota: nota ? nota.slice(0, 80) : undefined
        };
      })
      .filter((i) => i.nombre && i.gramos > 0)
      .slice(0, MAX_INGREDIENTES);
    if (!ingredientes.length) continue;
    // "Desayuno" como nombre de plato no aporta nada
    let plato = String(cc.plato ?? "").trim().slice(0, 80);
    if (momento && normalizarTexto(plato) === momento) plato = "";
    out.push({
      momento,
      etiqueta: String(cc.etiqueta ?? "").trim().slice(0, 80),
      plato,
      hora: horaValida(cc.hora) ?? undefined,
      ingredientes
    });
  }
  return out;
}

// ── Momento de cada comida del texto ────────────────────────────

// Hora típica de cada comida en México (minutos). Pre y post-entreno no
// están: se reconocen por su nombre, no por la hora.
const TIPICA: [Momento, number][] = [
  ["desayuno", 8 * 60],
  ["snack", 11 * 60],
  ["almuerzo", 13 * 60 + 30],
  ["merienda", 17 * 60],
  ["cena", 20 * 60 + 30]
];

const PRE = /\bpre\b|pre ?entreno|pre ?entrenamiento|antes de entrenar/;
const POST = /\bpost\b|post ?entreno|post ?entrenamiento|despues de entrenar|al terminar de entrenar/;

// Cuánto "cuesta" poner una comida en un momento: distancia a su hora
// típica (en horas), las colaciones solo si el nombre lo dice o no queda
// otra, y el nombre que le dio el entrenador manda ("Cena", "Colación").
function costo(c: { etiqueta: string; min: number }, m: Momento, tipica: number): number {
  const n = normalizarTexto(c.etiqueta);
  let x = Math.abs(c.min - tipica) / 60;
  const colacion = /colacion|snack|merienda|refrigerio|tentempie/.test(n);
  if (m === "snack" || m === "merienda") x += colacion ? -1.5 : 1.25;
  else if (colacion) x += 1.5;
  if (m === "desayuno" && /desayuno/.test(n)) x -= 1.5;
  if (m === "cena" && /\bcena\b/.test(n)) x -= 1.5;
  // "Comida" en México es la del mediodía ("Comida 1, 2, 3" es solo un número)
  if (m === "almuerzo" && /\bcomida\b(?! ?\d)/.test(n)) x -= 1.5;
  return x;
}

// Decide el momento de cada comida de un día. Con horas en el texto se
// decide acá (la IA suele confundir "Comida 2" con la cena): pre y
// post-entreno por su nombre, y el resto en orden del día, cada una en el
// momento libre que mejor le queda. Sin horas, se respeta lo que dijo la IA.
export function asignarMomentos<T extends { momento: Momento | null; etiqueta: string; plato?: string; hora?: string }>(
  comidas: T[]
): (Omit<T, "momento"> & { momento: Momento })[] {
  const conHora = comidas.every((c) => aMin(c.hora) != null);
  if (!conHora) {
    return comidas.map((c) => ({ ...c, momento: c.momento ?? "snack" }));
  }
  const ordenadas = [...comidas].sort((a, b) => aMin(a.hora)! - aMin(b.hora)!);
  const salida = new Map<T, Momento>();
  const texto = (c: T) => normalizarTexto(`${c.etiqueta} ${c.plato ?? ""}`);
  const pre = ordenadas.find((c) => c.momento === "pre_entreno" || PRE.test(texto(c)));
  if (pre) salida.set(pre, "pre_entreno");
  const post = ordenadas.find((c) => c !== pre && (c.momento === "post_entreno" || POST.test(texto(c))));
  if (post) salida.set(post, "post_entreno");

  const resto = ordenadas.filter((c) => !salida.has(c)).map((c) => ({ c, etiqueta: texto(c), min: aMin(c.hora)! }));
  // Mejor asignación en orden (programación dinámica: comida i → momento j)
  const n = resto.length;
  const k = TIPICA.length;
  if (n <= k) {
    const mejor: number[][] = Array.from({ length: n + 1 }, () => Array(k + 1).fill(Infinity));
    const desde: number[][] = Array.from({ length: n + 1 }, () => Array(k + 1).fill(-1));
    for (let j = 0; j <= k; j++) mejor[0][j] = 0;
    for (let i = 1; i <= n; i++) {
      for (let j = i; j <= k; j++) {
        // comida i-1 en el momento j-1, o el momento j-1 queda libre
        const usar = mejor[i - 1][j - 1] + costo(resto[i - 1], TIPICA[j - 1][0], TIPICA[j - 1][1]);
        const saltar = mejor[i][j - 1];
        if (usar <= saltar) {
          mejor[i][j] = usar;
          desde[i][j] = 1;
        } else {
          mejor[i][j] = saltar;
          desde[i][j] = 0;
        }
      }
    }
    for (let i = n, j = k; i > 0; j--) {
      if (desde[i][j] === 1) {
        salida.set(resto[i - 1].c, TIPICA[j - 1][0]);
        i--;
      }
    }
  } else {
    // Más comidas que momentos: cada una al más cercano (se juntan)
    for (const r of resto) {
      let m = TIPICA[0];
      for (const t of TIPICA) if (costo(r, t[0], t[1]) < costo(r, m[0], m[1])) m = t;
      salida.set(r.c, m[0]);
    }
  }
  return ordenadas.map((c) => ({ ...c, momento: salida.get(c)! }));
}

function aMin(hora: string | undefined | null): number | null {
  const h = horaValida(hora);
  return h ? Number(h.slice(0, 2)) * 60 + Number(h.slice(3)) : null;
}

function sanearMacros(v: unknown): MacrosBase | null {
  const m = (v ?? {}) as Record<string, unknown>;
  const n = (k: string) => Math.round(Number(m[k]));
  const out = { kcal: n("kcal"), prot_g: n("prot_g"), carb_g: n("carb_g"), grasa_g: n("grasa_g") };
  if (!(out.kcal >= 1000 && out.kcal <= 6000)) return null;
  if (![out.prot_g, out.carb_g, out.grasa_g].every((x) => Number.isFinite(x) && x >= 0 && x <= 700)) return null;
  return out;
}

// Carnes y pescados que no dicen si se pesan crudos o cocidos siguen el
// criterio del resto del plan ("todos los pesos en crudo…")
const PROTEINA = /\bpollo|\bpechuga|\bpescado|\bsalmon|\batun|\btilapia|\bmerluza|\bres\b|\bcarne|\bbistec|\bcerdo|\blomo|\bpavo|\bcamaron|\bmuslo/;
const ESTADO = /crud|cocid|hervid|asad|horno|plancha|lata|escurrid/;

function unificarEstado(dias: ComidaGenerada[][]): void {
  const ings = dias.flat().flatMap((c) => c.ingredientes);
  const proteinas = ings.filter((i) => PROTEINA.test(normalizarTexto(i.nombre)));
  const conEstado = proteinas.map((i) => normalizarTexto(`${i.nombre} ${i.nota ?? ""}`)).filter((t) => ESTADO.test(t));
  const crudas = conEstado.filter((t) => /crud/.test(t)).length;
  const criterio = crudas * 2 > conEstado.length ? "crudo" : crudas === 0 && conEstado.length ? "cocido" : null;
  if (!criterio) return;
  for (const i of proteinas) {
    if (!ESTADO.test(normalizarTexto(`${i.nombre} ${i.nota ?? ""}`))) i.nota = i.nota ? `${criterio}; ${i.nota}`.slice(0, 80) : criterio;
  }
}

export function normalizarPlanComidas(raw: unknown, permitidos?: Momento[]): PlanComidasGenerado {
  const r = (raw ?? {}) as Partial<PlanComidasGenerado> & { objetivos?: Record<string, unknown> };
  const dia = (x: unknown): ComidaGenerada[] =>
    asignarMomentos(normalizarComidas(x, permitidos)).map(({ momento, plato, hora, ingredientes }) => ({
      momento,
      plato,
      hora,
      ingredientes
    }));
  let entreno = dia(r.entreno);
  let descanso = dia(r.descanso);
  unificarEstado([entreno, descanso]);
  // Un solo menú (el .txt suele traerlo así): vale para los dos días
  if (!entreno.length && descanso.length) entreno = descanso;
  if (!descanso.length && entreno.length) descanso = entreno;
  // Orden natural del día: por hora si la hay; si no, como en MOMENTOS
  const orden = (lista: ComidaGenerada[]) => {
    const pos = (c: ComidaGenerada) => aMin(c.hora) ?? (permitidos ?? MOMENTOS).indexOf(c.momento);
    return [...lista].sort((a, b) => pos(a) - pos(b));
  };
  entreno = orden(entreno);
  descanso = orden(descanso);
  const horas = (lista: ComidaGenerada[]) => {
    const h: Partial<Record<Momento, string>> = {};
    for (const c of lista) if (c.hora && !h[c.momento]) h[c.momento] = c.hora;
    return h;
  };
  const horarios: HorariosMenu = { entreno: horas(entreno), descanso: horas(descanso) };
  const conHoras = Object.keys(horarios.entreno!).length || Object.keys(horarios.descanso!).length;
  const obj = r.objetivos ?? null;
  const objE = obj ? sanearMacros(obj.entreno) : null;
  const objD = obj ? sanearMacros(obj.descanso) : null;
  return {
    nombre: String(r.nombre ?? "").trim().slice(0, 80) || "Recomendación de comidas",
    notas: r.notas ? String(r.notas).trim().slice(0, 400) : undefined,
    entreno,
    descanso,
    horarios: conHoras ? horarios : null,
    // Un solo objetivo en el texto vale para los dos tipos de día
    objetivos: objE || objD ? { entreno: (objE ?? objD)!, descanso: (objD ?? objE)! } : null
  };
}

// ── 2. Elegir el alimento de la base ────────────────────────────

// Elige el ingrediente que mejor coincide con el nombre pedido (o con
// alguno de sus otros nombres: "camote" = "batata"): exacto > empieza
// igual > contiene > mismas palabras > misma primera palabra; a igualdad,
// USDA/manual antes que Open Food Facts, crudo o cocido según lo pedido, y
// el nombre más parecido en largo.
const STOP = new Set(["de", "del", "la", "el", "con", "a", "al", "en", "y"]);

// Singular y plural cuentan igual: "verdura mixta" = "verduras mixtas"
export function sinPlural(s: string): string {
  return s
    .split(" ")
    .map((w) => (w.length > 3 ? w.replace(/(es|s)$/, "") : w))
    .join(" ");
}

function palabras(s: string): string[] {
  return sinPlural(normalizarTexto(s)).split(" ").filter((p) => p && !STOP.has(p));
}

function parecido(n: string, pedido: string[], nombre: string): number {
  const c = sinPlural(normalizarTexto(nombre));
  const cp = palabras(nombre);
  let score = 0;
  if (c === n) score = 40;
  else if (c.startsWith(n) || n.startsWith(c)) score = 30;
  else if (c.includes(n) || n.includes(c)) score = 20;
  else if (pedido.length && cp.length && pedido.every((p) => cp.includes(p))) score = 18;
  else if (pedido[0] && cp[0] === pedido[0]) score = 10;
  return score ? score - Math.min(4, Math.abs(c.length - n.length) / 8) : 0;
}

export function elegir(nombre: string, candidatos: Ingredient[], nota = ""): Ingredient | null {
  const n = sinPlural(normalizarTexto(nombre));
  if (!n) return null;
  const pedido = palabras(nombre);
  const pide = normalizarTexto(`${nombre} ${nota}`);
  const pideCocido = /cocid|hervid|horno|plancha|asad/.test(pide);
  const pideCrudo = /crud/.test(pide);
  let mejor: { ing: Ingredient; score: number } | null = null;
  for (const ing of candidatos) {
    const nombres = [ing.nombre, ...(ing.alias ?? "").split(",").map((a) => a.trim()).filter(Boolean)];
    let score = Math.max(...nombres.map((x) => parecido(n, pedido, x)));
    if (score <= 0) continue;
    if (ing.fuente !== "off") score += 5;
    const c = normalizarTexto(ing.nombre);
    const esCocido = /cocid|hervid/.test(c);
    const esCrudo = /crud/.test(c);
    if (pideCocido && esCocido) score += 3;
    if (pideCrudo && esCrudo) score += 3;
    if (pideCocido && esCrudo) score -= 3;
    if (pideCrudo && esCocido) score -= 3;
    if (!pideCrudo && esCrudo) score -= 2;
    if (!mejor || score > mejor.score) mejor = { ing, score };
  }
  return mejor?.ing ?? null;
}

// Busca con el nombre completo y, si no aparece, con menos palabras
// ("camote hervido" → "camote"). `buscar` es la búsqueda en la base.
export async function elegirBuscando(
  nombre: string,
  nota: string,
  buscar: (texto: string) => Promise<Ingredient[]>
): Promise<Ingredient | null> {
  const intentos = [nombre];
  const ps = nombre
    .replace(/[()]/g, " ")
    .split(/\s+/)
    .filter((p) => p && !STOP.has(normalizarTexto(p)));
  if (ps.length > 2) intentos.push(ps.slice(0, 2).join(" "));
  if (ps.length > 1 && ps[0].length >= 4) intentos.push(ps[0]);
  for (const t of intentos) {
    const ing = elegir(nombre, await buscar(t), nota);
    if (ing) return ing;
  }
  return null;
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

// ── 3b. Cuadrar proteína, carbohidratos y grasa ─────────────────

type Grupo = "p" | "c" | "g";
const GRUPOS: Grupo[] = ["p", "c", "g"];

// A qué macro "pertenece" un alimento para escalarlo: si al menos 35 % de
// sus calorías son proteína (carnes, pescados aunque sean grasos como el
// salmón), a la proteína; si no, al macro que más calorías le da (las
// semillas son grasa). Lo de pocas calorías (verduras, fruta liviana,
// aderezos), lo que va por piezas (3 huevos, 2 galletas) y la proteína en
// polvo (va por scoop) no se toca. Lo que va por medidas de cocina (1
// cucharada, 1 plátano mediano) tampoco, para que la nota no contradiga
// los gramos, salvo `conMedidas` (ver ajusteDeCantidades).
type OpcionesCuadre = { conMedidas?: boolean };
const POR_PIEZA = /\b(pieza|rebanada|scoop)/;
const POR_MEDIDA = /\b(cucharad|cdita|cda\b|taza|median[oa]|grande)/;
export function grupoDe(i: Pick<ItemComidaResuelto, "ingredient" | "nota">, opciones: OpcionesCuadre = {}): Grupo | null {
  const ing = i.ingredient;
  const nota = normalizarTexto(i.nota ?? "");
  if (!ing || ing.kcal_100 < 60 || POR_PIEZA.test(nota) || (!opciones.conMedidas && POR_MEDIDA.test(nota))) return null;
  // El huevo va por piezas y la proteína en polvo por scoops aunque no lo diga la nota
  if (/^huevo|\bwhey\b|\bproteina (en polvo|aislada|de suero)/.test(normalizarTexto(ing.nombre))) return null;
  if (ing.prot_100 * 4 >= ing.kcal_100 * 0.35) return "p";
  const p = ing.prot_100 * 4;
  const c = ing.carb_100 * 4;
  const g = ing.grasa_100 * 9;
  return p >= c && p >= g ? "p" : c >= g ? "c" : "g";
}

// Gramos "de cocina": de 5 en 5 desde 20 g, de 1 en 1 abajo
export function redondearGramos(g: number): number {
  return g >= 20 ? Math.round(g / 5) * 5 : Math.max(1, Math.round(g));
}

// Sistema chico (hasta 3×3) por eliminación gaussiana
function resolverSistema(m: number[][], b: number[]): number[] | null {
  const n = b.length;
  const a = m.map((fila, i) => [...fila, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let f = c + 1; f < n; f++) if (Math.abs(a[f][c]) > Math.abs(a[piv][c])) piv = f;
    if (Math.abs(a[piv][c]) < 1e-12) return null;
    [a[c], a[piv]] = [a[piv], a[c]];
    for (let f = 0; f < n; f++) {
      if (f === c) continue;
      const k = a[f][c] / a[c][c];
      for (let j = c; j <= n; j++) a[f][j] -= k * a[c][j];
    }
  }
  return a.map((fila, i) => fila[n] / fila[i]);
}

// Al redondear a gramos de cocina las calorías quedan unas decenas
// lejos: se cierran moviendo de a un paso (5 g, o 1 g abajo de 20 g) el
// carbohidrato o la grasa que más acerque, hasta quedar a 0.5 % o sin
// mejora. La proteína no se mueve y valen los mismos topes del cuadre.
function cerrarKcal(del: ItemComidaResuelto[], antes: Map<ItemComidaResuelto, number>, meta: number, opciones: OpcionesCuadre) {
  for (let vuelta = 0; vuelta < 40; vuelta++) {
    const falta = meta - sumarMacros(del.map((i) => macrosDe(i.ingredient!, i.cantidad_g))).kcal;
    if (Math.abs(falta) <= meta * 0.005) return;
    let mejor: { i: ItemComidaResuelto; g: number; error: number } | null = null;
    for (const i of del) {
      const k = grupoDe(i, opciones);
      if (k !== "c" && k !== "g") continue;
      const paso = (i.cantidad_g >= 20 ? 5 : 1) * Math.sign(falta);
      const g = i.cantidad_g + paso;
      const base = antes.get(i) ?? i.cantidad_g;
      if (g < Math.max(1, base * 0.4) || g > base * 2.5) continue;
      const error = Math.abs(falta - (i.ingredient!.kcal_100 * paso) / 100);
      if (!mejor || error < mejor.error) mejor = { i, g, error };
    }
    if (!mejor || mejor.error >= Math.abs(falta)) return;
    mejor.i.cantidad_g = mejor.g;
  }
}

// Lleva cada tipo de día lo más cerca posible de su proteína,
// carbohidratos y grasa escalando en bloque los alimentos de cada macro
// (mínimos cuadrados sobre el error relativo, con un leve tirón hacia no
// cambiar) y después cierra las calorías. Ningún alimento baja de ×0.4 ni
// sube de ×2.5. Determinista: la IA propone qué comer; los números los
// cierra esto.
export function ajustarAMacros(
  items: ItemComidaResuelto[],
  objetivo: Record<TipoDia, Macros>,
  opciones: OpcionesCuadre = {}
): ItemComidaResuelto[] {
  const out = items.map((i) => ({ ...i }));
  for (const tipo of TIPOS_DIA) {
    const meta = objetivo[tipo];
    if (!meta?.kcal) continue;
    const del = out.filter((i) => i.tipo_dia === tipo && i.ingredient && i.cantidad_g > 0);
    const vacio = () => ({ p: 0, c: 0, g: 0 });
    const fijo = vacio();
    const suma: Record<Grupo, { p: number; c: number; g: number }> = { p: vacio(), c: vacio(), g: vacio() };
    for (const i of del) {
      const m = macrosDe(i.ingredient!, i.cantidad_g);
      const k = grupoDe(i, opciones);
      const destino = k ? suma[k] : fijo;
      destino.p += m.prot_g;
      destino.c += m.carb_g;
      destino.g += m.grasa_g;
    }
    const activos = GRUPOS.filter((k) => suma[k].p + suma[k].c + suma[k].g > 0);
    if (!activos.length) continue;
    const metas = { p: meta.prot_g, c: meta.carb_g, g: meta.grasa_g };
    const n = activos.length;
    const m = Array.from({ length: n }, () => Array(n).fill(0));
    const b = Array(n).fill(0);
    for (const macro of GRUPOS) {
      if (!(metas[macro] > 0)) continue;
      const w = 1 / metas[macro] ** 2;
      const resto = metas[macro] - fijo[macro];
      activos.forEach((ka, a) => {
        b[a] += w * suma[ka][macro] * resto;
        activos.forEach((kb, j) => (m[a][j] += w * suma[ka][macro] * suma[kb][macro]));
      });
    }
    const TIRON = 0.005;
    activos.forEach((_, a) => {
      m[a][a] += TIRON;
      b[a] += TIRON;
    });
    const f = resolverSistema(m, b);
    if (!f) continue;
    const antes = new Map(del.map((i) => [i, i.cantidad_g]));
    for (const i of del) {
      const k = grupoDe(i, opciones);
      if (!k) continue;
      const factor = Math.min(2.5, Math.max(0.4, f[activos.indexOf(k)]));
      i.cantidad_g = redondearGramos(i.cantidad_g * factor);
    }
    cerrarKcal(del, antes, meta.kcal, opciones);
  }
  return out;
}

// ── 3c. Ajustar a otras calorías ────────────────────────────────

// Metas para llevar un menú a otras calorías sin rehacerlo: la proteína
// queda como está y la diferencia la absorben carbohidratos y grasa en la
// proporción que ya tienen. Las calorías de la tabla no son justo 4/4/9
// (fibra, redondeos): se corrige con la razón del propio menú.
export function metasPorKcal(menu: Macros, kcal: number): Macros {
  const atwater = menu.prot_g * 4 + menu.carb_g * 4 + menu.grasa_g * 9;
  const resto = menu.carb_g * 4 + menu.grasa_g * 9;
  const s = atwater && resto && menu.kcal ? Math.max(0, (kcal * (atwater / menu.kcal) - menu.prot_g * 4) / resto) : 1;
  return {
    kcal: Math.round(kcal),
    prot_g: Math.round(menu.prot_g),
    carb_g: Math.round(menu.carb_g * s),
    grasa_g: Math.round(menu.grasa_g * s)
  };
}

// Las metas del ajuste: con las mismas calorías de la referencia, la
// referencia completa (con sus macros); con otras, el menú escalado.
export function metasDelAjuste(menu: Macros, referencia: Macros | null, kcal: number): Macros {
  return referencia?.kcal && Math.round(referencia.kcal) === Math.round(kcal) ? referencia : metasPorKcal(menu, kcal);
}

type ConGramos = Pick<ItemComidaResuelto, "tipo_dia" | "momento" | "cantidad_g"> & {
  ingredient: Ingredient | null;
  nota?: string | null;
};

export interface CambioGramos {
  tipo: TipoDia;
  momento: Momento;
  nombre: string;
  antes: number;
  despues: number;
  notaAntes?: string; // si la nota tenía una medida que ya no vale ("1 cucharada")
}

// Cada alimento por tipo de día, comida y vez que aparece
function porClave<T extends ConGramos>(items: T[]): Map<string, T> {
  const out = new Map<string, T>();
  const veces = new Map<string, number>();
  for (const i of items) {
    if (!i.ingredient) continue;
    const base = `${i.tipo_dia}|${i.momento}|${i.ingredient.id}`;
    const n = (veces.get(base) ?? 0) + 1;
    veces.set(base, n);
    out.set(`${base}|${n}`, i);
  }
  return out;
}

// Los mismos alimentos en las mismas comidas: solo cambiaron gramos
export function mismosAlimentos(a: ConGramos[], b: ConGramos[]): boolean {
  const ka = porClave(a);
  const kb = porClave(b);
  return ka.size === kb.size && [...ka.keys()].every((k) => kb.has(k));
}

export function cambiosDeGramos(antes: ConGramos[], despues: ConGramos[]): CambioGramos[] {
  const previos = porClave(antes);
  const out: CambioGramos[] = [];
  for (const [k, d] of porClave(despues)) {
    const a = previos.get(k);
    const ga = Math.round(Number(a?.cantidad_g));
    const gd = Math.round(Number(d.cantidad_g));
    if (a && ga !== gd) {
      out.push({
        tipo: d.tipo_dia,
        momento: d.momento,
        nombre: d.ingredient!.nombre,
        antes: ga,
        despues: gd,
        ...(a.nota && a.nota !== d.nota ? { notaAntes: a.nota } : {})
      });
    }
  }
  return out;
}

// Qué tan lejos queda un tipo de día de sus calorías (0.05 = 5 %)
function desvio(items: ItemComidaResuelto[], objetivos: Record<TipoDia, Macros>, t: TipoDia): number {
  const meta = objetivos[t].kcal;
  return meta > 0 && items.some((i) => i.tipo_dia === t) ? Math.abs(totalesDe(items, t).kcal - meta) / meta : 0;
}

// Si con los topes de gramos un tipo de día queda a más de 3 % de sus calorías
export function avisoSinLlegar(items: ItemComidaResuelto[], objetivos: Record<TipoDia, Macros>): string | undefined {
  const lejos = TIPOS_DIA.filter((t) => desvio(items, objetivos, t) > 0.03);
  if (!lejos.length) return undefined;
  const detalle = lejos
    .map((t) => `el ${ETIQUETAS_TIPO_DIA[t].toLowerCase()} queda en ${Math.round(totalesDe(items, t).kcal)} kcal (meta ${Math.round(objetivos[t].kcal)})`)
    .join(" y ");
  return `Solo con gramos no se llega: ${detalle}. Ningún alimento baja de 40 % ni sube de 2.5 veces su cantidad, y huevos, scoops, lo que va por piezas y las verduras quedan igual. Para llegar, quita o cambia algún alimento aquí abajo.`;
}

// La nota sin la medida de cocina, cuando los gramos ya no son esa medida:
// "crudo, 1 cucharada (15 ml)" → "crudo"; "mediano" → nada
export function sinMedida(nota: string | null): string | null {
  const todas = (nota ?? "").split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  const partes = todas.filter((p) => !POR_MEDIDA.test(normalizarTexto(p)));
  if (partes.length === todas.length) return nota;
  return partes.length ? partes.join(", ") : null;
}

const SIN_META: Macros = { kcal: 0, prot_g: 0, carb_g: 0, grasa_g: 0 };

// Ajuste solo de cantidades: los mismos alimentos con los gramos llevados
// a las metas, la lista de lo que cambió y un aviso si algún día no llega.
// Primero sin tocar las medidas de cocina; si un día no llega, ese día se
// rehace moviéndolas también, y su nota deja de decir la medida.
export function ajusteDeCantidades(
  items: ItemComidaResuelto[],
  objetivos: Record<TipoDia, Macros>
): { items: ItemComidaResuelto[]; cambios: string[]; aviso?: string } {
  let ajustados = ajustarAMacros(items, objetivos);
  const lejos = TIPOS_DIA.filter((t) => desvio(ajustados, objetivos, t) > 0.03);
  if (lejos.length) {
    const soloLejos = { entreno: lejos.includes("entreno") ? objetivos.entreno : SIN_META, descanso: lejos.includes("descanso") ? objetivos.descanso : SIN_META };
    const conMedidas = ajustarAMacros(items, soloLejos, { conMedidas: true }).map((c, k) =>
      c.cantidad_g !== items[k].cantidad_g && !grupoDe(items[k]) ? { ...c, nota: sinMedida(c.nota) } : c
    );
    const mejoran = lejos.filter((t) => desvio(conMedidas, objetivos, t) < desvio(ajustados, objetivos, t));
    ajustados = ajustados.map((a, k) => (mejoran.includes(a.tipo_dia) ? conMedidas[k] : a));
  }
  return {
    items: ajustados,
    cambios: cambiosDeGramos(items, ajustados).map(
      (c) =>
        `${ETIQUETAS_TIPO_DIA[c.tipo]} · ${nombreMomento(c.momento)}: ${c.nombre} ${c.antes} → ${c.despues} g` +
        (c.notaAntes ? ` (ya no «${c.notaAntes}»)` : "")
    ),
    aviso: avisoSinLlegar(ajustados, objetivos)
  };
}

// La guía de cocina menciona porciones ("tápers de 250g")
export const MENCIONA_GRAMOS = /\d\s?(g|gr|gramos)\b/i;

// Al poner al día los gramos de la guía solo pueden cambiar las cifras
const sinCifras = (s: string) => s.replace(/\d+(?:[.,]\d+)?/g, "#");
export function soloCambianCifras(antes: string[], despues: string[]): boolean {
  return antes.length === despues.length && antes.every((t, k) => sinCifras(t) === sinCifras(String(despues[k] ?? "")));
}

// Totales de un tipo de día (solo lo que tiene alimento)
export function totalesDe(items: Pick<ItemComidaResuelto, "tipo_dia" | "ingredient" | "cantidad_g">[], tipo: TipoDia): Macros {
  return sumarMacros(items.filter((i) => i.tipo_dia === tipo && i.ingredient).map((i) => macrosDe(i.ingredient!, i.cantidad_g)));
}

// ── 3d. Lo que el cliente no come ───────────────────────────────

// Palabras que no son alimentos en "no como trigo, arroz y maíz"
const NO_ALIMENTO = new Set([
  "como", "comer", "come", "nada", "gusta", "gustan", "evito", "evitar", "solo", "tengo", "alergia", "alergias",
  "alergico", "alergica", "intolerancia", "intolerante", "nunca", "mucho", "poco", "prefiero", "ninguna",
  "ninguno", "porque", "cosas", "comida", "comidas", "algo", "todo", "nada"
]);

// Alimentos que el cliente dijo que no come o le dan alergia (de su
// cuestionario de comidas y, por si lo escribió ahí, de sus preferencias)
export function palabrasAEvitar(...textos: (string | null | undefined)[]): string[] {
  const ws = sinPlural(normalizarTexto(textos.filter(Boolean).join(" ")))
    .split(" ")
    .filter((w) => w.length >= 4 && !NO_ALIMENTO.has(w));
  return [...new Set(ws)];
}

// ¿El alimento choca con algo de eso? Devuelve la palabra
export function chocaCon(nombre: string, evitar: string[]): string | null {
  if (!evitar.length) return null;
  const ws = sinPlural(normalizarTexto(nombre)).split(" ");
  return evitar.find((e) => ws.includes(e)) ?? null;
}

// ── 5. Agrupar por momento (para las pantallas) ─────────────────

export interface ComidaDelPlan {
  momento: Momento;
  plato: string;
  hora: string; // la que fija el menú ("" = la del cuestionario del cliente)
  items: MealPlanItem[];
  macros: Macros;
}

export function comidasPorMomento(
  items: MealPlanItem[],
  tipo: TipoDia,
  horarios?: HorariosMenu | null
): ComidaDelPlan[] {
  const del = items.filter((i) => i.tipo_dia === tipo).sort((a, b) => a.orden - b.orden);
  const mapa = new Map<Momento, MealPlanItem[]>();
  for (const i of del) (mapa.get(i.momento) ?? mapa.set(i.momento, []).get(i.momento)!).push(i);
  const comidas = MOMENTOS.filter((m) => mapa.has(m)).map((m) => {
    const lista = mapa.get(m)!;
    return {
      momento: m,
      plato: lista.find((i) => i.plato)?.plato ?? "",
      hora: horaValida(horarios?.[tipo]?.[m]) ?? "",
      items: lista,
      macros: sumarMacros(lista.map((i) => macrosDe(i.ingredient, i.cantidad_g)))
    };
  });
  // Con las horas del menú, en orden del día; si no, en el orden del plan
  if (comidas.every((c) => c.hora)) return comidas.sort((a, b) => a.hora.localeCompare(b.hora));
  return comidas.sort((a, b) => a.items[0].orden - b.items[0].orden);
}

// Orden del día: la hora del menú, si no la del cliente, si no la típica
export function ordenarPorHorario(comidas: ComidaDelPlan[], cn: CuestionarioNutricion | null): ComidaDelPlan[] {
  const tipica = new Map<Momento, number>(TIPICA);
  const minDe = (c: ComidaDelPlan) =>
    aMin(c.hora) ??
    aMin(cn?.comidas.find((x) => x.momento === c.momento)?.hora) ??
    tipica.get(c.momento) ??
    (c.momento === "pre_entreno" ? 17 * 60 : 19 * 60);
  return comidas
    .map((c, i) => ({ c, i }))
    .sort((a, b) => minDe(a.c) - minDe(b.c) || a.i - b.i)
    .map((x) => x.c);
}

// Hora de una comida para mostrar: la del menú o la del cliente
export function horaDe(momento: Momento, cn: CuestionarioNutricion | null, horaMenu?: string): string {
  return horaMenu || cn?.comidas.find((c) => c.momento === momento)?.hora || "";
}

// ── 6. Lista de compras ─────────────────────────────────────────

// Peso aproximado por unidad, para pasar gramos a "unidades" en la lista
const UNIDADES: { patron: RegExp; gramos: number; uno: string; varios: string }[] = [
  { patron: /\bclara/, gramos: 33, uno: "clara", varios: "claras" },
  { patron: /\bhuevo/, gramos: 55, uno: "huevo", varios: "huevos" },
  { patron: /\bbanana|\bpl[aá]tano/, gramos: 120, uno: "plátano", varios: "plátanos" },
  { patron: /\bmanzana/, gramos: 180, uno: "manzana", varios: "manzanas" },
  { patron: /\bnaranja/, gramos: 150, uno: "naranja", varios: "naranjas" },
  { patron: /\bpera\b/, gramos: 160, uno: "pera", varios: "peras" },
  { patron: /\bmandarina/, gramos: 90, uno: "mandarina", varios: "mandarinas" },
  { patron: /\bkiwi/, gramos: 75, uno: "kiwi", varios: "kiwis" },
  { patron: /\bpalta|\baguacate/, gramos: 140, uno: "aguacate", varios: "aguacates" },
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
  // Solo si el alimento ES eso: "Vinagre de manzana" no son manzanas ni
  // "Aceite de aguacate" aguacates
  const u = UNIDADES.find((x) => x.patron.exec(n)?.index === 0);
  if (u) {
    const cant = Math.ceil(gramos / u.gramos);
    return `${cant} ${cant === 1 ? u.uno : u.varios}`;
  }
  if (gramos >= 1000) return `${(Math.ceil(gramos / 50) * 50 / 1000).toLocaleString("es-MX", { maximumFractionDigits: 2 })} kg`;
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
  { patron: /\bpapa|\bbatata|\bboniato|\bcamote|\bcalabaza|\bzapallo|\bzanahoria/, factor: 1.15 }
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
        avisos.push(`Saca ${limpiarNombre(i.ingredient.nombre)} del congelador esta noche.`);
      }
      if (REMOJO.test(n) && !vistos.has("rem:" + n)) {
        vistos.add("rem:" + n);
        avisos.push(`Deja ${limpiarNombre(i.ingredient.nombre)} en remojo desde hoy.`);
      }
      if (/\bavena/.test(n) && c.momento === "desayuno" && !vistos.has("avena")) {
        vistos.add("avena");
        avisos.push("Puedes dejar la avena remojando en el refri y mañana está lista.");
      }
    }
  }
  if (cn?.cocina === "como_fuera" && comidas.some((c) => c.momento === "almuerzo")) {
    avisos.push("Si mañana comes fuera, deja listo el táper de la comida.");
  }
  return avisos.slice(0, 4);
}

// ── 8. Batch cooking ────────────────────────────────────────────

// Primero manda cómo dice el nombre que se cocina ("hervida", "al horno");
// si no lo dice, el tipo de alimento.
const TECNICAS: { tecnica: string; patron: RegExp }[] = [
  { tecnica: "Hervido", patron: /hervid|\barroz|\bquinoa|\bfideo|\bpasta|\blenteja|\bgarbanzo|\bporoto|\bfrijol/ },
  { tecnica: "Horno", patron: /horno|asad|\bbatata|\bboniato|\bcamote|\bpapa\b|\bpapas|\bcalabaza|\bzapallo|\bzanahoria|\bbr[oó]coli|\bcoliflor|\bberenjena|\bmorr[oó]n|\bcebolla/ },
  { tecnica: "Plancha o sartén", patron: CONGELADO }
];

export function calcularTandas(items: MealPlanItem[], diasEntreno: number): BatchCooking["tandas"] {
  const lista = listaCompras(items, diasEntreno);
  const tandas = TECNICAS.map((t) => ({ tecnica: t.tecnica, items: [] as { nombre: string; gramos_semana: number }[] }));
  for (const i of lista) {
    const n = normalizarTexto(i.nombre);
    // Lo que se come fresco o se hace en el momento no va al batch
    if (/\bpan\b|\byogur|\bleche|\bqueso|\blata|\benlatado|\bcopos|\bgalleta|\bavena|\bhuevo|\bclara|\bwhey|\bprote|\bsemilla/.test(n)) continue;
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
  if (horno) pasos.push(`Prende el horno a 200 °C y pon a asar: ${horno.items.map((i) => i.nombre.toLowerCase()).join(", ")} (35-45 min).`);
  if (hervido) pasos.push(`Mientras tanto hierve en ollas separadas: ${hervido.items.map((i) => i.nombre.toLowerCase()).join(", ")}.`);
  if (plancha) pasos.push(`Al final cocina a la plancha o en sartén: ${plancha.items.map((i) => i.nombre.toLowerCase()).join(", ")}, en tandas, sin amontonar.`);
  pasos.push("Deja enfriar todo destapado 20 minutos antes de guardar.");
  return {
    dia_semana: dia,
    tiempo_min: 60 + tandas.length * 20,
    tandas,
    pasos,
    conservacion: [
      "En el refri, en recipientes cerrados, dura 3 a 4 días.",
      "Lo que vayas a comer después del cuarto día va al congelador en porciones."
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
