// Tests del protocolo: validación de ítems, textos de "cuándo" y el
// control que descarta suplementos que no están en el texto del entrenador.
import {
  apareceEnTexto,
  esComida,
  filtrarInventados,
  momentosPorHora,
  sanearItem,
  textoCuando,
  textoCuandoAplica
} from "../src/lib/protocolo";

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
check("aplica: desde una semana", textoCuandoAplica({ dias: [1, 2, 3, 4, 5, 6, 7], aplica: "entreno", semana_desde: 5, semana_hasta: null }) === "días de entreno · desde la semana 5");

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

// 5. Lo que tiene calorías va al menú
check("whey y proteína son comida", esComida("Proteína whey (post-entreno)") && esComida("2 scoops de Whey Isolate"));
check("creatina, magnesio y café no", !esComida("Creatina 5 g") && !esComida("Magnesio") && !esComida("Café negro"));

console.log(fallos ? `\n${fallos} TEST(S) FALLARON` : "\nTODOS LOS TESTS PASAN");
if (fallos) process.exit(1);
