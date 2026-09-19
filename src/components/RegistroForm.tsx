"use client";

import { useFormState, useFormStatus } from "react-dom";
import { registro } from "@/app/actions/auth";

function BotonCrear() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Creando…" : "Crear cuenta"}
    </button>
  );
}

export default function RegistroForm() {
  const [estado, accion] = useFormState(registro, {});
  return (
    <form action={accion} className="card flex flex-col gap-4">
      <div>
        <label htmlFor="nombre" className="label">
          Nombre
        </label>
        <input
          id="nombre"
          name="nombre"
          autoComplete="name"
          autoFocus
          required
          className="input"
          placeholder="Como te llama tu entrenador"
        />
      </div>
      <div>
        <label htmlFor="email" className="label">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input"
          placeholder="vos@correo.com"
        />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Contraseña (mínimo 8 caracteres)
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="input"
          placeholder="••••••••"
        />
      </div>
      {estado.error ? (
        <p className="text-sm font-medium text-danger">✗ {estado.error}</p>
      ) : null}
      <BotonCrear />
    </form>
  );
}
