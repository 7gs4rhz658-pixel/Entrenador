"use client";

import { useFormState, useFormStatus } from "react-dom";
import { pagar } from "@/app/actions/onboarding";

function BotonPagar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Procesando pago y armando tu plan…" : "Pagar y activar mi plan"}
    </button>
  );
}

export default function PagoForm() {
  const [estado, accion] = useFormState(pagar, {});
  return (
    <form action={accion} className="card flex flex-col gap-4">
      <div>
        <label htmlFor="titular" className="label">
          Titular de la tarjeta
        </label>
        <input
          id="titular"
          name="titular"
          autoComplete="cc-name"
          required
          className="input"
          placeholder="Nombre como figura en la tarjeta"
        />
      </div>
      <div>
        <label htmlFor="numero" className="label">
          Número
        </label>
        <input
          id="numero"
          name="numero"
          inputMode="numeric"
          autoComplete="cc-number"
          required
          className="input"
          placeholder="4111 1111 1111 1111"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="vencimiento" className="label">
            Vencimiento
          </label>
          <input
            id="vencimiento"
            name="vencimiento"
            inputMode="numeric"
            autoComplete="cc-exp"
            required
            className="input"
            placeholder="MM/AA"
          />
        </div>
        <div>
          <label htmlFor="cvv" className="label">
            Código
          </label>
          <input
            id="cvv"
            name="cvv"
            inputMode="numeric"
            autoComplete="cc-csc"
            required
            className="input"
            placeholder="123"
          />
        </div>
      </div>
      {estado.error ? (
        <p className="text-sm font-medium text-danger">✗ {estado.error}</p>
      ) : null}
      <BotonPagar />
      <p className="text-center text-xs text-muted">
        La generación del plan puede tardar hasta un minuto.
      </p>
    </form>
  );
}
