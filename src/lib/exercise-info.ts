// Base de técnica para autogenerar descripción + tips cuando se agrega un
// ejercicio sin completar esos campos, y referencia para que la IA
// explique paso a paso sin inventar el equipo (ver ai-rutina.ts).
// Siempre editable después desde la sección Rutina.

interface InfoEjercicio {
  descripcion: string;
  tips: string[];
  // Verbo de la parte que vence al peso y de la que vuelve (guía de cadencia)
  fuerza?: string;
  regreso?: string;
}

// En orden: la primera clave que aparece en el nombre (sin acentos) gana,
// así que las variantes van antes que el ejercicio general.
const KB: { claves: string[]; info: InfoEjercicio }[] = [
  // ── Tríceps ──
  {
    claves: ["katana"],
    info: {
      fuerza: "Extiende",
      regreso: "Regresa",
      descripcion:
        "Con una mano y la polea a la altura de la cabeza o más alta: el codo apunta arriba, la mano empieza detrás de la cabeza y extiendes el codo hacia arriba y afuera, como si sacaras una espada.",
      tips: ["El codo se queda quieto; solo se mueve el antebrazo", "Torso firme, sin girar el cuerpo", "Extiende sin bloquear de golpe"]
    }
  },
  {
    claves: ["copa"],
    info: {
      fuerza: "Extiende",
      regreso: "Baja",
      descripcion:
        "Sentado o de pie, una mancuerna con las dos manos detrás de la cabeza: extiende los codos hacia el techo y baja la mancuerna detrás de la cabeza.",
      tips: ["Codos apuntando al frente, sin abrirse", "Abdomen firme para no arquear la espalda", "Baja lento hasta estirar el tríceps"]
    }
  },
  {
    claves: ["cuerda abierta", "triceps con cuerda", "triceps cuerda"],
    info: {
      fuerza: "Extiende",
      regreso: "Regresa",
      descripcion:
        "Polea alta con cuerda: codos pegados al torso, extiende hacia abajo y al final abre la cuerda hacia los lados.",
      tips: ["Codos fijos a los costados", "Abre las manos abajo para apretar más", "Regresa hasta que los antebrazos queden paralelos al piso"]
    }
  },
  {
    claves: ["polea recta", "barra recta", "triceps en polea", "extension de triceps", "extensiones de triceps", "extension triceps", "extensiones triceps"],
    info: {
      fuerza: "Extiende",
      regreso: "Regresa",
      descripcion: "Polea alta con barra: codos pegados al cuerpo, extiende los codos hacia abajo y regresa controlado.",
      tips: ["Codos fijos al costado del torso todo el tiempo", "Extiende completo sin despegar los codos", "Sin echar el cuerpo encima de la barra"]
    }
  },
  {
    claves: ["frances declinado"],
    info: {
      fuerza: "Extiende",
      regreso: "Flexiona",
      descripcion:
        "Acostado en banco declinado con barra Z o mancuernas. Posición inicial: codos flexionados apuntando al techo y la carga junto a la frente o detrás de ella. La fuerza es extender los codos hasta dejar los brazos verticales; el regreso, flexionarlos.",
      tips: ["Codos apuntando al techo, sin abrirse", "Baja lento: la fase excéntrica es la que más rinde", "Si molestan los codos, baja detrás de la cabeza"]
    }
  },
  {
    claves: ["frances", "rompecraneos"],
    info: {
      fuerza: "Extiende",
      regreso: "Flexiona",
      descripcion:
        "Acostado, con barra o mancuernas. Posición inicial: codos flexionados apuntando al techo y la carga junto a la frente. La fuerza es extender los codos hasta dejar los brazos verticales; el regreso, flexionarlos.",
      tips: ["Codos apuntando al techo, sin abrirse", "Baja lento: la fase excéntrica es la que más rinde", "Si molestan los codos, baja detrás de la cabeza"]
    }
  },
  // ── Hombro ──
  {
    claves: ["laterales polea", "lateral polea", "lateral en polea", "laterales en polea", "lateral con polea", "laterales con polea"],
    info: {
      fuerza: "Eleva",
      regreso: "Baja",
      descripcion:
        "Polea baja con manija, de lado a la máquina: toma la manija con la mano más lejana (el cable cruza por delante del cuerpo) y eleva el brazo hacia el costado hasta la altura del hombro.",
      tips: ["Hombro abajo: que no suba el trapecio", "Codo apenas flexionado y fijo", "Cuerpo quieto, sin impulso"]
    }
  },
  {
    claves: ["lateral inclinad", "laterales inclinad"],
    info: {
      fuerza: "Eleva",
      regreso: "Baja",
      descripcion:
        "Cuerpo inclinado unos 45° (apoyado de lado en un banco inclinado o sujeto de un poste): eleva el brazo hacia el costado hasta el ángulo máximo que controles.",
      tips: ["Hombro abajo, sin encoger el trapecio", "Codo apenas flexionado y fijo", "Sube con control, sin balanceo"]
    }
  },
  {
    claves: ["lateral en maquina", "laterales en maquina", "lateral maquina", "laterales maquina"],
    info: {
      fuerza: "Eleva",
      regreso: "Baja",
      descripcion:
        "Sentado en la máquina de elevaciones laterales, con los brazos contra los rodillos: eleva los brazos hacia los costados hasta la altura de los hombros.",
      tips: ["Espalda pegada al respaldo", "Que suban los codos, no las manos", "Hombros abajo todo el tiempo"]
    }
  },
  {
    claves: ["vuelos laterales", "elevaciones laterales", "elevacion lateral", "laterales"],
    info: {
      fuerza: "Eleva",
      regreso: "Baja",
      descripcion: "De pie con mancuernas a los costados, sube los brazos hasta la altura de los hombros y baja con control.",
      tips: ["Sube hasta la altura de los hombros, no más", "Que suban los codos, no las manos", "Sin balanceo: si te columpias, baja el peso"]
    }
  },
  {
    claves: ["face pull"],
    info: {
      fuerza: "Jala",
      regreso: "Regresa",
      descripcion:
        "Polea a la altura de la cara con cuerda: jala hacia tu cara con los codos altos, separa las manos al final y junta las escápulas.",
      tips: ["Codos a la altura de los hombros", "Separa las manos al final del recorrido", "Peso ligero y control: es un músculo chico"]
    }
  },
  {
    claves: ["posterior", "pajaros"],
    info: {
      fuerza: "Abre",
      regreso: "Regresa",
      descripcion:
        "Inclinado con el torso casi paralelo al piso, abre los brazos hacia los costados con los codos apenas flexionados.",
      tips: ["Peso ligero y técnica estricta: es un músculo chico", "Codos apenas flexionados y fijos", "Piensa en separar las manos, no en levantarlas"]
    }
  },
  {
    claves: ["press militar", "press de hombro"],
    info: {
      fuerza: "Empuja",
      regreso: "Baja",
      descripcion: "De pie o sentado, empuja la barra o las mancuernas desde los hombros hasta extender los brazos sobre la cabeza.",
      tips: ["Abdomen y glúteos firmes para no arquear la zona lumbar", "La carga sube en línea recta, cerca de la cara", "Extiende arriba sin encoger los hombros"]
    }
  },
  // ── Pecho ──
  {
    claves: ["aperturas polea baja", "aperturas en polea baja", "apertura polea baja", "apertura en polea baja"],
    info: {
      fuerza: "Lleva",
      regreso: "Regresa",
      descripcion:
        "Poleas bajas, una manija en cada mano y un paso adelante: con los codos semiflexionados y fijos, lleva las manos en arco hacia arriba y al frente hasta juntarlas a la altura del pecho.",
      tips: ["El ángulo del codo no cambia: no lo conviertas en press", "Pecho arriba y hombros atrás", "Aprieta el pecho cuando las manos se juntan"]
    }
  },
  {
    claves: ["cruces polea alta", "cruce polea alta", "cruces en polea alta", "cruce en polea", "cruces en polea"],
    info: {
      fuerza: "Lleva",
      regreso: "Regresa",
      descripcion:
        "Poleas altas, una manija en cada mano y un paso adelante: con los codos semiflexionados, lleva las manos en arco hacia abajo y al centro hasta cruzarlas frente a la cadera.",
      tips: ["Codos semiflexionados y fijos", "Torso un poco inclinado al frente y estable", "Aprieta el pecho al cruzar las manos"]
    }
  },
  {
    claves: ["cruce", "poleas", "aperturas"],
    info: {
      fuerza: "Junta",
      regreso: "Abre",
      descripcion: "Con poleas o mancuernas, junta las manos al frente del pecho en arco, con los codos un poco flexionados y fijos.",
      tips: ["Codos apenas flexionados y fijos: el movimiento sale del hombro", "Aprieta el pecho al juntar las manos", "Sin impulso del torso"]
    }
  },
  {
    claves: ["convergente"],
    info: {
      fuerza: "Empuja",
      regreso: "Regresa",
      descripcion:
        "Sentado en la máquina convergente, con el asiento ajustado para que las manijas queden a media altura del pecho y la espalda apoyada: empuja al frente y las manijas se juntan al centro.",
      tips: ["Espalda y cabeza apoyadas", "Sin bloquear los codos al frente", "Regresa lento hasta sentir el estiramiento del pecho"]
    }
  },
  {
    claves: ["press declinado", "plano maquina", "plano en maquina", "press en maquina"],
    info: {
      fuerza: "Empuja",
      regreso: "Regresa",
      descripcion: "En la máquina de press (plano o declinado), espalda apoyada y manijas a la altura del pecho: empuja al frente y regresa controlado.",
      tips: ["Espalda pegada al respaldo", "Sin bloquear los codos", "Regresa lento hasta el estiramiento"]
    }
  },
  {
    claves: ["press inclinado"],
    info: {
      fuerza: "Empuja",
      regreso: "Baja",
      descripcion: "En banco inclinado (30–45°), baja la barra o las mancuernas a la parte alta del pecho y empuja hacia arriba.",
      tips: ["Banco a 30–45°: no lo conviertas en un press de hombro", "Codos a unos 45° del torso, ni pegados ni en cruz", "Baja con control hasta sentir el estiramiento del pecho"]
    }
  },
  {
    claves: ["press plano", "press de banca", "banca"],
    info: {
      fuerza: "Empuja",
      regreso: "Baja",
      descripcion: "Acostado en banco plano, baja la barra al pecho con control y empuja hasta extender los brazos.",
      tips: ["Escápulas juntas y pecho arriba toda la serie", "La barra baja a la altura de la línea de los pezones", "Pies firmes en el piso; no rebotes la barra en el pecho"]
    }
  },
  {
    claves: ["fondos"],
    info: {
      fuerza: "Sube",
      regreso: "Baja",
      descripcion:
        "En paralelas con los brazos extendidos: baja doblando los codos, con el torso un poco inclinado al frente, hasta que los hombros queden a la altura de los codos, y sube.",
      tips: ["Hombros abajo, lejos de las orejas", "Baja controlado, sin rebotar abajo", "Con lastre, solo si dominas el recorrido completo"]
    }
  },
  {
    claves: ["flexiones", "lagartijas", "push up"],
    info: {
      fuerza: "Empuja",
      regreso: "Baja",
      descripcion: "Con las manos un poco más anchas que los hombros, baja el cuerpo en bloque hasta casi tocar el piso y empuja.",
      tips: ["Cuerpo en línea recta: aprieta abdomen y glúteos", "Baja hasta que el pecho casi toque el piso", "Si se hacen fáciles, eleva los pies o agrega peso"]
    }
  },
  // ── Espalda ──
  {
    claves: ["pullover", "pull over"],
    info: {
      fuerza: "Lleva",
      regreso: "Regresa",
      descripcion:
        "De pie frente a la polea alta con barra o cuerda, torso un poco inclinado y brazos semi-rectos: lleva la barra en arco hacia los muslos usando la espalda, sin doblar los codos.",
      tips: ["Los codos no cambian de ángulo", "Piensa en llevar la barra con los dorsales", "Regresa hasta sentir el estiramiento de la espalda"]
    }
  },
  {
    claves: ["agarre neutro", "agarre v", "agarre en v"],
    info: {
      fuerza: "Jala",
      regreso: "Regresa",
      descripcion:
        "Sentado frente a la polea alta, muslos fijos y manija de agarre neutro (palmas enfrentadas): lleva los codos hacia abajo hasta que la manija llegue a la altura de las clavículas.",
      tips: ["Codos hacia los bolsillos, no manos al pecho", "Pecho un poco elevado", "Regresa lento hasta estirar los brazos"]
    }
  },
  {
    claves: ["dominadas"],
    info: {
      fuerza: "Sube",
      regreso: "Baja",
      descripcion: "Colgado de la barra, sube hasta pasar la barbilla y baja con control hasta estirar los brazos.",
      tips: ["Empieza bajando los hombros, no con impulso", "Baja completo: media dominada es media espalda", "Si no salen, usa banda o máquina asistida"]
    }
  },
  {
    claves: ["jalon", "polea al pecho"],
    info: {
      fuerza: "Jala",
      regreso: "Regresa",
      descripcion: "Sentado frente a la polea alta, lleva la barra a la parte alta del pecho y regresa controlando.",
      tips: ["Barra a la parte alta del pecho, nunca detrás de la nuca", "Empieza bajando los hombros y juntando las escápulas", "Torso apenas inclinado atrás y estable"]
    }
  },
  {
    claves: ["remo mancuerna", "remo con mancuerna", "remo unilateral", "remo apoyado"],
    info: {
      fuerza: "Jala",
      regreso: "Baja",
      descripcion:
        "Una mano y una rodilla apoyadas en el banco, espalda neutra y la mancuerna colgando: lleva el codo hacia atrás, pegado al cuerpo, y aprieta la espalda.",
      tips: ["Espalda plana, sin girar el torso", "Codo hacia la cadera, no hacia afuera", "Baja hasta estirar el brazo"]
    }
  },
  {
    claves: ["remo con barra"],
    info: {
      fuerza: "Jala",
      regreso: "Baja",
      descripcion: "Inclinado con la espalda recta, lleva la barra hacia el abdomen y baja con control.",
      tips: ["Torso a 30–45° y espalda neutra fija", "La barra viaja hacia el ombligo, codos cerca del cuerpo", "Si te columpias para subirla, baja el peso"]
    }
  },
  {
    claves: ["remo polea baja", "remo en polea baja", "remo con polea", "remo sentado", "remo bajo", "remo"],
    info: {
      fuerza: "Jala",
      regreso: "Regresa",
      descripcion: "Sentado frente a la polea baja, lleva el agarre al abdomen con el torso firme y regresa estirando los brazos.",
      tips: ["Espalda neutra: pecho afuera todo el recorrido", "Lleva los codos atrás y aprieta las escápulas", "Sin echar el torso atrás para mover más peso"]
    }
  },
  {
    claves: ["encogimientos", "trapecio"],
    info: {
      fuerza: "Sube",
      regreso: "Baja",
      descripcion: "De pie con mancuernas o barra, sube los hombros hacia las orejas, haz una pausa arriba y baja lento.",
      tips: ["Brazos relajados: no dobles los codos", "Sube y baja recto, sin círculos con los hombros", "Pausa arriba apretando el trapecio"]
    }
  },
  {
    claves: ["femoral tumbado", "femoral acostado", "femoral", "curl de piernas"],
    info: {
      fuerza: "Flexiona",
      regreso: "Regresa",
      descripcion:
        "Boca abajo en la máquina, con el rodillo sobre la parte baja de las piernas: flexiona las rodillas llevando los talones hacia los glúteos sin despegar la cadera.",
      tips: ["Cadera pegada al banco", "Aprieta femorales y glúteos arriba", "La bajada lenta es donde más trabaja el femoral"]
    }
  },
  // ── Bíceps ──
  {
    claves: ["curl arana", "arana"],
    info: {
      fuerza: "Sube",
      regreso: "Baja",
      descripcion:
        "Boca abajo, con el pecho apoyado en un banco inclinado y los brazos colgando hacia el piso, con barra Z o mancuernas: flexiona los codos sin moverlos hacia adelante.",
      tips: ["Los codos no se mueven", "Sube hasta el pico y aprieta", "Baja lento hasta estirar del todo"]
    }
  },
  {
    claves: ["martillo"],
    info: {
      fuerza: "Sube",
      regreso: "Baja",
      descripcion: "De pie, mancuernas a los costados con las palmas enfrentadas: flexiona los codos sin girar las muñecas.",
      tips: ["Codos pegados al cuerpo", "Palmas enfrentadas todo el recorrido", "Sin balanceo del torso"]
    }
  },
  {
    claves: ["predicador", "scott"],
    info: {
      fuerza: "Sube",
      regreso: "Baja",
      descripcion: "Brazos apoyados en el banco predicador, con barra Z o mancuernas: flexiona los codos y baja lento hasta casi estirar.",
      tips: ["La parte de atrás del brazo pegada al cojín", "No estires de golpe abajo", "Sube sin despegar los codos"]
    }
  },
  {
    claves: ["curl inclinado"],
    info: {
      fuerza: "Sube",
      regreso: "Baja",
      descripcion:
        "Sentado en banco inclinado a 45°, espalda apoyada y brazos colgando detrás del torso: flexiona los codos sin adelantarlos.",
      tips: ["Los codos se quedan detrás del torso", "Baja hasta estirar del todo", "Cabeza y espalda apoyadas"]
    }
  },
  {
    claves: ["biceps", "curl"],
    info: {
      fuerza: "Sube",
      regreso: "Baja",
      descripcion: "Flexiona los codos subiendo la carga sin mover los hombros, y baja lento hasta estirar del todo.",
      tips: ["Codos fijos: si se van adelante, trabaja el hombro", "Baja lento hasta la extensión completa", "Sin balanceo del torso"]
    }
  },
  // ── Pierna ──
  {
    claves: ["bulgara"],
    info: {
      fuerza: "Sube",
      regreso: "Baja",
      descripcion:
        "Pie de atrás apoyado en un banco y el de adelante bien adelantado: baja en vertical doblando la rodilla de adelante y sube empujando con esa pierna.",
      tips: ["El peso va en la pierna de adelante", "Torso estable, sin perder el equilibrio", "Baja hasta donde controles, sin rebotar"]
    }
  },
  {
    claves: ["sentadilla"],
    info: {
      fuerza: "Sube",
      regreso: "Baja",
      descripcion: "Con la barra apoyada en los trapecios, baja doblando cadera y rodillas hasta romper la paralela y sube.",
      tips: ["Abdomen firme antes de empezar a bajar", "Rodillas en línea con la punta de los pies", "Empuja el piso con todo el pie, no solo la punta"]
    }
  },
  {
    claves: ["prensa"],
    info: {
      fuerza: "Empuja",
      regreso: "Baja",
      descripcion:
        "Sentado en la prensa, pies al ancho de los hombros en la plataforma: quita los seguros, baja controlado doblando las rodillas y empuja sin bloquearlas.",
      tips: ["No despegues la cadera del respaldo al bajar", "Rango amplio sin redondear la zona lumbar", "No bloquees las rodillas arriba"]
    }
  },
  {
    claves: ["extension de cuadriceps", "sillon de cuadriceps", "extension de pierna"],
    info: {
      fuerza: "Extiende",
      regreso: "Baja",
      descripcion: "Sentado en la máquina, extiende las rodillas hasta arriba y baja lento.",
      tips: ["Aprieta el cuádriceps arriba", "Baja en 2–3 segundos, sin dejar caer la carga", "Rodilla alineada con el eje de la máquina"]
    }
  },
  {
    claves: ["peso muerto rumano", "rumano"],
    info: {
      fuerza: "Sube",
      regreso: "Baja",
      descripcion:
        "De pie con mancuernas o barra frente a los muslos y las rodillas un poco flexionadas: lleva la cadera hacia atrás con la espalda neutra hasta sentir el estiramiento del femoral, y sube.",
      tips: ["El movimiento es de cadera, no de espalda", "La carga baja rozando las piernas", "No busques el piso: baja hasta el estiramiento"]
    }
  },
  {
    claves: ["gemelos", "pantorrillas", "talones"],
    info: {
      fuerza: "Sube",
      regreso: "Baja",
      descripcion: "Con la parte delantera del pie sobre un escalón o plataforma, baja el talón hasta estirar la pantorrilla y sube hasta la punta.",
      tips: ["Recorrido completo: estira abajo y sube hasta la punta", "Sin rebotar abajo", "Rodillas firmes, casi rectas"]
    }
  },
  {
    claves: ["hip thrust", "puente de gluteos"],
    info: {
      fuerza: "Sube",
      regreso: "Baja",
      descripcion: "Con la espalda alta apoyada en un banco, empuja la cadera hacia arriba apretando los glúteos.",
      tips: ["Barbilla al pecho y costillas abajo arriba del todo", "Aprieta los glúteos en la parte alta", "Pies de modo que la espinilla quede vertical arriba"]
    }
  },
  // ── Core y otros ──
  {
    claves: ["rueda abdominal", "ab wheel", "rueda"],
    info: {
      fuerza: "Jala",
      regreso: "Rueda",
      descripcion:
        "De rodillas con la rueda bajo los hombros y el abdomen apretado: rueda hacia adelante sin hundir la cadera hasta donde controles y regresa jalando con el abdomen.",
      tips: ["Cadera alineada: no se hunde la zona lumbar", "Avanza solo hasta donde controles", "Regresa con el abdomen, no con los brazos"]
    }
  },
  {
    claves: ["plancha", "abdominales", "crunch"],
    info: {
      fuerza: "Contrae",
      regreso: "Regresa",
      descripcion: "Trabajo de abdomen manteniendo la zona media firme y controlada durante todo el ejercicio.",
      tips: ["Aprieta abdomen y glúteos: nada de cadera caída", "Calidad antes que cantidad", "Respira normal, sin contener el aire"]
    }
  },
  {
    claves: ["cuello"],
    info: {
      descripcion: "Movimientos de flexión y extensión del cuello, lentos y controlados, con el propio peso o resistencia suave.",
      tips: ["Lento y controlado, sin rebotes", "Aumenta el recorrido poco a poco", "Si aparece dolor (no cansancio), detente"]
    }
  }
];

const GENERICAS: Record<string, InfoEjercicio> = {
  pecho: {
    descripcion: "Ejercicio de pecho. Hazlo con control, sintiendo el pectoral en cada repetición.",
    tips: ["Escápulas estables y pecho arriba", "Baja con control y sube con intención", "Rango completo sin perder la técnica"]
  },
  espalda: {
    descripcion: "Ejercicio de espalda. Jala con los codos y mantén el torso estable.",
    tips: ["Empieza el jalón bajando los hombros", "Espalda neutra siempre", "Aprieta las escápulas al final del recorrido"]
  },
  pierna: {
    descripcion: "Ejercicio de pierna. Prioriza el rango de movimiento y el control en la bajada.",
    tips: ["Bajada controlada de 2–3 segundos", "Rodillas en línea con los pies", "Abdomen firme toda la serie"]
  },
  hombro: {
    descripcion: "Ejercicio de hombro. Peso moderado y técnica estricta rinden más que cargar de más.",
    tips: ["Sin balanceo del torso", "Movimiento controlado de ida y de regreso", "Si duele la articulación, ajusta el ángulo"]
  },
  brazo: {
    descripcion: "Ejercicio de brazo. Codos estables y recorrido completo.",
    tips: ["Codos fijos toda la serie", "Baja lento hasta estirar", "Sin impulso del cuerpo"]
  },
  core: {
    descripcion: "Ejercicio de abdomen. Tensión constante y movimientos controlados.",
    tips: ["Abdomen apretado todo el tiempo", "No uses impulso", "Calidad antes que cantidad"]
  },
  otro: {
    descripcion: "Haz el ejercicio con técnica controlada y rango completo de movimiento.",
    tips: ["Prioriza la técnica sobre el peso", "Controla la bajada", "Progresa poco a poco"]
  }
};

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// `especifica`: vino de la base (no de la genérica del grupo); sirve como
// referencia técnica para la IA
export function infoEjercicio(nombre: string, grupo: string | null): InfoEjercicio & { especifica: boolean } {
  const n = sinAcentos(nombre);
  for (const entrada of KB) {
    if (entrada.claves.some((c) => n.includes(c))) return { ...entrada.info, especifica: true };
  }
  return { ...(GENERICAS[(grupo ?? "otro").toLowerCase()] ?? GENERICAS.otro), especifica: false };
}
