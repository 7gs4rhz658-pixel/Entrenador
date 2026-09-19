"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { guardarPerfil } from "@/app/actions/perfil";
import { fmtKcal, fmtLitros } from "@/lib/format";
import {
  ETIQUETAS_ACTIVIDAD,
  ETIQUETAS_OBJETIVO,
  datosNutricion,
  objetivosDiarios
} from "@/lib/nutrition";
import type { NivelActividad, Objetivo, Profile, Sexo } from "@/lib/types";

function BotonGuardar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Guardando…" : "Guardar cambios"}
    </button>
  );
}

export default function ProfileForm({ perfil }: { perfil: Profile }) {
  const [estado, accion] = useFormState(guardarPerfil, {});
  const [edad, setEdad] = useState(perfil.edad ?? 25);
  const [sexo, setSexo] = useState<Sexo>(perfil.sexo ?? "masculino");
  const [peso, setPeso] = useState(perfil.peso_kg ?? 75);
  const [altura, setAltura] = useState(perfil.altura_cm ?? 175);
  const [actividad, setActividad] = useState<NivelActividad>(
    perfil.nivel_actividad ?? "ligero"
  );
  const [objetivo, setObjetivo] = useState<Objetivo>(perfil.objetivo ?? "superavit");

  const datos = datosNutricion({
    edad,
    sexo,
    peso_kg: peso,
    altura_cm: altura,
    nivel_actividad: actividad,
    objetivo
  });
  const entreno = datos ? objetivosDiarios(datos, true) : null;
  const descanso = datos ? objetivosDiarios(datos, false) : null;

  return (
    <form action={accion} className="flex flex-col gap-4">
      <div className="card grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label htmlFor="nombre" className="label">
            Nombre
          </label>
          <input
            id="nombre"
            name="nombre"
            required
            defaultValue={perfil.nombre}
            className="input"
          />
        </div>
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
            Peso corporal (kg)
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
        <div className="col-span-2">
          <label htmlFor="objetivo" className="label">
            Objetivo
          </label>
          <select
            id="objetivo"
            name="objetivo"
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value as Objetivo)}
            className="input"
          >
            {(Object.keys(ETIQUETAS_OBJETIVO) as Objetivo[]).map((o) => (
              <option key={o} value={o}>
                {ETIQUETAS_OBJETIVO[o]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {entreno && descanso ? (
        <div className="card">
          <p className="mb-2 text-sm font-semibold text-muted">
            Con estos datos, tu objetivo diario queda así:
          </p>
          <table className="w-full text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 font-medium"></th>
                <th className="py-1 text-right font-medium">Entreno</th>
                <th className="py-1 text-right font-medium">Descanso</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Calorías", fmtKcal(entreno.kcal), fmtKcal(descanso.kcal)],
                ["Proteína", `${entreno.prot_g} g`, `${descanso.prot_g} g`],
                ["Carbohidratos", `${entreno.carb_g} g`, `${descanso.carb_g} g`],
                ["Grasa", `${entreno.grasa_g} g`, `${descanso.grasa_g} g`],
                ["Agua", fmtLitros(entreno.agua_ml), fmtLitros(descanso.agua_ml)]
              ].map(([k, a, b]) => (
                <tr key={k} className="border-t border-line">
                  <td className="py-1 text-muted">{k}</td>
                  <td className="py-1 text-right font-semibold">{a}</td>
                  <td className="py-1 text-right font-semibold">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">
            Mifflin-St Jeor × actividad, ajustado por objetivo. Proteína
            2–2,2 g/kg, grasa 0,7–0,9 g/kg, el resto carbohidratos.
          </p>
        </div>
      ) : null}

      {estado.error ? (
        <p className="text-sm font-medium text-danger">✗ {estado.error}</p>
      ) : estado.ok ? (
        <p className="text-sm font-medium text-ok">✓ Guardado</p>
      ) : null}

      <BotonGuardar />
    </form>
  );
}
