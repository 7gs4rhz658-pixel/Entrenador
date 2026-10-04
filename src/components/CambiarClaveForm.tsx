"use client";

import { cambiarClave } from "@/app/actions/auth";
import { useFormulario } from "@/lib/use-formulario";

function BotonGuardar({ pending }: { pending: boolean }) {
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Guardando…" : "Guardar contraseña"}
    </button>
  );
}

export default function CambiarClaveForm() {
  const [estado, enviar, pendiente] = useFormulario(cambiarClave, {});
  return (
    <form onSubmit={enviar} className="card flex flex-col gap-4">
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
      <BotonGuardar pending={pendiente} />
    </form>
  );
}
