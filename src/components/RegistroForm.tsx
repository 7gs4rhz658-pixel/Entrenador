"use client";

import Link from "next/link";
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

export default function RegistroForm({ referido = "" }: { referido?: string }) {
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
          placeholder="tu@correo.com"
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
      <div>
        <label htmlFor="referido" className="label">
          Código de un amigo (opcional)
        </label>
        <input
          id="referido"
          name="referido"
          autoComplete="off"
          defaultValue={referido}
          maxLength={12}
          className="input uppercase"
          placeholder="Ej: JUANA1B2"
        />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="privacidad" required className="mt-1 h-4 w-4 shrink-0 accent-accent" />
        <span>
          Acepto el{" "}
          <Link href="/privacidad" target="_blank" className="font-semibold text-accent">
            aviso de privacidad
          </Link>{" "}
          y que mi entrenador use mis datos de salud (peso, medidas, fotos, lesiones) para armar mi plan.
        </span>
      </label>
      {estado.error ? (
        <p className="text-sm font-medium text-danger">✗ {estado.error}</p>
      ) : null}
      <BotonCrear />
    </form>
  );
}
