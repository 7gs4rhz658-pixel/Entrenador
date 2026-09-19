// Base de conocimiento para autogenerar descripción + tips cuando el
// usuario agrega un ejercicio nuevo sin completar esos campos.
// Siempre editable después desde la sección Rutina.

interface InfoEjercicio {
  descripcion: string;
  tips: string[];
}

const KB: { claves: string[]; info: InfoEjercicio }[] = [
  {
    claves: ["press plano", "press de banca", "banca"],
    info: {
      descripcion:
        "Acostado en banco plano, bajá la barra al pecho con control y empujá hasta extender los brazos.",
      tips: [
        "Escápulas juntas y pecho arriba durante toda la serie",
        "Bajá la barra a la altura de la línea de los pezones",
        "Pies firmes en el piso; no rebotes la barra en el pecho"
      ]
    }
  },
  {
    claves: ["press inclinado"],
    info: {
      descripcion:
        "En banco inclinado (30–45°), bajá la barra o mancuernas a la parte alta del pecho y empujá hacia arriba.",
      tips: [
        "No conviertas el inclinado en un press de hombro: banco a 30–45°",
        "Codos a unos 45° del torso, no pegados ni en cruz",
        "Bajá con control hasta sentir estiramiento en el pectoral superior"
      ]
    }
  },
  {
    claves: ["press militar", "press de hombro"],
    info: {
      descripcion:
        "De pie o sentado, empujá la barra o mancuernas desde los hombros hasta extender los brazos sobre la cabeza.",
      tips: [
        "Abdomen y glúteos firmes para no arquear la zona lumbar",
        "La barra sube en línea recta, cerca de la cara",
        "Bloqueá arriba sin encoger los hombros"
      ]
    }
  },
  {
    claves: ["cruce", "poleas", "aperturas"],
    info: {
      descripcion:
        "De pie entre las poleas, juntá las manos adelante del pecho con un leve arco fijo en los codos.",
      tips: [
        "Codos apenas flexionados y fijos: el movimiento sale del hombro",
        "Apretá el pecho un segundo al juntar las manos",
        "Sin impulso del torso; un paso corto adelante para estabilizar"
      ]
    }
  },
  {
    claves: ["flexiones", "lagartijas", "push up"],
    info: {
      descripcion:
        "Con las manos apenas más anchas que los hombros, bajá el cuerpo en bloque hasta casi tocar el piso y empujá.",
      tips: [
        "Cuerpo en línea recta: apretá abdomen y glúteos",
        "Bajá hasta que el pecho casi toque el piso",
        "Si se hacen fáciles, elevá los pies o sumá lastre"
      ]
    }
  },
  {
    claves: ["tríceps en polea", "triceps en polea", "extensión de tríceps", "extension de triceps"],
    info: {
      descripcion:
        "Con la soga o barra de la polea alta, extendé los codos hacia abajo manteniéndolos pegados al cuerpo.",
      tips: [
        "Codos fijos al costado del torso todo el tiempo",
        "Extendé hasta bloquear y volvé con control",
        "Con soga, separá las manos abajo para más contracción"
      ]
    }
  },
  {
    claves: ["francés", "frances", "rompecráneos", "rompecraneos"],
    info: {
      descripcion:
        "Acostado, bajá la barra o mancuernas hacia la frente flexionando solo los codos, y extendé.",
      tips: [
        "Codos apuntando al techo, sin abrirse",
        "Bajá lento: la fase excéntrica es la que más rinde",
        "Si molestan los codos, probá bajar detrás de la cabeza"
      ]
    }
  },
  {
    claves: ["vuelos laterales", "elevaciones laterales", "laterales"],
    info: {
      descripcion:
        "De pie con mancuernas a los costados, subí los brazos hasta la altura de los hombros y bajá con control.",
      tips: [
        "Subí hasta la altura de los hombros, no más",
        "Que suban los codos, no las manos",
        "Sin balanceo: si te hamacás, bajá el peso"
      ]
    }
  },
  {
    claves: ["sentadilla"],
    info: {
      descripcion:
        "Con la barra apoyada en los trapecios, bajá flexionando cadera y rodillas hasta romper la paralela y subí.",
      tips: [
        "Core firme antes de empezar a bajar",
        "Rodillas en línea con la punta de los pies",
        "Empujá el piso con todo el pie, no solo la punta"
      ]
    }
  },
  {
    claves: ["prensa"],
    info: {
      descripcion:
        "Sentado en la máquina, bajá la plataforma flexionando las rodillas hacia el pecho y empujá sin bloquear de golpe.",
      tips: [
        "No despegues la cadera del respaldo al bajar",
        "Rango amplio pero sin redondear la zona lumbar",
        "No bloquees las rodillas con violencia arriba"
      ]
    }
  },
  {
    claves: ["extensión de cuádriceps", "extension de cuadriceps", "sillón de cuádriceps", "sillon de cuadriceps"],
    info: {
      descripcion:
        "Sentado en la máquina, extendé las rodillas hasta arriba y bajá lento.",
      tips: [
        "Apretá el cuádriceps un segundo arriba",
        "Bajá en 2–3 segundos, no dejes caer la carga",
        "Rodilla alineada con el eje de giro de la máquina"
      ]
    }
  },
  {
    claves: ["femoral", "curl de piernas", "curl femoral"],
    info: {
      descripcion:
        "En la máquina de femorales, flexioná las rodillas llevando los talones hacia los glúteos y volvé lento.",
      tips: [
        "No despegues la cadera del apoyo",
        "Pausa breve en la contracción máxima",
        "La vuelta lenta es donde más crece el femoral"
      ]
    }
  },
  {
    claves: ["peso muerto rumano", "rumano"],
    info: {
      descripcion:
        "De pie con la barra, llevá la cadera atrás bajando la barra pegada a las piernas hasta sentir el estiramiento del femoral.",
      tips: [
        "Espalda neutra siempre; el movimiento es de cadera",
        "La barra baja rozando los muslos",
        "Subí apretando glúteos, sin hiperextender arriba"
      ]
    }
  },
  {
    claves: ["gemelos", "pantorrillas", "talones"],
    info: {
      descripcion:
        "Subí en punta de pies con recorrido completo y bajá estirando bien el gemelo abajo.",
      tips: [
        "Recorrido completo: estirá bien abajo y subí hasta la punta",
        "Pausa de un segundo abajo para no rebotar",
        "Cortá cada serie con la reserva indicada (RIR)"
      ]
    }
  },
  {
    claves: ["cuello"],
    info: {
      descripcion:
        "Movimientos de flexión y extensión del cuello, lentos y controlados, con el propio peso o resistencia suave.",
      tips: [
        "Lento y controlado, sin rebotes",
        "Aumentá el recorrido de a poco",
        "Si aparece dolor (no fatiga), frená"
      ]
    }
  },
  {
    claves: ["jalón", "jalon", "polea al pecho"],
    info: {
      descripcion:
        "Sentado frente a la polea alta, llevá la barra a la parte alta del pecho y volvé controlando.",
      tips: [
        "Barra a la parte alta del pecho, nunca detrás de la nuca",
        "Empezá bajando los hombros y juntando escápulas",
        "Torso apenas inclinado atrás y estable"
      ]
    }
  },
  {
    claves: ["dominadas"],
    info: {
      descripcion:
        "Colgado de la barra, subí hasta pasar el mentón y bajá con control hasta estirar los brazos.",
      tips: [
        "Iniciá bajando los hombros, no con impulso",
        "Bajá completo: media dominada es media espalda",
        "Si no salen, usá banda o polea asistida"
      ]
    }
  },
  {
    claves: ["remo con polea", "remo sentado", "remo bajo"],
    info: {
      descripcion:
        "Sentado frente a la polea baja, llevá el agarre al abdomen manteniendo el torso firme.",
      tips: [
        "Espalda neutra: pecho afuera todo el recorrido",
        "Llevá el agarre al abdomen y apretá las escápulas",
        "Sin envión del torso para mover más peso"
      ]
    }
  },
  {
    claves: ["remo con barra"],
    info: {
      descripcion:
        "Inclinado con la espalda recta, llevá la barra hacia el abdomen y bajá con control.",
      tips: [
        "Torso a 30–45° y espalda neutra fija",
        "La barra viaja hacia el ombligo, codos cerca del cuerpo",
        "Si te hamacás para subirla, bajá el peso"
      ]
    }
  },
  {
    claves: ["encogimientos", "trapecio"],
    info: {
      descripcion:
        "De pie con mancuernas, subí los hombros hacia las orejas, pausá arriba y bajá lento.",
      tips: [
        "Brazos relajados: no dobles los codos",
        "Subí y bajá recto, sin círculos con los hombros",
        "Pausa de un segundo arriba"
      ]
    }
  },
  {
    claves: ["posterior", "pájaros", "pajaros", "face pull"],
    info: {
      descripcion:
        "Inclinado con el torso casi paralelo al piso, abrí los brazos hacia los costados con los codos apenas flexionados.",
      tips: [
        "Peso liviano y técnica estricta: es un músculo chico",
        "Codos apenas flexionados y fijos",
        "Pensá en separar las manos, no en levantarlas"
      ]
    }
  },
  {
    claves: ["bíceps", "biceps", "curl"],
    info: {
      descripcion:
        "Flexioná los codos subiendo la carga sin mover los hombros, y bajá lento hasta estirar del todo.",
      tips: [
        "Codos fijos: si viajan adelante, roba el hombro",
        "Bajá lento hasta la extensión completa",
        "Sin balanceo del torso"
      ]
    }
  },
  {
    claves: ["plancha", "abdominales", "crunch"],
    info: {
      descripcion:
        "Trabajo de core manteniendo la zona media firme y controlada durante todo el ejercicio.",
      tips: [
        "Apretá abdomen y glúteos: nada de cadera caída",
        "Calidad antes que cantidad de segundos o reps",
        "Respirá normal, no contengas el aire"
      ]
    }
  },
  {
    claves: ["hip thrust", "puente de glúteos", "puente de gluteos"],
    info: {
      descripcion:
        "Con la espalda alta apoyada en un banco, empujá la cadera hacia arriba apretando glúteos.",
      tips: [
        "Mentón al pecho y costillas abajo arriba del todo",
        "Pausa de un segundo apretando glúteos",
        "Los pies quedan de modo que la tibia esté vertical arriba"
      ]
    }
  }
];

const GENERICAS: Record<string, InfoEjercicio> = {
  pecho: {
    descripcion: "Ejercicio de pecho. Ejecutalo con control, sintiendo el pectoral en cada repetición.",
    tips: ["Escápulas estables y pecho arriba", "Bajá con control, subí con intención", "Rango completo sin perder la técnica"]
  },
  espalda: {
    descripcion: "Ejercicio de espalda. Tirá con los codos y mantené el torso estable.",
    tips: ["Iniciá el tirón bajando los hombros", "Espalda neutra siempre", "Apretá las escápulas al final del recorrido"]
  },
  pierna: {
    descripcion: "Ejercicio de pierna. Priorizá el rango de movimiento y el control en la bajada.",
    tips: ["Bajada controlada de 2–3 segundos", "Rodillas en línea con los pies", "Core firme durante toda la serie"]
  },
  hombro: {
    descripcion: "Ejercicio de hombro. Peso moderado y técnica estricta rinden más que cargar de más.",
    tips: ["Sin balanceo del torso", "Movimiento controlado en ambas fases", "Si duele la articulación, ajustá el ángulo"]
  },
  brazo: {
    descripcion: "Ejercicio de brazo. Codos estables y recorrido completo.",
    tips: ["Codos fijos durante toda la serie", "Bajá lento hasta estirar", "Sin impulso del cuerpo"]
  },
  core: {
    descripcion: "Ejercicio de zona media. Tensión constante y movimientos controlados.",
    tips: ["Abdomen apretado todo el tiempo", "No uses impulso", "Calidad antes que cantidad"]
  },
  otro: {
    descripcion: "Ejecutá el ejercicio con técnica controlada y rango completo de movimiento.",
    tips: ["Priorizá la técnica sobre el peso", "Controlá la fase de bajada", "Progresá de a poco"]
  }
};

export function infoEjercicio(nombre: string, grupo: string | null): InfoEjercicio {
  const n = nombre.toLowerCase();
  for (const entrada of KB) {
    if (entrada.claves.some((c) => n.includes(c))) return entrada.info;
  }
  return GENERICAS[(grupo ?? "otro").toLowerCase()] ?? GENERICAS.otro;
}
