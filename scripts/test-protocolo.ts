// Tests del protocolo: validación de ítems, textos de "cuándo" y el
// control que descarta suplementos que no están en el texto del entrenador.
import {
  apareceEnTexto,
  apareceTodo,
  esComida,
  filtrarInventados,
  momentosPorHora,
  sanearFases,
  sanearItem,
  textoCuando,
  textoCuandoAplica,
  textoDiasFase
} from "../src/lib/protocolo";
import { aGramos, asignarMomentos } from "../src/lib/meal-plan";
import { anclarPorBloque, completarDescanso } from "../src/lib/ai-protocolo";
import type { ItemEntrada } from "../src/lib/protocolo";
import type { Momento } from "../src/lib/types";

let fallos = 0;
function check(nombre: string, cond: boolean, detalle?: unknown) {
  if (cond) console.log(`  OK  ${nombre}`);
  else {
    fallos++;
    console.log(`  FAIL ${nombre}`, detalle ?? "");
  }
}
function lanza(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

// 1. sanearItem
const s = sanearItem({ titulo: "  Creatina   5 g ", ancla: "inventada" as never, dias: [9, 3, 3, 1], offset_min: 999, aplica: "x" as never });
check("recorta espacios del título", s.titulo === "Creatina 5 g");
check("ancla desconocida → en el día", s.ancla === "en_el_dia");
check("días válidos, sin repetir y ordenados", s.dias.join() === "1,3", s.dias);
check("desfase acotado a ±240", s.offset_min === 240);
check("aplica inválido → todos", s.aplica === "todos");
check("segmento vacío → Hábitos", s.segmento === "Hábitos");
check("sin días → todos los días", sanearItem({ titulo: "x", dias: [] }).dias.length === 7);
check("sin título, error", lanza(() => sanearItem({ titulo: "  " })));
check("hora fija sin hora, error", lanza(() => sanearItem({ titulo: "Café", ancla: "hora_fija" })));
check("hora fija normalizada", sanearItem({ titulo: "Café", ancla: "hora_fija", hora: "9:00" }).hora === "09:00");
check("la hora se ignora si no es hora fija", sanearItem({ titulo: "x", ancla: "con_cena", hora: "20:00" }).hora === null);
check("lo atado al entreno queda solo en días de entreno", sanearItem({ titulo: "Pre-entreno", ancla: "antes_entreno", aplica: "todos" }).aplica === "entreno");
check("semana hasta menor que desde se corrige", sanearItem({ titulo: "x", semana_desde: 3, semana_hasta: 1 }).semana_hasta === 3);

// 2. Textos
check("cuándo con desfase", textoCuando({ ancla: "despues_entreno", offset_min: 15, hora: null }) === "Después de entrenar · +15 min");
check("cuándo a hora fija", textoCuando({ ancla: "hora_fija", offset_min: 0, hora: "09:00:00" }) === "A las 9:00 am");
check("aplica: todos los días", textoCuandoAplica({ dias: [1, 2, 3, 4, 5, 6, 7], aplica: "todos", semana_desde: null, semana_hasta: null }) === "Todos los días");
check("aplica: días y semanas", textoCuandoAplica({ dias: [4, 2], aplica: "todos", semana_desde: 1, semana_hasta: 2 }) === "Mar, Jue · semanas 1-2");
check("aplica: desde una semana", textoCuandoAplica({ dias: [1, 2, 3, 4, 5, 6, 7], aplica: "entreno", semana_desde: 5, semana_hasta: null }) === "Días de entreno · desde la semana 5");
check("aplica: desde una fase", textoCuandoAplica({ dias: [], aplica: "todos", semana_desde: null, semana_hasta: null, fase_desde: 2, fase_hasta: null }) === "Desde la fase 2");
check("aplica: solo una fase", textoCuandoAplica({ dias: [], aplica: "todos", semana_desde: null, semana_hasta: null, fase_desde: null, fase_hasta: 1 }) === "Solo fase 1");

// 3. Lo que la IA inventa se descarta
const texto = `5:30 AM Preparación: 1 vaso de agua con limón, 1 cápsula de multivitamínico, 5 g de creatina.
6:00 AM Entrenamiento: 1 scoop de aminoácidos esenciales (Amino Million).
7:30 PM Cierre: 150 g de pollo y 1 dosis de magnesio (citrato o glicinato).`;
check("aparece: creatina", apareceEnTexto("Creatina monohidratada 5 g", texto));
check("aparece con acentos distintos", apareceEnTexto("Multivitaminico", texto) && apareceEnTexto("Aminoácidos esenciales", texto));
check("no aparece: omega 3", !apareceEnTexto("Omega 3", texto));
check("no aparece: vitamina D (multivitamínico no cuenta)", !apareceEnTexto("Vitamina D", texto));
check("solo palabras genéricas: se da por buena", apareceEnTexto("1 cápsula", texto));
const { validos, descartados } = filtrarInventados(
  [
    { segmento: "Suplementos", titulo: "Creatina 5 g" },
    { segmento: "Suplementos", titulo: "Magnesio" },
    { segmento: "Suplementos", titulo: "Colágeno hidrolizado" },
    { segmento: "Hábitos", titulo: "Dormir 8 horas" }
  ],
  texto
);
check("descarta el suplemento inventado", descartados.join() === "Colágeno hidrolizado", descartados);
check("conserva los del texto y los que no son suplementos", validos.map((v) => v.titulo).join("|") === "Creatina 5 g|Magnesio|Dormir 8 horas");

// 4. Comidas del texto → momento por hora (no por lo que diga la IA)
const vshape = momentosPorHora([
  { etiqueta: "Comida 3", hora: "19:30" },
  { etiqueta: "Comida 1", hora: "12:00" },
  { etiqueta: "Comida 2", hora: "16:00" }
]);
check("12:00 almuerzo, 16:00 merienda, 19:30 cena", vshape.map((c) => `${c.etiqueta}=${c.momento}`).join() === "Comida 1=almuerzo,Comida 2=merienda,Comida 3=cena", vshape);
const cinco = momentosPorHora(["07:00", "10:00", "13:30", "17:00", "20:30"].map((hora, i) => ({ etiqueta: `C${i + 1}`, hora })));
check("cinco comidas, cinco momentos distintos", new Set(cinco.map((c) => c.momento)).size === 5 && cinco[0].momento === "desayuno" && cinco[4].momento === "cena", cinco);

// Plan con pre y post-entreno y horarios distintos por tipo de día
const fmt = (xs: { etiqueta: string; momento: string }[]) => xs.map((c) => `${c.etiqueta}=${c.momento}`).join();
const entrenoMx = asignarMomentos([
  { momento: null, etiqueta: "Pre-Entrenamiento (Energía Rápida)", hora: "04:30" },
  { momento: null, etiqueta: "Post-Entrenamiento Inmediato", hora: "06:30" },
  { momento: null, etiqueta: "Almuerzo / Desayuno Sólido", hora: "09:30" },
  { momento: null, etiqueta: "Comida", hora: "14:00" },
  { momento: null, etiqueta: "Colación de la Tarde", hora: "16:30" },
  { momento: null, etiqueta: "Cena (Carga Nocturna)", hora: "18:00" }
]);
check("día de entreno: seis comidas, seis momentos",
  fmt(entrenoMx) === "Pre-Entrenamiento (Energía Rápida)=pre_entreno,Post-Entrenamiento Inmediato=post_entreno,Almuerzo / Desayuno Sólido=desayuno,Comida=almuerzo,Colación de la Tarde=merienda,Cena (Carga Nocturna)=cena",
  fmt(entrenoMx));
const descansoMx = asignarMomentos([
  { momento: "desayuno" as Momento | null, etiqueta: "Desayuno Sólido y Probiótico", hora: "08:30" },
  { momento: "snack" as Momento | null, etiqueta: "Colación Matutina (Batido Limpio)", hora: "11:30" },
  { momento: null, etiqueta: "Comida", hora: "14:30" },
  { momento: null, etiqueta: "Colación de la Tarde", hora: "16:45" },
  { momento: null, etiqueta: "Cena Ligera", hora: "18:00" }
]);
check("día de descanso: dos colaciones distintas",
  descansoMx.map((c) => c.momento).join() === "desayuno,snack,almuerzo,merienda,cena", fmt(descansoMx));
const sinHoras = asignarMomentos([{ momento: "cena" as Momento | null, etiqueta: "Cena" }, { momento: null, etiqueta: "Algo" }]);
check("sin horas se respeta lo que dijo la IA", sinHoras.map((c) => c.momento).join() === "cena,snack");
check("pre-entreno por la hora no, por el nombre sí",
  asignarMomentos([{ momento: null, etiqueta: "Comida 1", hora: "07:00" }])[0].momento === "desayuno");

// Fases
const f = sanearFases([
  { nombre: "Fase 3", desde_dia: 15, nota: "rendimiento" },
  { nombre: "Fase 1", desde_dia: 1, nota: "" },
  { nombre: "", desde_dia: 8 },
  { nombre: "repetida", desde_dia: 8 },
  { nombre: "mala", desde_dia: -3 }
]);
check("fases ordenadas, sin repetidas ni inválidas", f.map((x) => `${x.nombre}@${x.desde_dia}`).join() === "Fase 1@1,Fase 2@8,Fase 3@15", f);
check("la primera fase siempre empieza el día 1", sanearFases([{ nombre: "A", desde_dia: 3 }, { nombre: "B", desde_dia: 10 }])[0].desde_dia === 1);
check("texto de los días de cada fase", textoDiasFase(f, 0) === "Días 1-7" && textoDiasFase(f, 2) === "Desde el día 15");
check("sanearItem: fase 1 = desde el principio", sanearItem({ titulo: "Omega", fase_desde: 1 }).fase_desde === null && sanearItem({ titulo: "DIM", fase_desde: 3 }).fase_desde === 3);

// Cantidades del texto → gramos (fijos, no los que estime la IA)
check("piezas con peso típico", aGramos("Galleta de arroz", 2, "pieza", 20, "").gramos === 18 && aGramos("Huevo entero", 3, "pieza", 150, "").gramos === 150);
check("galletas de quinoa también pesan 9 g", aGramos("Galletas de quinoa", 2, "pieza", 0, "").gramos === 18);
check("cucharada = 15 g", aGramos("Vinagre de manzana", 1, "cucharada", 15, "").gramos === 15);
check("'1 cucharadita (5 ml)' leído como 5 cucharaditas = 5 g", aGramos("Aceite de oliva", 5, "cucharadita", 5, "").gramos === 5);
check("cantidad libre fija", aGramos("Pepino", null, "libre", 30, "").gramos === 50 && aGramos("Ensalada verde", null, "libre", 80, "").gramos === 100);
check("sin unidad (menú de la IA): los gramos directos", aGramos("Arroz", undefined, undefined, 120, "").gramos === 120);

// Bloques del texto: suplementos que la IA dejó "en el día" o solo en entreno
const textoBloques = [
  "DÍAS DE ENTRENAMIENTO",
  "6:30 AM – Post-Entrenamiento",
  "• Creatina: 5 g",
  "2:00 PM – Comida",
  "• Omega 3: 2 g",
  "DÍAS DE DESCANSO",
  "8:30 AM – Desayuno",
  "• Huevos",
  "11:30 AM – Colación Matutina",
  "• Creatina: 5 g",
  "6:00 PM – Cena"
].join("\n");
const base = (p: Partial<ItemEntrada>): ItemEntrada => ({ ...sanearItem({ titulo: "x", ...p }), ...p }) as ItemEntrada;
const anclados = anclarPorBloque([base({ segmento: "Suplementos", titulo: "Omega 3", ancla: "en_el_dia" })], textoBloques, [{ momento: "almuerzo", hora: "14:00" }]);
check("'en el día' dentro del bloque de la comida → con la comida", anclados[0].ancla === "con_almuerzo", anclados[0].ancla);
// La primera mención está en la explicación de fases (sin hora): cuenta la del bloque
const conFases = ["Fase 1 (Días 1 al 7): solo toma el Multivitamínico y el Omega-3.", textoBloques].join("\n");
const ancladoFases = anclarPorBloque([base({ segmento: "Suplementos", titulo: "Omega-3", ancla: "en_el_dia" })], conFases, [{ momento: "almuerzo", hora: "14:00" }]);
check("mención en las fases no gana al bloque de la comida", ancladoFases[0].ancla === "con_almuerzo", ancladoFases[0].ancla);
const completos = completarDescanso([base({ segmento: "Suplementos", titulo: "Creatina", ancla: "con_post_entreno", aplica: "entreno" })], textoBloques);
check("creatina también en descanso, con la colación", completos.length === 2 && completos[1].aplica === "descanso" && completos[1].ancla === "con_snack", completos.map((c) => `${c.ancla}/${c.aplica}`));

// "Por qué" solo con palabras del texto
const plan = "Fase 1: Arranca solo con las Enzimas digestivas. Esto asienta y repara tu salud intestinal. Creatina: 5 g (Mantenimiento diario de la saturación).";
check("por qué copiado del texto pasa", apareceTodo("Esto asienta y repara tu salud intestinal", plan) && apareceTodo("Mantenimiento diario de la saturación", plan));
check("por qué redactado por la IA no pasa", !apareceTodo("Mejora la energía y vasodilatación pre-entreno", plan) && !apareceTodo("Facilita la digestión", plan));

// 5. Lo que tiene calorías va al menú
check("whey y proteína son comida", esComida("Proteína whey (post-entreno)") && esComida("2 scoops de Whey Isolate"));
check("creatina, magnesio y café no", !esComida("Creatina 5 g") && !esComida("Magnesio") && !esComida("Café negro"));
check("creatina en el batido sigue siendo suplemento", !esComida("Creatina (en el batido post-entreno)"));

console.log(fallos ? `\n${fallos} TEST(S) FALLARON` : "\nTODOS LOS TESTS PASAN");
if (fallos) process.exit(1);
