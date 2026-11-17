import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { PlanoCitt } from "./componentes/planoCitt/PlanoCitt";
import { asociarOcupacion } from "./componentes/planoCitt/ocupacionPlano";
import { estadosPlano } from "./componentes/planoCitt/estadosPlano";
import type { PosicionesPlano } from "./componentes/planoCitt/geometriaCitt";
import "./index.css";

interface DatosVisor {
  revision: number;
  consultadoEn: string;
  posiciones: PosicionesPlano;
  espacios: { id: number; nombre: string; estado: string; enUsoAhora: boolean; clavePlano?: string | null }[];
}

const hora = new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", timeStyle: "short" });
const sinMover = () => {};

function VisorEspacios() {
  const [datos, setDatos] = useState<DatosVisor | null>(null);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);
  const [angulo, setAngulo] = useState(25);
  const [inclinacion, setInclinacion] = useState(44);
  const [seleccion, setSeleccion] = useState<string | null>(null);

  useEffect(() => {
    const consulta = new AbortController();
    fetch("/api/plano-citt/visor", { credentials: "omit", cache: "no-store", signal: consulta.signal })
      .then(async respuesta => {
        if (!respuesta.ok) throw new Error("No se pudo consultar el plano");
        const recibido: DatosVisor = await respuesta.json();
        if (!consulta.signal.aborted) setDatos(recibido);
      })
      .catch(() => { if (!consulta.signal.aborted) setError(true); });
    return () => consulta.abort();
  }, [intento]);

  const zonas = asociarOcupacion(datos?.espacios ?? []);
  const zona = zonas.find(valor => valor.clave === seleccion);
  return <main className="mx-auto max-w-7xl p-3 text-slate-800 sm:p-5">
    <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold">Ocupación de espacios · CITT Valparaíso</h1>
        <p className="text-sm text-slate-600">{datos ? `Consultado a las ${hora.format(new Date(datos.consultadoEn))}` : "Plano 3D"}</p>
      </div>
      <button type="button" onClick={() => {
        setError(false); setDatos(null); setIntento(valor => valor + 1);
      }} disabled={!datos && !error} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">
        Actualizar
      </button>
    </header>
    {!datos ? <p role={error ? "alert" : "status"} className="rounded-lg bg-slate-100 p-4">
      {error ? "No se pudo consultar el plano. Pulsa Actualizar para reintentar." : "Consultando el plano y la ocupación…"}
    </p> : <>
      <ul aria-label="Leyenda de ocupación" className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {Object.values(estadosPlano).map(estado => <li key={estado.texto} className="flex items-center gap-2">
          <span aria-hidden="true" className="size-3 rounded-full" style={{ background: estado.color }} />{estado.texto}
        </li>)}
      </ul>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <PlanoCitt estados={Object.fromEntries(zonas.map(z => [z.clave, z.estado]))}
          nombres={Object.fromEntries(zonas.map(z => [z.clave, z.nombre]))}
          seleccion={seleccion} onSeleccion={setSeleccion} angulo={angulo} inclinacion={inclinacion}
          posiciones={datos.posiciones} editar={false} onMover={sinMover}
          onGirar={(dx, dy) => {
            setAngulo(valor => (valor + dx + 360) % 360);
            setInclinacion(valor => Math.max(25, Math.min(75, valor + dy)));
          }} />
      </div>
      {zona && <p role="status" className="mt-2 text-sm font-semibold">{zona.nombre} · {estadosPlano[zona.estado].texto}</p>}
    </>}
  </main>;
}

createRoot(document.getElementById("visor")!).render(<VisorEspacios />);
