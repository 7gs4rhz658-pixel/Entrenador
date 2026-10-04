"use client";

import { useState } from "react";
import { guardarCuestionario } from "@/app/actions/onboarding";
import { DIAS_SEMANA, fmtKcal } from "@/lib/format";
import {
  ETIQUETAS_ACTIVIDAD,
  ETIQUETAS_OBJETIVO,
  datosNutricion,
  objetivosDiarios
} from "@/lib/nutrition";
import type { NivelActividad, Objetivo, Profile, Sexo } from "@/lib/types";
import { useFormulario } from "@/lib/use-formulario";

function BotonSeguir({ pending }: { pending: boolean }) {
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Guardando…" : "Guardar y seguir"}
    </button>
  );
}

export default function CuestionarioForm({ perfil }: { perfil: Profile }) {
  const [estado, enviar, pendiente] = useFormulario(guardarCuestionario, {});
  const c = perfil.cuestionario;
  const [edad, setEdad] = useState(perfil.edad ?? 25);
  const [sexo, setSexo] = useState<Sexo>(perfil.sexo ?? "masculino");
  const [peso, setPeso] = useState(perfil.peso_kg ?? 75);
  const [altura, setAltura] = useState(perfil.altura_cm ?? 175);
  const [actividad, setActividad] = useState<NivelActividad>(
    perfil.nivel_actividad ?? "ligero"
  );
  const [objetivo, setObjetivo] = useState<Objetivo>(perfil.objetivo ?? "superavit");
  const [dias, setDias] = useState<number[]>(c?.dias_disponibles ?? [1, 3, 5]);

  const datos = datosNutricion({
    edad,
    sexo,
    peso_kg: peso,
    altura_cm: altura,
    nivel_actividad: actividad,
    objetivo
  });
  const obj = datos ? objetivosDiarios(datos, true) : null;

  function toggleDia(d: number) {
    setDias((ds) =>
      ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort((a, b) => a - b)
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <section className="card">
        <h2 className="mb-3 font-bold">Tus datos</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="edad" className="label">
              Edad
            </label>
            <input
              id="edad"
              name="edad"
              type="number"
              inputMode="numeric"
              min={14}
              max={90}
              required
              value={edad}
              onChange={(e) => setEdad(Number(e.target.value))}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="sexo" className="label">
              Sexo
            </label>
            <select
              id="sexo"
              name="sexo"
              value={sexo}
              onChange={(e) => setSexo(e.target.value as Sexo)}
              className="input"
            >
              <option value="masculino">Masculino</option>
              <option value="femenino">Femenino</option>
            </select>
          </div>
          <div>
            <label htmlFor="peso_kg" className="label">
              Peso (kg)
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
              value={peso}
              onChange={(e) => setPeso(Number(e.target.value))}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="altura_cm" className="label">
              Altura (cm)
            </label>
            <input
              id="altura_cm"
              name="altura_cm"
              type="number"
              inputMode="decimal"
              step="0.5"
              min={120}
              max={230}
              required
              value={altura}
              onChange={(e) => setAltura(Number(e.target.value))}
              className="input"
            />
          </div>
          <div className="col-span-2">
            <label htmlFor="nivel_actividad" className="label">
              Actividad fuera del gym
            </label>
            <select
              id="nivel_actividad"
              name="nivel_actividad"
              value={actividad}
              onChange={(e) => setActividad(e.target.value as NivelActividad)}
              className="input"
            >
              {(Object.keys(ETIQUETAS_ACTIVIDAD) as NivelActividad[]).map((n) => (
                <option key={n} value={n}>
                  {ETIQUETAS_ACTIVIDAD[n]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 font-bold">Tu objetivo</h2>
        <div className="flex flex-col gap-2">
          {(Object.keys(ETIQUETAS_OBJETIVO) as Objetivo[]).map((o) => (
            <label
              key={o}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 ${
                objetivo === o ? "border-accent bg-accent/10" : "border-line"
              }`}
            >
              <input
                type="radio"
                name="objetivo"
                value={o}
                checked={objetivo === o}
                onChange={() => setObjetivo(o)}
                className="h-5 w-5 accent-[var(--accent)]"
              />
              <span className="font-medium">{ETIQUETAS_OBJETIVO[o]}</span>
            </label>
          ))}
        </div>
        {obj ? (
          <p className="mt-3 text-xs text-muted">
            Día de entreno aprox.: {fmtKcal(obj.kcal)} · {obj.prot_g} g proteína ·{" "}
            {obj.carb_g} g carbos · {obj.grasa_g} g grasa.
          </p>
        ) : null}
      </section>

      <section className="card">
        <h2 className="mb-3 font-bold">Tu entrenamiento</h2>
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="experiencia" className="label">
              Experiencia con pesas
            </label>
            <select
              id="experiencia"
              name="experiencia"
              defaultValue={c?.experiencia ?? "principiante"}
              className="input"
            >
              <option value="principiante">Principiante (menos de 1 año)</option>
              <option value="intermedio">Intermedio (1 a 3 años)</option>
              <option value="avanzado">Avanzado (más de 3 años)</option>
            </select>
          </div>
          <div>
            <span className="label">Días que puedes entrenar</span>
            <div className="grid grid-cols-7 gap-1.5">
              {DIAS_SEMANA.map((nombre, i) => {
                const d = i + 1;
                const on = dias.includes(d);
                return (
                  <label
                    key={d}
                    className={`flex h-11 cursor-pointer items-center justify-center rounded-xl border text-sm font-semibold ${
                      on
                        ? "border-accent bg-accent text-accent-ink"
                        : "border-line text-muted"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="dias"
                      value={d}
                      checked={on}
                      onChange={() => toggleDia(d)}
                      className="sr-only"
                    />
                    {nombre.slice(0, 2)}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="minutos_sesion" className="label">
                Tiempo por sesión
              </label>
              <select
                id="minutos_sesion"
                name="minutos_sesion"
                defaultValue={c?.minutos_sesion ?? 60}
                className="input"
              >
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
              </select>
            </div>
            <div>
              <label htmlFor="equipamiento" className="label">
                Equipamiento
              </label>
              <select
                id="equipamiento"
                name="equipamiento"
                defaultValue={c?.equipamiento ?? "gimnasio"}
                className="input"
              >
                <option value="gimnasio">Gimnasio completo</option>
                <option value="casa_basico">Casa con mancuernas</option>
                <option value="sin_equipo">Sin equipamiento</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="lesiones" className="label">
              Lesiones o limitaciones (opcional)
            </label>
            <textarea
              id="lesiones"
              name="lesiones"
              rows={2}
              defaultValue={c?.lesiones ?? ""}
              className="input"
              placeholder="Ej: molestia en el hombro derecho, evitar press militar"
            />
          </div>
          <div>
            <label htmlFor="preferencias" className="label">
              Preferencias (opcional)
            </label>
            <textarea
              id="preferencias"
              name="preferencias"
              rows={2}
              defaultValue={c?.preferencias ?? ""}
              className="input"
              placeholder="Ej: me gustan las sentadillas, no como carne roja"
            />
          </div>
        </div>
      </section>

      {estado.error ? (
        <p className="text-sm font-medium text-danger">✗ {estado.error}</p>
      ) : null}
      <BotonSeguir pending={pendiente} />
    </form>
  );
}
