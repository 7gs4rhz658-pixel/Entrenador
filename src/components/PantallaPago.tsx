import AvisarPago from "@/components/AvisarPago";
import LogoutButton from "@/components/LogoutButton";
import { instruccionesPago, PLAN, type EstadoPago } from "@/lib/pagos";

// Cobro manual: precio, cómo pagarle al entrenador y "Ya pagué". El plan
// se activa (o se renueva) cuando el entrenador confirma el pago.
export default function PantallaPago({ estado, avisado }: { estado: EstadoPago; avisado: string | null }) {
  const renovacion = estado.pagado;
  const instrucciones = instruccionesPago();

  return (
    <main>
      <header className="mb-5 text-center">
        <div className="mb-2 text-4xl">💳</div>
        <h1 className="text-2xl font-bold">{renovacion ? "Renueva tu mes" : "Último paso"}</h1>
        <p className="mt-1 text-muted">
          {renovacion
            ? estado.vencido
              ? "Tu mes venció. Al renovar sigues con tu rutina, tus informes y tu menú sin perder nada."
              : `Tu mes vence el ${new Date(`${estado.vence}T12:00:00`).toLocaleDateString("es-MX")}. Renueva ahora y los días que te quedan se suman.`
            : "Activa tu plan: tu entrenador arma tu rutina y tu menú a tu medida y te los envía."}
        </p>
      </header>

      <section className="card mb-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-semibold">{PLAN.nombre}</p>
          <p className="whitespace-nowrap text-xl font-bold">
            {PLAN.simbolo} {PLAN.precio.toLocaleString("es-MX")}
            <span className="text-sm font-normal text-muted">{PLAN.moneda === "MXN" ? " MXN" : ""} / mes</span>
          </p>
        </div>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm text-muted">
          {PLAN.incluye.map((t) => (
            <li key={t}>✓ {t}</li>
          ))}
        </ul>
      </section>

      <section className="card mb-4">
        <h2 className="font-semibold">Cómo pagar</h2>
        {instrucciones ? (
          <p className="mt-2 whitespace-pre-line text-sm">{instrucciones}</p>
        ) : (
          <p className="mt-2 text-sm text-muted">Tu entrenador te dice cómo pagarle (transferencia o efectivo).</p>
        )}
        <p className="mt-3 text-xs text-muted">
          Cuando pagues, toca el botón de abajo: tu entrenador recibe el aviso, confirma el pago y{" "}
          {renovacion ? "se suma tu mes." : "se activa tu plan."}
        </p>
      </section>

      <AvisarPago avisado={avisado} renovacion={renovacion} />

      {!renovacion ? (
        <div className="mt-8">
          <LogoutButton />
        </div>
      ) : null}
    </main>
  );
}
