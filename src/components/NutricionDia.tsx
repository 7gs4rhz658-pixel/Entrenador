import Link from "next/link";
import AgregarComida from "@/components/AgregarComida";
import ComidaItem from "@/components/ComidaItem";
import MacroBars from "@/components/MacroBars";
import Recetas from "@/components/Recetas";
import Sustituir from "@/components/Sustituir";
import { iaDisponible } from "@/lib/ai";
import { getComidas, getDias } from "@/lib/data";
import { fmtFechaCorta, fmtLitros, hoyFecha, sumarDias } from "@/lib/format";
import { MOMENTOS, datosNutricion, macrosDe, objetivosDiarios, sumarMacros } from "@/lib/nutrition";
import type { Momento, Profile } from "@/lib/types";

// Día de nutrición completo: objetivos vs consumido, comidas por momento,
// agregar / sustituir / recetas. Lo usa el cliente y el entrenador.
export default async function NutricionDia({
  perfil,
  fecha,
  base,
  paraEntrenador = false
}: {
  perfil: Profile;
  fecha: string;
  base: string; // ruta para la navegación de fechas (?fecha=)
  paraEntrenador?: boolean;
}) {
  const [comidas, dias] = await Promise.all([getComidas(perfil.id, fecha), getDias(perfil.id)]);
  const diaSemana = ((new Date(`${fecha}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
  const esEntreno = dias.some((d) => d.dia_semana === diaSemana && !d.es_descanso);
  const datos = datosNutricion(perfil);
  const objetivo = datos ? objetivosDiarios(datos, esEntreno) : null;
  const consumido = sumarMacros(comidas.map((c) => macrosDe(c.ingredient, c.cantidad_g)));
  const hoy = hoyFecha();
  const sep = base.includes("?") ? "&" : "?";
  const conIA = iaDisponible();
  const userIdProp = paraEntrenador ? perfil.id : undefined;

  const porMomento = new Map<Momento, typeof comidas>();
  for (const c of comidas) (porMomento.get(c.momento) ?? porMomento.set(c.momento, []).get(c.momento)!).push(c);

  const restantes = objetivo
    ? {
        kcal: Math.max(0, objetivo.kcal - consumido.kcal),
        prot_g: Math.max(0, Math.round(objetivo.prot_g - consumido.prot_g)),
        carb_g: Math.max(0, Math.round(objetivo.carb_g - consumido.carb_g)),
        grasa_g: Math.max(0, Math.round(objetivo.grasa_g - consumido.grasa_g))
      }
    : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Link
          href={`${base}${sep}fecha=${sumarDias(fecha, -1)}`}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-muted"
          aria-label="Día anterior"
        >
          ‹
        </Link>
        <div className="text-center">
          <p className="font-semibold capitalize">{fecha === hoy ? "Hoy" : fmtFechaCorta(fecha)}</p>
          <p className="text-xs text-muted">
            {esEntreno ? "Día de entreno" : "Día de descanso"}
            {objetivo ? ` · agua ${fmtLitros(objetivo.agua_ml)}` : ""}
          </p>
        </div>
        {fecha < hoy ? (
          <Link
            href={`${base}${sep}fecha=${sumarDias(fecha, 1)}`}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-muted"
            aria-label="Día siguiente"
          >
            ›
          </Link>
        ) : (
          <span className="w-10" />
        )}
      </div>

      {objetivo ? (
        <section className="card">
          <MacroBars consumido={consumido} objetivo={objetivo} />
        </section>
      ) : (
        <Link href="/perfil" className="card block">
          <p className="font-semibold">Faltan datos del perfil</p>
          <p className="text-sm text-muted">Edad, peso y altura para calcular tus macros →</p>
        </Link>
      )}

      <AgregarComida userId={userIdProp} fecha={fecha} />

      {comidas.length === 0 ? (
        <p className="card text-center text-sm text-muted">
          Todavía no hay comidas registradas este día.
        </p>
      ) : (
        MOMENTOS.filter((m) => porMomento.has(m.valor)).map((m) => {
          const lista = porMomento.get(m.valor)!;
          const sub = sumarMacros(lista.map((c) => macrosDe(c.ingredient, c.cantidad_g)));
          return (
            <section key={m.valor} className="card">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="font-bold">{m.texto}</h2>
                <span className="text-xs text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {sub.kcal} kcal · P {sub.prot_g} · C {sub.carb_g} · G {sub.grasa_g}
                </span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {lista.map((c) => (
                  <ComidaItem key={c.id} comida={c} />
                ))}
              </ul>
            </section>
          );
        })
      )}

      <Sustituir userId={userIdProp} fecha={fecha} hayComidas={comidas.length > 0} conIA={conIA} />

      {restantes ? (
        <Recetas
          restantes={restantes}
          preferencias={perfil.cuestionario?.preferencias ?? ""}
          conIA={conIA}
        />
      ) : null}
    </div>
  );
}
