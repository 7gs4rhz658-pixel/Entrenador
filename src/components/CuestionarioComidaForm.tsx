"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { guardarCuestionarioNutricion } from "@/app/actions/onboarding";
import { DESCARGO_COMPLETO } from "@/lib/descargo";
import { DIAS_SEMANA } from "@/lib/format";
import { MOMENTOS } from "@/lib/nutrition";
import type { CuestionarioNutricion, Momento, Profile } from "@/lib/types";

const HORA_SUGERIDA: Record<Momento, string> = {
  desayuno: "08:00",
  almuerzo: "13:00",
  merienda: "17:00",
  cena: "21:00",
  snack: "11:00",
  pre_entreno: "17:30",
  post_entreno: "19:30"
};

function BotonSeguir() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Guardando…" : "Guardar y seguir"}
    </button>
  );
}

// Paso 2 del onboarding: comidas por día con horario, restricciones,
// cómo come y aceptación del aviso sobre las recomendaciones.
export default function CuestionarioComidaForm({ perfil }: { perfil: Profile }) {
  const [estado, accion] = useFormState(guardarCuestionarioNutricion, {});
  const cn = perfil.cuestionario_nutricion;
  const [comidas, setComidas] = useState<Record<Momento, { on: boolean; hora: string }>>(() => {
    const base = {} as Record<Momento, { on: boolean; hora: string }>;
    for (const m of MOMENTOS) {
      const prev = cn?.comidas.find((c) => c.momento === m.valor);
      base[m.valor] = {
        on: prev ? true : !cn && !["snack", "pre_entreno", "post_entreno"].includes(m.valor),
        hora: prev?.hora || HORA_SUGERIDA[m.valor]
      };
    }
    return base;
  });
  const [batch, setBatch] = useState(cn?.batch_cooking ?? true);
  const [cocina, setCocina] = useState<CuestionarioNutricion["cocina"]>(cn?.cocina ?? "cocino");
  const elegidas = MOMENTOS.filter((m) => comidas[m.valor].on).length;

  return (
    <form action={accion} className="flex flex-col gap-4">
      <section className="card">
        <h2 className="font-bold">Tus comidas del día</h2>
        <p className="mb-3 mt-0.5 text-sm text-muted">
          Marca entre 3 y 7 y pon a qué hora sueles comer. El menú se arma con esos momentos.
        </p>
        <div className="flex flex-col gap-2">
          {MOMENTOS.map((m) => {
            const c = comidas[m.valor];
            return (
              <label
                key={m.valor}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                  c.on ? "border-accent bg-accent/10" : "border-line"
                }`}
              >
                <input
                  type="checkbox"
                  name={`comida_${m.valor}`}
                  checked={c.on}
                  onChange={(e) =>
                    setComidas((s) => ({ ...s, [m.valor]: { ...s[m.valor], on: e.target.checked } }))
                  }
                  className="h-5 w-5 accent-[var(--accent)]"
                />
                <span className="flex-1 font-medium">{m.texto}</span>
                <input
                  type="time"
                  name={`hora_${m.valor}`}
                  value={c.hora}
                  disabled={!c.on}
                  onChange={(e) =>
                    setComidas((s) => ({ ...s, [m.valor]: { ...s[m.valor], hora: e.target.value } }))
                  }
                  className="input w-28 py-1.5 text-sm disabled:opacity-40"
                />
              </label>
            );
          })}
        </div>
        <p className={`mt-2 text-xs ${elegidas < 3 || elegidas > 7 ? "text-warn" : "text-muted"}`}>
          {elegidas} comida{elegidas === 1 ? "" : "s"} por día
        </p>
        <div className="mt-3">
          <label htmlFor="hora_entreno" className="label">
            ¿A qué hora entrenas? (si varía, déjalo vacío)
          </label>
          <input
            id="hora_entreno"
            name="hora_entreno"
            type="time"
            defaultValue={cn?.hora_entreno ?? ""}
            className="input w-40"
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="hora_despertar" className="label">
              Me despierto (opcional)
            </label>
            <input id="hora_despertar" name="hora_despertar" type="time" defaultValue={cn?.hora_despertar ?? ""} className="input" />
          </div>
          <div>
            <label htmlFor="hora_dormir" className="label">
              Me duermo (opcional)
            </label>
            <input id="hora_dormir" name="hora_dormir" type="time" defaultValue={cn?.hora_dormir ?? ""} className="input" />
          </div>
        </div>
        <p className="mt-1 text-xs text-muted">Ubican en tu checklist lo que va al despertar y antes de dormir.</p>
      </section>

      <section className="card">
        <h2 className="mb-3 font-bold">Lo que no va</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="alergias" className="label">
              Alergias o intolerancias (nunca aparecen en tu menú)
            </label>
            <textarea
              id="alergias"
              name="alergias"
              rows={2}
              defaultValue={cn?.alergias ?? ""}
              className="input"
              placeholder="Ej: lactosa, cacahuate, gluten"
            />
          </div>
          <div>
            <label htmlFor="no_come" className="label">
              Alimentos que no te gustan o prefieres evitar
            </label>
            <textarea
              id="no_come"
              name="no_come"
              rows={2}
              defaultValue={cn?.no_come ?? ""}
              className="input"
              placeholder="Ej: pescado, brócoli, no como carne roja"
            />
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 font-bold">Cómo comes</h2>
        <div className="flex flex-col gap-3">
          <div>
            <span className="label">Cocina</span>
            <div className="flex flex-col gap-2">
              {(
                [
                  ["cocino", "Cocino en casa"],
                  ["mixto", "A veces cocino, a veces como fuera"],
                  ["como_fuera", "Casi siempre como fuera o compro hecho"]
                ] as const
              ).map(([v, t]) => (
                <label
                  key={v}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 ${
                    cocina === v ? "border-accent bg-accent/10" : "border-line"
                  }`}
                >
                  <input
                    type="radio"
                    name="cocina"
                    value={v}
                    checked={cocina === v}
                    onChange={() => setCocina(v)}
                    className="h-5 w-5 accent-[var(--accent)]"
                  />
                  <span className="font-medium">{t}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
            <input
              type="checkbox"
              name="batch_cooking"
              checked={batch}
              onChange={(e) => setBatch(e.target.checked)}
              className="h-5 w-5 accent-[var(--accent)]"
            />
            <span className="flex-1">
              <span className="font-medium">Puedo cocinar en tandas una vez por semana</span>
              <span className="block text-xs text-muted">
                Te armamos la guía de batch cooking y la lista de compras.
              </span>
            </span>
          </label>
          {batch ? (
            <div>
              <label htmlFor="dia_batch" className="label">
                Qué día cocinas
              </label>
              <select id="dia_batch" name="dia_batch" defaultValue={cn?.dia_batch ?? 7} className="input">
                {DIAS_SEMANA.map((n, i) => (
                  <option key={n} value={i + 1}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="presupuesto" className="label">
                Presupuesto
              </label>
              <select id="presupuesto" name="presupuesto" defaultValue={cn?.presupuesto ?? "medio"} className="input">
                <option value="bajo">Ajustado</option>
                <option value="medio">Medio</option>
                <option value="alto">Sin restricción</option>
              </select>
            </div>
            <div>
              <label htmlFor="pais" className="label">
                País
              </label>
              <input
                id="pais"
                name="pais"
                type="text"
                defaultValue={cn?.pais ?? "México"}
                className="input"
                placeholder="México"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="card border-warn/30">
        <h2 className="font-bold">Antes de seguir</h2>
        <p className="mt-1 text-sm text-muted">{DESCARGO_COMPLETO}</p>
        <label className="mt-3 flex items-start gap-3">
          <input
            type="checkbox"
            name="acepto"
            defaultChecked={!!perfil.acepto_descargo_at}
            required
            className="mt-0.5 h-5 w-5 accent-[var(--accent)]"
          />
          <span className="text-sm font-medium">
            Entiendo que son recomendaciones generales de mi entrenador y no un plan de
            nutricionista.
          </span>
        </label>
      </section>

      {estado.error ? <p className="text-sm font-medium text-danger">✗ {estado.error}</p> : null}
      <BotonSeguir />
    </form>
  );
}
