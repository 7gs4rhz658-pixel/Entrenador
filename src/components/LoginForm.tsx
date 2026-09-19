"use client";

import { useFormState, useFormStatus } from "react-dom";
import { login } from "@/app/actions/auth";

function BotonEntrar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export default function LoginForm() {
  const [estado, accion] = useFormState(login, {});
  return (
    <form action={accion} className="card flex flex-col gap-4">
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
          placeholder="vos@correo.com"
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
      <BotonEntrar />
    </form>
  );
}
