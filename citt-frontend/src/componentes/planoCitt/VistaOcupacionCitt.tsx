import { useState } from "react";
import { CalendarPlus, RefreshCw, RotateCcw, RotateCw, Users } from "lucide-react";
import { Link } from "react-router-dom";
import type { ConsultaEspacios, Espacio } from "../../hooks/useOcupacionEspacios";
import { PlanoCitt } from "./PlanoCitt";
import { estadosPlano } from "./estadosPlano";
import type { EstadoPlano } from "./estadosPlano";
import { zonasCitt } from "./geometriaCitt";

const ANGULO_INICIAL = 25;
const INCLINACION_INICIAL = 44;

const horaSede = new Intl.DateTimeFormat("es-CL", {
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: "America/Santiago",
});

function normalizar(nombre: string) {
  return nombre.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().replace(/\s+/g, " ").toLowerCase();
}

function estadoDe(espacio?: Espacio): EstadoPlano {
  if (!espacio || !espacio.estado) return "sinDatos";
  if (normalizar(espacio.estado) !== "disponible") return "fuera";
  if (typeof espacio.enUsoAhora !== "boolean") return "sinDatos";
  return espacio.enUsoAhora ? "ocupado" : "libre";
}

export function VistaOcupacionCitt({ consulta, actualizar }: {
  consulta: ConsultaEspacios;
  actualizar: () => void;
}) {
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [angulo, setAngulo] = useState(ANGULO_INICIAL);
  const [inclinacion, setInclinacion] = useState(INCLINACION_INICIAL);

  function girar(horizontal: number, vertical = 0) {
    setAngulo((valor) => ((valor + horizontal) % 360 + 360) % 360);
    setInclinacion((valor) => Math.min(75, Math.max(25, valor + vertical)));
  }

  const espacios = typeof consulta === "object" ? consulta.espacios : [];
  const zonas = zonasCitt.map((zona) => {
    const nombres = [zona.nombre, zona.alias ?? zona.nombre, ...(zona.otrosNombres ?? [])].map(normalizar);
    const coincidencias = espacios.filter((espacio) => nombres.includes(normalizar(espacio.nombre)));
    const espacio = coincidencias.length === 1 ? coincidencias[0] : undefined;
    return { ...zona, espacio, estado: estadoDe(espacio) };
  });
  const estados = Object.fromEntries(zonas.map((zona) => [zona.clave, zona.estado]));
  const zonaSeleccionada = zonas.find((zona) => zona.clave === seleccion);

  return (
    <section aria-label="Ocupación de espacios" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 md:px-6">
        <ul aria-label="Leyenda de ocupación" className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {(Object.keys(estadosPlano) as EstadoPlano[]).map((clave) => {
            const cantidad = zonas.filter((zona) => zona.estado === clave).length;
            if (clave === "sinDatos" && cantidad === 0) return null;
            const estado = estadosPlano[clave];
            return (
              <li key={clave} className="flex items-center gap-1.5 text-xs font-medium text-slate-700 sm:text-sm">
                <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: estado.color }} />
                {estado.texto} <span className="font-bold tabular-nums">{cantidad}</span>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={actualizar}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-[#003b73] hover:bg-slate-50">
          <RefreshCw size={15} aria-hidden="true" /> Actualizar
        </button>
      </div>
      {consulta === "cargando" && <p role="status" className="px-4 py-3 text-sm text-slate-600">Consultando la ocupación de los espacios…</p>}
      {consulta === "error" && <p role="alert" className="bg-amber-50 px-4 py-3 text-sm text-amber-900">No se pudo consultar la ocupación. Pulsa Actualizar para volver a intentarlo.</p>}
      <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_250px]">
        <figure className="min-w-0 bg-[#e4ecee]">
          <div role="group" aria-label="Controles de la vista 3D" className="flex flex-wrap items-center gap-1 px-3 pt-3 md:px-5">
            <button type="button" aria-label="Girar a la izquierda" title="Girar a la izquierda"
              onClick={() => girar(-15)}
              className="rounded-lg bg-white/90 p-2 text-[#21454c] shadow-sm hover:bg-white disabled:opacity-40">
              <RotateCcw size={18} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => {
              setAngulo(ANGULO_INICIAL);
              setInclinacion(INCLINACION_INICIAL);
            }}
              className="rounded-lg bg-white/90 px-3 py-2 text-sm font-semibold text-[#21454c] shadow-sm hover:bg-white">
              Vista inicial
            </button>
            <button type="button" aria-label="Girar a la derecha" title="Girar a la derecha"
              onClick={() => girar(15)}
              className="rounded-lg bg-white/90 p-2 text-[#21454c] shadow-sm hover:bg-white disabled:opacity-40">
              <RotateCw size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="overflow-x-auto" tabIndex={0} aria-label="Vista 3D desplazable"
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
                girar(0, event.key === "ArrowUp" ? 5 : -5);
              }
            }}>
            <div className="min-w-[570px]">
              <PlanoCitt estados={estados} seleccion={seleccion} onSeleccion={setSeleccion}
                angulo={angulo} inclinacion={inclinacion} onGirar={girar} />
            </div>
          </div>
          <figcaption className="flex flex-wrap justify-between gap-2 px-4 pb-4 text-xs text-slate-600 md:px-6">
            <span>Selecciona un espacio para reservar. Arrastra el plano para girarlo.</span>
            {typeof consulta === "object" && <span>Actualizado a las {horaSede.format(consulta.actualizado)}</span>}
          </figcaption>
        </figure>
        <aside className="border-t border-slate-200 p-3 xl:border-l xl:border-t-0" aria-label="Espacios del plano">
          <h2 className="mb-2 px-2 text-sm font-bold text-slate-800">Espacios del CITT</h2>
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 xl:grid-cols-1">
            {zonas.map((zona) => {
              const estado = estadosPlano[zona.estado];
              const activa = zona.clave === seleccion;
              return (
                <li key={zona.clave}>
                  <button type="button" onClick={() => setSeleccion(zona.clave)} aria-pressed={activa}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left ${activa ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-slate-50"}`}>
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      style={{ background: estado.color }} aria-hidden="true">{zona.clave}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-800">{zona.nombre}</span>
                      <span className="block text-xs" style={{ color: estado.color }}>{estado.texto}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {zonaSeleccionada && (
            <div className="mt-3 space-y-2 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
              <p className="flex items-center gap-2" role="status">
                <Users size={16} aria-hidden="true" />
                {zonaSeleccionada.nombre}
                {zonaSeleccionada.espacio?.capacidad != null &&
                  ` · ${zonaSeleccionada.espacio.capacidad} ${zonaSeleccionada.espacio.capacidad === 1 ? "persona" : "personas"}`}
              </p>
              {zonaSeleccionada.espacio && normalizar(zonaSeleccionada.espacio.estado ?? "") === "disponible" ? (
                <Link to="/crear-solicitud"
                  state={{ idEspacio: zonaSeleccionada.espacio.id, nombreEspacio: zonaSeleccionada.nombre }}
                  aria-label={`Reservar ${zonaSeleccionada.nombre}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#003b73] px-3 py-2 font-semibold text-white hover:bg-[#002950]">
                  <CalendarPlus size={16} aria-hidden="true" /> Reservar espacio
                </Link>
              ) : <p>{zonaSeleccionada.espacio ? "Espacio no disponible para reservar." : "Espacio sin datos de reserva."}</p>}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
