"use client";

import { useFormState, useFormStatus } from "react-dom";
import { cambiarClave } from "@/app/actions/auth";

function BotonGuardar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Guardando…" : "Guardar contraseña"}
    </button>
  );
}

export default function CambiarClaveForm() {
  const [estado, accion] = useFormState(cambiarClave, {});
  return (
    <form action={accion} className="card flex flex-col gap-4">
      <div>
        <label htmlFor="nueva" className="label">
          Contraseña nueva (mínimo 8 caracteres)
        </label>
        <input
          id="nueva"
          name="nueva"
          type="password"
          autoComplete="new-password"
          minLength={8}
          autoFocus
          required
          className="input"
          placeholder="••••••••"
        />
      </div>
      <div>
        <label htmlFor="repetir" className="label">
          Repítela
        </label>
        <input
          id="repetir"
          name="repetir"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="input"
          placeholder="••••••••"
        />
      </div>
      {estado.error ? <p className="text-sm font-medium text-danger">✗ {estado.error}</p> : null}
      <BotonGuardar />
    </form>
  );
}
