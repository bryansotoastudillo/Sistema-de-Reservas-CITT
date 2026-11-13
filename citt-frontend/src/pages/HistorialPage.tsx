import React, { useEffect, useState } from "react";
import { ResumenRecursosCowork, type RecursoCowork } from "../componentes/RecursosCowork";
import { Navigate } from "react-router-dom";
import {
  Search,
  RefreshCw,
  Package,
  Calendar,
  Clock,
  Archive,
  MapPin,
  X,
  XCircle,
  AlertTriangle,
  Eye,
  Hash,
  Tag,
  Barcode,
  CheckCircle,
  ExternalLink,
} from "lucide-react";

import api from "../api/axiosConfig";
import BadgeEstado from "../componentes/BadgeEstado";

interface ArticuloAsignadoDTO {
  idArticulo: number;
  nombreArticulo: string;
  codigoDuoc: string;
  marca: string;
}

interface RequerimientoDTO {
  idCategoria: number;
  nombreCategoria: string;
  marca: string;
  cantidad: number;
}

interface SolicitudDTO {
  idSolicitud: number;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  proposito: string;
  estado: string;
  cantidadIntegrantes: number | null;
  exclusividad: boolean;
  emailUsuario: string;
  nombreEspacio: string | null;
  nombresArticulos: string[];
  fechaDevolucionReal?: string;
  articulosAsignados?: ArticuloAsignadoDTO[];
  requerimientos?: RequerimientoDTO[];
  espacioDanadoEnDevolucion?: boolean;
  comentarioDanoEspacio?: string;
  idsArticulosDanados?: string;
  motivoRechazo?: string;
  destinoExterno?: string;
  recursosCowork?: RecursoCowork[];
}

export const HistorialPage: React.FC = () => {
  const [solicitudes, setSolicitudes] = useState<SolicitudDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [solicitudDetalle, setSolicitudDetalle] = useState<SolicitudDTO | null>(null);
  const [vistaActiva, setVistaActiva] = useState<"finalizadas" | "rechazadas">("finalizadas");

  const activeRole = localStorage.getItem("activeRole") || "";
  const isStaff = ["AYUDANTE", "DOCENTE", "COORDINADOR", "DIRECTOR"].includes(activeRole);

  // Alumnos no pueden ver el historial, pero profesores y ayudantes sí
  if (activeRole === "ALUMNO") {
    return <Navigate to="/solicitudes" replace />;
  }

  const fetchHistorial = async () => {
    setLoading(true);
    try {
      const response = await api.get("/solicitudes");
      setSolicitudes(response.data);
    } catch (error) {
      console.error("Error al cargar historial:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistorial();
  }, []);

  // Filtrar solo las solicitudes FINALIZADAS
  const solicitudesFinalizadas = solicitudes
    .filter((s) => s.estado === "FINALIZADA")
    .filter(
      (s) =>
        s.emailUsuario?.toLowerCase().includes(filtro.toLowerCase()) ||
        s.proposito?.toLowerCase().includes(filtro.toLowerCase()) ||
        (s.nombreEspacio && s.nombreEspacio.toLowerCase().includes(filtro.toLowerCase())) ||
        s.nombresArticulos?.some((a) =>
          a.toLowerCase().includes(filtro.toLowerCase())
        )
    );

  // Filtrar solicitudes RECHAZADAS
  const solicitudesRechazadas = solicitudes
    .filter((s) => s.estado === "RECHAZADA")
    .filter(
      (s) =>
        s.emailUsuario?.toLowerCase().includes(filtro.toLowerCase()) ||
        s.proposito?.toLowerCase().includes(filtro.toLowerCase()) ||
        (s.nombreEspacio && s.nombreEspacio.toLowerCase().includes(filtro.toLowerCase())) ||
        (s.motivoRechazo && s.motivoRechazo.toLowerCase().includes(filtro.toLowerCase()))
    );

  const formatHora = (hora: string) => {
    if (!hora) return "";
    return hora.substring(0, 5);
  };

  const formatFechaDevolucion = (fechaStr?: string) => {
    if (!fechaStr) return "—";
    const fecha = new Date(fechaStr);
    return fecha.toLocaleString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Parsear IDs de artículos dañados para cruzar con articulosAsignados
  const getArticulosDanados = (solicitud: SolicitudDTO) => {
    if (!solicitud.idsArticulosDanados || !solicitud.articulosAsignados) return [];
    const ids = solicitud.idsArticulosDanados.split(",").map(id => parseInt(id.trim()));
    return solicitud.articulosAsignados.filter(a => ids.includes(a.idArticulo));
  };

  return (
    <>
      <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* BARRA DE BÚSQUEDA + REFRESH */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center p-2">
            <div className="pl-4 text-slate-400">
              <Search size={20} />
            </div>
            <input
              type="text"
              placeholder="Buscar por email, propósito, espacio o artículo..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="w-full pl-4 pr-4 py-2 border-none outline-none font-medium text-slate-700 bg-transparent"
            />
          </div>
          <button
            onClick={fetchHistorial}
            className="p-3 border border-slate-300 rounded-xl hover:text-blue-600 hover:border-blue-300 cursor-pointer bg-white transition-colors shadow-sm"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
        {/* TABS DE VISTA */}
        <div className="flex gap-2">
          <button
            onClick={() => setVistaActiva("finalizadas")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${vistaActiva === "finalizadas" ? "bg-emerald-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:border-emerald-300 hover:text-emerald-600"}`}
          >
            <CheckCircle size={16} />
            Finalizadas
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${vistaActiva === "finalizadas" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
              {solicitudesFinalizadas.length}
            </span>
          </button>
          <button
            onClick={() => setVistaActiva("rechazadas")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${vistaActiva === "rechazadas" ? "bg-red-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:border-red-300 hover:text-red-600"}`}
          >
            <XCircle size={16} />
            Rechazadas
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${vistaActiva === "rechazadas" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
              {solicitudesRechazadas.length}
            </span>
          </button>
        </div>

        {/* CONTENIDO SEGÚN TAB */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : vistaActiva === "finalizadas" ? (
          /* ===== TABLA FINALIZADAS ===== */
          solicitudesFinalizadas.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-sm">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Archive size={32} className="text-slate-400" />
            </div>
            <p className="text-slate-500 font-bold text-lg m-0">
              No hay solicitudes finalizadas
            </p>
            <p className="text-slate-400 text-sm mt-2 m-0">
              Las solicitudes completadas aparecerán aquí.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-gray-50/50">
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Solicitante</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Horario Solicitado</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Devuelto</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Recursos</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Propósito</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {solicitudesFinalizadas.map((s) => {
                    const tieneDanos = s.espacioDanadoEnDevolucion || (s.idsArticulosDanados && s.idsArticulosDanados.length > 0);
                    return (
                    <tr key={s.idSolicitud} className={`hover:bg-slate-50/80 transition-colors ${tieneDanos ? 'bg-red-50/30' : ''}`}>
                      <td className="p-4 font-mono text-sm text-slate-500">#{s.idSolicitud}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                            {s.emailUsuario?.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-slate-700 truncate max-w-[180px]">{s.emailUsuario}</span>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-slate-700">
                        <span className="flex items-center gap-1.5"><Calendar size={14} className="text-slate-400" />{s.fecha}</span>
                      </td>
                      <td className="p-4 text-sm text-slate-700">
                        <span className="flex items-center gap-1.5"><Clock size={14} className="text-slate-400" />{formatHora(s.horaInicio)} - {formatHora(s.horaFin)}</span>
                      </td>
                      <td className="p-4 text-sm text-slate-700">
                        <span className="flex items-center gap-1.5"><Clock size={14} className="text-emerald-500" />{formatFechaDevolucion(s.fechaDevolucionReal)}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-2 max-w-[200px]">
                          {s.nombreEspacio && (
                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                              <MapPin size={14} className="text-blue-500" />{s.nombreEspacio}
                              {s.espacioDanadoEnDevolucion && (<AlertTriangle size={12} className="text-red-500" />)}
                            </span>
                          )}
                          {!s.nombreEspacio && s.destinoExterno && (
                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-700">
                              <ExternalLink size={14} className="text-orange-500" />
                              Uso externo: {s.destinoExterno}
                            </span>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {s.nombresArticulos && s.nombresArticulos.length > 0 ? (
                              s.nombresArticulos.map((art, i) => (
                                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs font-medium">
                                  <Package size={10} />{art}
                                </span>
                              ))
                            ) : !s.nombreEspacio ? (
                              <span className="text-xs text-slate-400 italic">Sin recursos</span>
                            ) : null}
                          </div>
                          {tieneDanos && (
                            <span className="inline-flex items-center gap-1 text-xs text-red-600 font-bold">
                              <AlertTriangle size={12} />Daños reportados
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-slate-600 max-w-[180px] truncate">{s.proposito || "—"}</td>
                      <td className="p-4"><BadgeEstado estado="FINALIZADA" /></td>
                      <td className="p-4 text-center">
                        <button onClick={() => setSolicitudDetalle(s)} className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer" title="Ver detalle">
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                {solicitudesFinalizadas.length} solicitud{solicitudesFinalizadas.length !== 1 ? "es" : ""} finalizada{solicitudesFinalizadas.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )) : (
          /* ===== TABLA RECHAZADAS ===== */
          solicitudesRechazadas.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-sm">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <XCircle size={32} className="text-red-300" />
            </div>
            <p className="text-slate-500 font-bold text-lg m-0">No hay solicitudes rechazadas</p>
            <p className="text-slate-400 text-sm mt-2 m-0">Las solicitudes rechazadas aparecerán aquí.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-gray-50/50">
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Solicitante</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Horario</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Recursos Solicitados</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Propósito</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Motivo Rechazo</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {solicitudesRechazadas.map((s) => (
                    <tr key={s.idSolicitud} className="hover:bg-red-50/40 transition-colors">
                      <td className="p-4 font-mono text-sm text-slate-500">#{s.idSolicitud}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                            {s.emailUsuario?.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-slate-700 truncate max-w-[180px]">{s.emailUsuario}</span>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-slate-700">
                        <span className="flex items-center gap-1.5"><Calendar size={14} className="text-slate-400" />{s.fecha}</span>
                      </td>
                      <td className="p-4 text-sm text-slate-700">
                        <span className="flex items-center gap-1.5"><Clock size={14} className="text-slate-400" />{formatHora(s.horaInicio)} - {formatHora(s.horaFin)}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1 max-w-[200px]">
                          {s.nombreEspacio && (
                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                              <MapPin size={14} className="text-blue-500" />{s.nombreEspacio}
                            </span>
                          )}
                          {!s.nombreEspacio && s.destinoExterno && (
                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-700">
                              <ExternalLink size={14} className="text-orange-500" />
                              Uso externo: {s.destinoExterno}
                            </span>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {s.nombresArticulos && s.nombresArticulos.length > 0 ? (
                              s.nombresArticulos.map((art, i) => (
                                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs font-medium">
                                  <Package size={10} />{art}
                                </span>
                              ))
                            ) : !s.nombreEspacio ? (
                              <span className="text-xs text-slate-400 italic">Sin recursos</span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-slate-600 max-w-[180px] truncate">{s.proposito || "—"}</td>
                      <td className="p-4 max-w-[220px]">
                        <span className="text-xs text-red-700 font-medium leading-relaxed line-clamp-3" title={s.motivoRechazo || ""}>
                          {s.motivoRechazo || "Sin motivo especificado"}
                        </span>
                      </td>
                      <td className="p-4"><BadgeEstado estado="RECHAZADA" /></td>
                      <td className="p-4 text-center">
                        <button onClick={() => setSolicitudDetalle(s)} className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors cursor-pointer" title="Ver detalle">
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                {solicitudesRechazadas.length} solicitud{solicitudesRechazadas.length !== 1 ? "es" : ""} rechazada{solicitudesRechazadas.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL DE DETALLE */}
      {solicitudDetalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 max-h-[80vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                    <Eye size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 m-0">Detalle de Solicitud #{solicitudDetalle.idSolicitud}</h3>
                    <p className="text-xs text-slate-500 m-0">{solicitudDetalle.emailUsuario}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSolicitudDetalle(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={18} className="text-slate-400" />
                </button>
              </div>

              {/* Información General */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-1">Fecha</p>
                  <p className="text-sm font-semibold text-slate-800 m-0 flex items-center gap-1.5">
                    <Calendar size={14} className="text-slate-400" />
                    {solicitudDetalle.fecha}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-1">Horario Solicitado</p>
                  <p className="text-sm font-semibold text-slate-800 m-0 flex items-center gap-1.5">
                    <Clock size={14} className="text-slate-400" />
                    {formatHora(solicitudDetalle.horaInicio)} - {formatHora(solicitudDetalle.horaFin)}
                  </p>
                </div>
                {solicitudDetalle.estado !== "RECHAZADA" && (
                <div className="bg-emerald-50 rounded-xl p-4">
                  <p className="text-xs text-emerald-600 font-bold uppercase tracking-wide mb-1">Devolución Real</p>
                  <p className="text-sm font-semibold text-emerald-800 m-0 flex items-center gap-1.5">
                    <Clock size={14} className="text-emerald-500" />
                    {formatFechaDevolucion(solicitudDetalle.fechaDevolucionReal)}
                  </p>
                </div>
                )}
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-1">Propósito</p>
                  <p className="text-sm font-semibold text-slate-800 m-0">
                    {solicitudDetalle.proposito || "—"}
                  </p>
                </div>
              </div>

              {/* Motivo de Rechazo (solo para rechazadas) */}
              {solicitudDetalle.estado === "RECHAZADA" && solicitudDetalle.motivoRechazo && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-xs text-red-600 font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <XCircle size={14} />
                    Motivo de Rechazo
                  </p>
                  <p className="text-sm text-red-800 font-medium m-0 leading-relaxed">
                    {solicitudDetalle.motivoRechazo}
                  </p>
                </div>
              )}

              {/* Espacio */}
              {solicitudDetalle.nombreEspacio && (
                <div className="mb-6">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-2">Espacio Utilizado</p>
                  <div className={`rounded-xl p-4 border ${solicitudDetalle.espacioDanadoEnDevolucion ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                    <p className={`text-sm font-bold m-0 flex items-center gap-2 ${solicitudDetalle.espacioDanadoEnDevolucion ? 'text-red-700' : 'text-blue-700'}`}>
                      <MapPin size={16} />
                      {solicitudDetalle.nombreEspacio}
                      {solicitudDetalle.espacioDanadoEnDevolucion && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                          <AlertTriangle size={10} />
                          DAÑADO
                        </span>
                      )}
                    </p>
                    {solicitudDetalle.espacioDanadoEnDevolucion && solicitudDetalle.comentarioDanoEspacio && (
                      <p className="text-xs text-red-600 mt-2 m-0">
                        <strong>Motivo del daño:</strong> {solicitudDetalle.comentarioDanoEspacio}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Uso Externo (si no hay espacio) */}
              <ResumenRecursosCowork recursos={solicitudDetalle.recursosCowork} />
              {!solicitudDetalle.nombreEspacio && solicitudDetalle.destinoExterno && (
                <div className="mb-6">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-2">Uso Externo</p>
                  <div className="rounded-xl p-4 border bg-orange-50 border-orange-200">
                    <p className="text-sm font-bold text-orange-700 m-0 flex items-center gap-2">
                      <ExternalLink size={16} />
                      Destino: {solicitudDetalle.destinoExterno}
                    </p>
                  </div>
                </div>
              )}

              {/* Artículos Físicos Asignados */}
              {solicitudDetalle.articulosAsignados && solicitudDetalle.articulosAsignados.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-2">
                    Artículos Físicos Entregados ({solicitudDetalle.articulosAsignados.length})
                  </p>
                  <div className="flex flex-col gap-2">
                    {solicitudDetalle.articulosAsignados.map((art) => {
                      const artDanados = getArticulosDanados(solicitudDetalle);
                      const estaDanado = artDanados.some(d => d.idArticulo === art.idArticulo);
                      return (
                        <div
                          key={art.idArticulo}
                          className={`rounded-xl p-3 border flex items-center justify-between ${
                            estaDanado ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                              estaDanado ? 'bg-red-100' : 'bg-slate-100'
                            }`}>
                              <Package size={16} className={estaDanado ? 'text-red-500' : 'text-slate-500'} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800 m-0">
                                {art.nombreArticulo}
                                {estaDanado && (
                                  <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold">
                                    <AlertTriangle size={8} />
                                    DAÑADO
                                  </span>
                                )}
                              </p>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                  <Hash size={10} />
                                  ID: {art.idArticulo}
                                </span>
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                  <Tag size={10} />
                                  {art.marca}
                                </span>
                                {art.codigoDuoc && (
                                  <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <Barcode size={10} />
                                    {art.codigoDuoc}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Requerimientos Originales */}
              {solicitudDetalle.requerimientos && solicitudDetalle.requerimientos.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-2">Requerimientos Originales</p>
                  <div className="flex flex-wrap gap-2">
                    {solicitudDetalle.requerimientos.map((req, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium">
                        <Package size={12} />
                        {req.cantidad}x {req.nombreCategoria} ({req.marca})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Info adicional */}
              <div className="flex flex-wrap gap-3 text-xs text-slate-500 pt-2 border-t border-slate-100">
                {solicitudDetalle.cantidadIntegrantes && (
                  <span>👥 {solicitudDetalle.cantidadIntegrantes} integrantes</span>
                )}
                {solicitudDetalle.exclusividad && (
                  <span className="text-amber-600 font-bold">🔒 Exclusividad CITT</span>
                )}
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end border-t border-slate-100">
              <button
                onClick={() => setSolicitudDetalle(null)}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
