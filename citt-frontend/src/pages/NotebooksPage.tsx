import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import api from "../api/axiosConfig";

interface Articulo {
  idArticulo: number;
  nombreArticulo: string;
  codigoDuoc?: string;
  numeroSerie?: string;
}

interface Ubicacion {
  latitud: number;
  longitud: number;
  precisionMetros: number;
  observada: string;
}

interface HistorialUbicaciones {
  lecturas: { solicitud: number; ubicacion: Ubicacion }[];
  hayMas: boolean;
}

interface Notebook {
  idArticulo: number;
  articulo: string;
  codigoDuoc?: string;
  numeroSerie?: string;
  estadoInventario: string;
  recibido: string | null;
  observado: string | null;
  prestamoExterno?: boolean;
  prestamo?: {
    solicitud: number;
    estado: string;
    solicitante: string;
    vence: string;
    devuelto: string | null;
    condicion: string | null;
    observacion: string | null;
  } | null;
  ubicacion?: Ubicacion | null;
  reporte: {
    equipo: string;
    estado: string;
    bateria: { porcentaje: number | null; cargador_conectado: boolean | null };
    programas: { nombre: string; version?: string }[];
    uso_programas?: { nombre: string; ultima_ejecucion: string }[];
    eventos_energia?: { tipo: string; fecha: string }[];
  } | null;
}

const campo = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800";
const accion = "rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50";
const fecha = new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" });
const metros = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const plazoSinReporte = 15 * 60_000;
const retencionUbicacion = 30 * 24 * 60 * 60_000;
const relativo = new Intl.RelativeTimeFormat("es-CL");

function antiguedad(valor: string, ahora: number) {
  const minutos = Math.max(0, Math.floor((ahora - Date.parse(valor)) / 60_000));
  if (minutos === 0) return "hace menos de un minuto";
  if (minutos < 60) return relativo.format(-minutos, "minute");
  if (minutos < 1440) return relativo.format(-Math.floor(minutos / 60), "hour");
  return relativo.format(-Math.floor(minutos / 1440), "day");
}

function nombreNotebook(articulo: string) {
  const numero = articulo.trim().match(/\bCITT(?:-LAP|\s+)(\d{1,3})$/i)?.[1];
  return numero ? "CITT-LAP" + String(Number(numero)).padStart(2, "0") : articulo;
}

function enlaceMapa(ubicacion: Ubicacion) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${ubicacion.latitud},${ubicacion.longitud}`)}`;
}

function HistorialNotebook({ idArticulo, ahora }: { idArticulo: number; ahora: number }) {
  const [abierto, setAbierto] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [historial, setHistorial] = useState<HistorialUbicaciones | null>(null);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    if (!abierto) return;
    const consulta = new AbortController();
    api.get<HistorialUbicaciones>(`/notebooks/${idArticulo}/ubicaciones`, {
      params: { pagina }, signal: consulta.signal,
    }).then(({ data }) => {
      if (!consulta.signal.aborted) setHistorial(data);
    }).catch(() => {
      if (!consulta.signal.aborted) setError(true);
    });
    return () => consulta.abort();
  }, [abierto, idArticulo, pagina, intento]);

  function cambiarPagina(nueva: number) {
    setHistorial(null);
    setError(false);
    setPagina(nueva);
  }

  const lecturas = historial?.lecturas.filter(({ ubicacion }) =>
    ahora - Date.parse(ubicacion.observada) < retencionUbicacion);
  return (
    <details className="mt-2 text-xs" onToggle={(event) => {
      const visible = event.currentTarget.open;
      setAbierto(visible);
      if (!visible) cambiarPagina(0);
    }}>
      <summary className="cursor-pointer text-blue-800">Historial de 30 días</summary>
      {abierto && <div className="mt-2 space-y-2">
        {error ? <button type="button" className="underline" onClick={() => {
          setError(false);
          setIntento(valor => valor + 1);
        }}>Reintentar cargar historial</button> : !historial ? <p>Cargando historial…</p> :
          lecturas?.length ? <ul className="max-h-48 space-y-2 overflow-auto">
            {lecturas.map(({ solicitud, ubicacion }) => <li key={`${solicitud}-${ubicacion.observada}`}>
              <a href={enlaceMapa(ubicacion)} target="_blank" rel="noopener noreferrer" className="text-blue-800 underline">
                {fecha.format(new Date(ubicacion.observada))} · ±{metros.format(ubicacion.precisionMetros)} m
              </a>
              <span className="block">Solicitud #{solicitud}</span>
            </li>)}
          </ul> : <p>Sin ubicaciones en esta página.</p>}
        <div className="flex gap-3">
          {pagina > 0 && <button type="button" onClick={() => cambiarPagina(pagina - 1)} className="underline">Anterior</button>}
          {historial?.hayMas && <button type="button" onClick={() => cambiarPagina(pagina + 1)} className="underline">Siguiente</button>}
        </div>
      </div>}
    </details>
  );
}
const fechaPrestamo = (valor: string) => {
  const [dia, hora] = valor.split("T");
  return dia.split("-").reverse().join("/") + " · " + hora.slice(0, 5);
};
const energia: Record<string, string> = {
  encendido: "Encendido",
  suspendido: "Suspendido",
  apagado: "Apagado",
  desconocido: "Desconocido",
};
const eventosEnergia: Record<string, string> = {
  inicio: "Inicio",
  apagado: "Apagado",
  suspension: "Suspensión",
  reanudacion: "Reanudación",
};

function VistaNotebooks() {
  const [equipos, setEquipos] = useState<Notebook[]>([]);
  const [version, setVersion] = useState(0);
  const [ahora, setAhora] = useState(() => Date.now());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [nombre, setNombre] = useState("");
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [articuloId, setArticuloId] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [generando, setGenerando] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setAhora(Date.now());
      setVersion(v => v + 1);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const consulta = new AbortController();
    api.get<Notebook[]>("/notebooks", { signal: consulta.signal })
      .then(({ data }) => {
        if (consulta.signal.aborted) return;
        setEquipos(data);
        setError("");
      })
      .catch(() => {
        if (!consulta.signal.aborted) setError("No se pudieron actualizar los reportes.");
      })
      .finally(() => {
        if (!consulta.signal.aborted) setCargando(false);
      });
    return () => consulta.abort();
  }, [version]);

  async function buscarArticulo(evento: FormEvent) {
    evento.preventDefault();
    setBuscando(true);
    setArticuloId("");
    setArticulos([]);
    setMensaje("");
    try {
      const { data } = await api.get<{ content: Articulo[] }>("/articulos", {
        params: { page: 0, size: 25, nombre: nombre.trim(), mostrarEliminados: false },
      });
      setArticulos(data.content);
      if (!data.content.length) setMensaje("No se encontraron artículos con ese nombre.");
    } catch {
      setMensaje("No se pudo consultar el inventario.");
    } finally {
      setBuscando(false);
    }
  }

  async function descargarConfiguracion() {
    if (!articuloId) return;
    const registrado = equipos.some(equipo => String(equipo.idArticulo) === articuloId);
    if (registrado && !window.confirm("Se reemplazará la clave del notebook. ¿Continuar?")) return;
    setGenerando(true);
    setMensaje("");
    try {
      const { data } = await api.post("/notebooks/" + articuloId + "/credencial", {}, {
        params: { renovar: registrado },
      });
      const servidor = new URL(api.defaults.baseURL || "/api", window.location.origin).origin;
      const configuracion = JSON.stringify({ ...data, servidor }, null, 2);
      const archivo = URL.createObjectURL(new Blob([configuracion], { type: "application/json" }));
      const enlace = document.createElement("a");
      enlace.href = archivo;
      enlace.download = "configuracion.json";
      document.body.append(enlace);
      enlace.click();
      enlace.remove();
      window.setTimeout(() => URL.revokeObjectURL(archivo), 1_000);
      setMensaje("Copia configuracion.json a la carpeta del agente de ese notebook.");
      setVersion(v => v + 1);
    } catch {
      setMensaje("No se pudo generar la configuración. Actualiza la lista si el artículo ya está vinculado.");
      setVersion(v => v + 1);
    } finally {
      setGenerando(false);
    }
  }

  return (
    <section className="space-y-5 pb-8">
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Vincular notebook al inventario</h2>
        <form onSubmit={buscarArticulo} className="flex flex-wrap gap-2">
          <input className={campo} aria-label="Nombre del artículo" value={nombre} required
            onChange={evento => setNombre(evento.target.value)} placeholder="Ej. Note Dell" />
          <button className={accion} type="submit" disabled={buscando || !nombre.trim()}>
            {buscando ? "Buscando…" : "Buscar artículo"}
          </button>
        </form>
        {articulos.length > 0 && <div className="flex flex-wrap gap-2">
          <select className={campo} aria-label="Artículo del inventario" value={articuloId}
            onChange={evento => setArticuloId(evento.target.value)}>
            <option value="">Selecciona el equipo físico</option>
            {articulos.map(articulo => <option key={articulo.idArticulo} value={articulo.idArticulo}>
              {[articulo.nombreArticulo, articulo.codigoDuoc, articulo.numeroSerie, "#" + articulo.idArticulo]
                .filter(Boolean).join(" · ")}
            </option>)}
          </select>
          <button className={accion} type="button" disabled={!articuloId || generando}
            onClick={descargarConfiguracion}>
            {generando ? "Generando…" : equipos.some(e => String(e.idArticulo) === articuloId)
              ? "Renovar clave y descargar" : "Vincular y descargar configuración"}
          </button>
        </div>}
        <p role="status" className="text-sm text-slate-600">{mensaje}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-2 p-5">
          <h2 className="font-semibold text-slate-900">Equipos vinculados</h2>
          <button type="button" className={accion} onClick={() => setVersion(v => v + 1)}>Actualizar</button>
        </div>
        {error && <p role="alert" className="px-5 pb-4 text-sm text-red-700">{error}</p>}
        {cargando && <p className="px-5 pb-5 text-sm text-slate-600">Cargando notebooks…</p>}
        {!cargando && !error && !equipos.length &&
          <p className="px-5 pb-5 text-sm text-slate-600">Todavía no hay notebooks vinculados.</p>}
        {equipos.filter((equipo) => equipo.prestamoExterno && (!equipo.observado
          || ahora - Date.parse(equipo.observado) > plazoSinReporte)).map((equipo) => (
          <p key={equipo.idArticulo} className="mx-5 mb-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <a href={`#prestamo-notebook-${equipo.idArticulo}`} className="font-semibold underline"
              onClick={() => {
                const ficha = document.getElementById(`prestamo-notebook-${equipo.idArticulo}`);
                if (ficha instanceof HTMLDetailsElement) ficha.open = true;
              }}>{nombreNotebook(equipo.articulo)}</a>
            {equipo.observado ? " lleva más de 15 minutos sin reportar durante un préstamo externo."
              : " está en préstamo externo y todavía no tiene reportes."}
          </p>
        ))}
        {!!equipos.length && <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>{["Equipo", "Inventario", "Batería", "Reporte", "Ubicación", "Programas"].map(titulo =>
                <th key={titulo} scope="col" className="px-5 py-3">{titulo}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {equipos.map(({ idArticulo, articulo, codigoDuoc, estadoInventario, observado, reporte, prestamoExterno, ubicacion, prestamo }) => {
                const numeroCitt = articulo.trim().match(/\bCITT(?:-LAP|\s+)(\d{1,3})$/i)?.[1];
                const nombreEquipo = numeroCitt ? "CITT-LAP" + String(Number(numeroCitt)).padStart(2, "0") : "Sin número asignado";
                const lectura = observado ? new Date(observado) : null;
                const reciente = lectura && ahora - lectura.getTime() <= 600_000;
                const bateria = reporte?.bateria;
                const ejecuciones = new Map(reporte?.uso_programas?.map(uso =>
                  [uso.nombre.toLowerCase(), uso.ultima_ejecucion]));
                return <tr key={idArticulo} className="align-top">
                  <td className="px-5 py-4 font-semibold text-slate-900">
                    {nombreEquipo}
                    <span className="block text-xs font-normal text-slate-600">{codigoDuoc || "Inventario #" + idArticulo}</span>
                    {prestamo ? <details id={`prestamo-notebook-${idArticulo}`} className="mt-2 font-normal">
                      <summary className="cursor-pointer whitespace-nowrap text-blue-800">
                        Ficha de préstamo
                        {prestamo.estado === "ATRASADO" && <span className="ml-1 font-semibold text-red-700"> · Atrasado</span>}
                      </summary>
                      <dl className="mt-2 grid gap-1 text-xs text-slate-700">
                        <div><dt className="inline font-semibold">Solicitud </dt><dd className="inline">#{prestamo.solicitud}</dd></div>
                        <div><dt className="inline font-semibold">Estado </dt><dd className="inline">
                          {prestamo.estado === "DEVUELTO" ? "Devuelto" : prestamo.estado === "ATRASADO" ? "Atrasado" : "En préstamo"}
                        </dd></div>
                        <div><dt className="font-semibold">Entregado a</dt><dd className="break-all">{prestamo.solicitante}</dd></div>
                        <div><dt className="font-semibold">Fecha y hora límite en Chile</dt><dd>{fechaPrestamo(prestamo.vence)}</dd></div>
                        {prestamo.devuelto && <div><dt className="font-semibold">Devuelto el</dt><dd>{fechaPrestamo(prestamo.devuelto)}</dd></div>}
                        {prestamo.condicion && <div><dt className="font-semibold">Condición al devolver</dt>
                          <dd>{prestamo.condicion}{prestamo.observacion && <span className="block">{prestamo.observacion}</span>}</dd>
                        </div>}
                      </dl>
                    </details> : <span id={`prestamo-notebook-${idArticulo}`} className="mt-2 block text-xs font-normal text-slate-600">Sin préstamo registrado</span>}
                  </td>
                  <td className="px-5 py-4">{estadoInventario}</td>
                  <td className="whitespace-nowrap px-5 py-4">
                    {bateria?.porcentaje == null ? "Sin lectura" : bateria.porcentaje + " %"}
                    {bateria?.cargador_conectado != null && <span className="block text-xs text-slate-600">
                      {bateria.cargador_conectado ? "Con cargador" : "Sin cargador"}
                    </span>}
                  </td>
                  <td className="px-5 py-4">
                    <span className={reciente ? "font-semibold text-emerald-700" : "font-semibold text-amber-800"}>
                      {reciente ? energia[reporte?.estado || ""] || "Reciente" :
                        lectura ? "Sin reporte reciente" : "Esperando primer reporte"}
                    </span>
                    {lectura && <span className="block text-xs text-slate-600">{fecha.format(lectura)}</span>}
                    {!!reporte?.eventos_energia?.length && <details className="mt-2 text-xs text-slate-600">
                      <summary className="cursor-pointer text-blue-800">Eventos de energía</summary>
                      <ul className="mt-1 max-h-40 space-y-1 overflow-auto">
                        {reporte.eventos_energia.map((evento, i) =>
                          <li key={i}>{eventosEnergia[evento.tipo]} · {fecha.format(new Date(evento.fecha))}</li>)}
                      </ul>
                    </details>}
                  </td>
                  <td className="px-5 py-4 text-sm">
                    {prestamoExterno ? ubicacion && ahora - Date.parse(ubicacion.observada) < retencionUbicacion ? <>
                      <a className="font-semibold text-blue-800 underline"
                        href={enlaceMapa(ubicacion)}
                        target="_blank" rel="noopener noreferrer">Última ubicación en Google Maps</a>
                      <span className="mt-1 block text-xs text-slate-600">
                        {ahora - Date.parse(ubicacion.observada) <= plazoSinReporte ? "Actualizada " : "Última lectura "}
                        {antiguedad(ubicacion.observada, ahora)}
                      </span>
                      <span className="block text-xs text-slate-600">
                        {fecha.format(new Date(ubicacion.observada))} · ±{metros.format(ubicacion.precisionMetros)} m
                      </span>
                    </> : <span className="text-slate-600">Aún sin ubicación</span>
                      : <span className="text-slate-600">Sin préstamo externo activo</span>}
                    <HistorialNotebook idArticulo={idArticulo} ahora={ahora} />
                  </td>
                  <td className="px-5 py-4">{reporte ? <details>
                    <summary className="cursor-pointer text-blue-800">{reporte.programas.length} registrados</summary>
                    <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-xs text-slate-700">
                      {reporte.programas.map((programa, i) =>
                        <li key={i}>
                          {programa.nombre}{programa.version ? " · " + programa.version : ""}
                          {ejecuciones.has(programa.nombre.toLowerCase()) &&
                            <span className="block text-slate-500">
                              Última ejecución: {fecha.format(new Date(ejecuciones.get(programa.nombre.toLowerCase())!))}
                            </span>}
                        </li>)}
                    </ul>
                  </details> : "Sin inventario"}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>}
      </div>
    </section>
  );
}

export function NotebooksPage() {
  const rol = localStorage.getItem("activeRole");
  if (rol !== "COORDINADOR" && rol !== "DIRECTOR") {
    return <p className="rounded-lg border border-slate-200 bg-white p-5">Esta vista está disponible para Coordinación y Dirección.</p>;
  }
  return <VistaNotebooks />;
}
