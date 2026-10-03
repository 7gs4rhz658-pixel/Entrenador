"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { explicarRutinaAction } from "@/app/actions/entrenador";

// Escribe el paso a paso de cada ejercicio del borrador, una tanda (un día
// de la semana) por llamada. Si la IA gratis pide esperar, cuenta y sigue
// sola. Si el entrenador sale de la página, retoma donde quedó.
export default function ExplicarRutina({
  userId,
  hechos: hechosIni,
  total: totalIni,
  auto = false,
  releer = false,
  onTermina,
  onCorriendo
}: {
  userId: string;
  hechos: number;
  total: number;
  auto?: boolean; // empezar apenas se muestra (al guardar el borrador)
  releer?: boolean; // regenerar sin usar lo guardado
  onTermina?: () => void;
  onCorriendo?: (corriendo: boolean) => void; // el editor no guarda encima mientras tanto
}) {
  const router = useRouter();
  const [avance, setAvance] = useState({ hechos: hechosIni, total: totalIni });
  const [corriendo, setCorriendo] = useState(false);
  const [espera, setEspera] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const vivo = useRef(true);
  useEffect(() => () => void (vivo.current = false), []);

  async function correr(conReleer: boolean) {
    setCorriendo(true);
    onCorriendo?.(true);
    setError(null);
    let primera = true;
    for (let vueltas = 0; vueltas < 40 && vivo.current; vueltas++) {
      const r = await explicarRutinaAction({ userId, releer: conReleer && primera });
      if (!vivo.current) return;
      if (r.error) {
        setError(r.error);
        break;
      }
      setAvance({ hechos: r.hechos, total: r.total });
      if (r.aviso) setAviso(r.aviso);
      if (r.reintentarEn) {
        // La IA gratis pide unos segundos: cuenta regresiva y otra vuelta
        for (let s = r.reintentarEn; s > 0 && vivo.current; s--) {
          setEspera(s);
          await new Promise((ok) => setTimeout(ok, 1000));
        }
        setEspera(0);
        continue;
      }
      primera = false;
      if (r.hechos >= r.total) break;
    }
    if (!vivo.current) return;
    setCorriendo(false);
    onCorriendo?.(false);
    router.refresh();
    onTermina?.();
  }

  useEffect(() => {
    if (auto && avance.hechos < avance.total) void correr(releer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const falta = avance.total - avance.hechos;
  const pct = avance.total ? Math.round((avance.hechos / avance.total) * 100) : 100;
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          Paso a paso de cada ejercicio: {avance.hechos} de {avance.total}
        </p>
        {!corriendo && falta > 0 ? (
          <button type="button" onClick={() => void correr(false)} className="btn-primary shrink-0 px-3 py-1.5 text-sm">
            Explicar los que faltan
          </button>
        ) : null}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      {corriendo ? (
        <p className="mt-2 text-xs text-muted">
          {espera
            ? `La IA gratis pide una pausa: sigo en ${espera} s…`
            : "La IA está escribiendo cómo se hace cada ejercicio, con la cadencia y las parciales del plan…"}{" "}
          Puedes salir: lo que ya quedó listo se guarda.
        </p>
      ) : falta === 0 ? (
        <p className="mt-2 text-xs text-muted">
          Todos tienen su paso a paso. Revísalos (ábrelos y edítalos si algo no va) antes de enviar.
        </p>
      ) : null}
      {aviso ? <p className="mt-2 text-xs text-warn">{aviso}</p> : null}
      {error ? <p className="mt-2 text-sm font-medium text-danger">✗ {error}</p> : null}
    </div>
  );
}
