// Huella de un texto del entrenador para guardar lo que la IA leyó de él
// (tabla ia_lecturas). Se ignoran los espacios, tabulaciones y líneas
// vacías: el mismo plan copiado de otro lado da la misma huella.

import { createHash } from "node:crypto";

export function normalizarParaClave(texto: string): string {
  return texto
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

// `tipo` incluye la versión de las instrucciones ("menu:2026-10-02"): si
// cambian, la lectura vieja ya no se usa.
export function claveTexto(tipo: string, texto: string): string {
  return createHash("sha256").update(`${tipo}\n${normalizarParaClave(texto)}`).digest("hex");
}
