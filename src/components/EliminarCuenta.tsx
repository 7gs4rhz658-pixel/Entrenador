"use client";

import { useState, useTransition } from "react";
import { eliminarCuenta } from "@/app/actions/perfil";

// Borra la cuenta y todos los datos para siempre (se confirma escribiendo
// ELIMINAR)
export default function EliminarCuenta() {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="text-xs font-semibold text-danger">
        Eliminar mi cuenta
      </button>
    );
  }

  return (
    <section className="card border-danger/50 text-left text-sm">
      <p className="font-semibold text-danger">Eliminar mi cuenta</p>
      <p className="mt-1 text-muted">
        Se borran para siempre tu rutina, tu historial, tus comidas, tus medidas, tus fotos y tus mensajes. No se
        puede deshacer. Si solo quieres pausar, escríbele a tu entrenador.
      </p>
      <label htmlFor="confirmar-eliminar" className="label mt-3">
        Escribe ELIMINAR para confirmar
      </label>
      <input
        id="confirmar-eliminar"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        autoComplete="off"
        className="input"
      />
      {error ? <p className="mt-2 font-medium text-danger">✗ {error}</p> : null}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => setAbierto(false)} disabled={pendiente} className="btn-ghost flex-1">
          Cancelar
        </button>
        <button
          type="button"
          disabled={pendiente || texto.trim().toUpperCase() !== "ELIMINAR"}
          onClick={() =>
            iniciar(async () => {
              setError(null);
              try {
                const r = await eliminarCuenta({ confirmacion: texto });
                if (r?.error) setError(r.error);
              } catch {
                setError("No hay conexión. Inténtalo de nuevo.");
              }
            })
          }
          className="btn-danger flex-1"
        >
          {pendiente ? "Eliminando…" : "Eliminar para siempre"}
        </button>
      </div>
    </section>
  );
}
