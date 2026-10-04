"use client";

import { login } from "@/app/actions/auth";
import { useFormulario } from "@/lib/use-formulario";

function BotonEntrar({ pending }: { pending: boolean }) {
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export default function LoginForm() {
  const [estado, enviar, pendiente] = useFormulario(login, {});
  return (
    <form onSubmit={enviar} className="card flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="label">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          className="input"
          placeholder="tu@correo.com"
        />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
          placeholder="••••••••"
        />
      </div>
      {estado.error ? (
        <p className="text-sm font-medium text-danger">✗ {estado.error}</p>
      ) : null}
      <BotonEntrar pending={pendiente} />
    </form>
  );
}
