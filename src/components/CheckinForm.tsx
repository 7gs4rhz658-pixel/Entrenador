"use client";

import { guardarCheckin } from "@/app/actions/checkin";
import { useFormulario } from "@/lib/use-formulario";

function Escala({ nombre, etiqueta, bajo, alto }: { nombre: string; etiqueta: string; bajo: string; alto: string }) {
  return (
    <div>
      <span className="label">{etiqueta}</span>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((v) => (
          <label key={v} className="cursor-pointer">
            <input type="radio" name={nombre} value={v} required className="peer sr-only" />
            <span className="flex h-11 items-center justify-center rounded-xl border border-line text-sm font-semibold text-muted peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-ink">
              {v}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{bajo}</span>
        <span>{alto}</span>
      </div>
    </div>
  );
}

function BotonEnviar({ pending }: { pending: boolean }) {
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Guardando y armando tu informe…" : "Enviar check-in"}
    </button>
  );
}

// Un minuto al cerrar la semana: peso, medidas opcionales y cómo se
// sintió. Con esto y sus registros sale el informe semanal.
export default function CheckinForm({
  mesoId,
  semana,
  pesoActual
}: {
  mesoId: string;
  semana: number;
  pesoActual: number | null;
}) {
  const [estado, enviar, pendiente] = useFormulario(guardarCheckin, {});
  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="meso" value={mesoId} />
      <input type="hidden" name="semana" value={semana} />

      <section className="card">
        <h2 className="mb-3 font-bold">Tus números</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="peso_kg" className="label">
              Peso de hoy (kg)
            </label>
            <input
              id="peso_kg"
              name="peso_kg"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={30}
              max={300}
              required
              defaultValue={pesoActual ?? ""}
              className="input"
              placeholder="75.0"
            />
          </div>
          <div>
            <label htmlFor="cintura_cm" className="label">
              Cintura (cm, opcional)
            </label>
            <input
              id="cintura_cm"
              name="cintura_cm"
              type="number"
              inputMode="decimal"
              step="0.5"
              min={40}
              max={200}
              className="input"
              placeholder="a la altura del ombligo"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">
          Pesate a la misma hora que siempre, mejor en ayunas. Una semana no dice nada sola: lo que
          importa es la tendencia. ¿Tienes cinta métrica? Después del check-in registra tus medidas en{" "}
          <a href="/progreso?tab=medidas" className="font-semibold text-accent">
            Progreso → Medidas
          </a>
          .
        </p>
      </section>

      <section className="card flex flex-col gap-4">
        <h2 className="font-bold">Cómo te sentiste</h2>
        <Escala nombre="energia" etiqueta="Energía durante la semana" bajo="Sin pilas" alto="A full" />
        <Escala nombre="sueno" etiqueta="Sueño" bajo="Mal" alto="Muy bien" />
        <Escala nombre="adherencia" etiqueta="¿Cómo te fue siguiendo el plan?" bajo="Poco" alto="Al pie" />
        <div>
          <label htmlFor="comentario" className="label">
            ¿Algo que quieras contarle a tu entrenador? (opcional)
          </label>
          <textarea
            id="comentario"
            name="comentario"
            rows={3}
            className="input"
            placeholder="Ej: me costó la cena los días de gym, dolor leve en la rodilla el viernes…"
          />
        </div>
      </section>

      {estado.error ? <p className="text-sm font-medium text-danger">✗ {estado.error}</p> : null}
      <BotonEnviar pending={pendiente} />
    </form>
  );
}
