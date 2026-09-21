import Link from "next/link";
import AgregarComida from "@/components/AgregarComida";
import Asistente from "@/components/Asistente";
import ComidaItem from "@/components/ComidaItem";
import ComidasDelDia from "@/components/ComidasDelDia";
import MacroBars from "@/components/MacroBars";
import Recetas from "@/components/Recetas";
import Sustituir from "@/components/Sustituir";
import { iaDisponible } from "@/lib/ai";
import { getAjusteDelDia, getComidas, getConsultasAsistente, getDias } from "@/lib/data";
import { DESCARGO_CORTO } from "@/lib/descargo";
import { diaSemanaDe, fmtFechaCorta, fmtLitros, hoyFecha, sumarDias } from "@/lib/format";
import { recomendacionPara } from "@/lib/meal-plan-db";
import { MOMENTOS, macrosDe, objetivosCliente, sumarMacros } from "@/lib/nutrition";
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
  const diaSemana = diaSemanaDe(fecha);
  const esEntreno = dias.some((d) => d.dia_semana === diaSemana && !d.es_descanso);
  const [reco, consultas, ajuste] = await Promise.all([
    recomendacionPara(perfil.id, esEntreno ? "entreno" : "descanso", perfil.cuestionario_nutricion),
    getConsultasAsistente(perfil.id, { fecha, limite: 3 }),
    getAjusteDelDia(perfil.id, fecha)
  ]);
  const objetivo = objetivosCliente(perfil, esEntreno);
  const consumido = sumarMacros(comidas.map((c) => macrosDe(c.ingredient, c.cantidad_g)));
  const hoy = hoyFecha();
  const sep = base.includes("?") ? "&" : "?";
  const conIA = iaDisponible();
  const userIdProp = paraEntrenador ? perfil.id : undefined;

  const porMomento = new Map<Momento, typeof comidas>();
  for (const c of comidas) (porMomento.get(c.momento) ?? porMomento.set(c.momento, []).get(c.momento)!).push(c);

  // Comidas que todavía faltan hoy: las que eligió el cliente (o las 4
  // clásicas) sin nada registrado en ese momento
  const momentosCliente: Momento[] = perfil.cuestionario_nutricion?.comidas.map((c) => c.momento) ?? ["desayuno", "almuerzo", "merienda", "cena"];
  const momentosPendientes = momentosCliente.filter((m) => !porMomento.has(m));

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

      {reco ? (
        <ComidasDelDia
          perfil={perfil}
          fecha={fecha}
          reco={reco}
          comidasRegistradas={comidas}
          titulo={fecha === hoy ? "Hoy te toca" : "Menú del día"}
          userIdProp={userIdProp}
          mostrarAvisos={false}
          ajuste={ajuste}
        />
      ) : paraEntrenador ? null : (
        <p className="card text-sm text-muted">
          Tu entrenador todavía no cargó tu recomendación de comidas. Mientras tanto podés registrar
          lo que comés y ver cómo vas contra tu referencia diaria.
        </p>
      )}

      {fecha === hoy && !paraEntrenador ? (
        <Asistente userId={userIdProp} fecha={fecha} conIA={conIA} historial={consultas} />
      ) : null}

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
          momentos={momentosPendientes}
          restantes={restantes}
          preferencias={[perfil.cuestionario?.preferencias, perfil.cuestionario_nutricion?.alergias ? `alergias: ${perfil.cuestionario_nutricion.alergias}` : "", perfil.cuestionario_nutricion?.no_come ? `evita: ${perfil.cuestionario_nutricion.no_come}` : ""].filter(Boolean).join(". ")}
          conIA={conIA}
        />
      ) : null}

      {!reco ? <p className="px-1 text-center text-xs text-muted">{DESCARGO_CORTO}</p> : null}
    </div>
  );
}
