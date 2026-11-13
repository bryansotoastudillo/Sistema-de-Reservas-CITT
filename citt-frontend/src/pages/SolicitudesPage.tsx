import React, { useEffect, useState } from "react";
import { ResumenRecursosCowork, type RecursoCowork } from "../componentes/RecursosCowork";
import {
  FileText,
  ClipboardList,
  Package,
  User,
  Calendar,
  Clock,
  ArrowDownToLine,
  Undo2,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  MapPin,
  Shield,
  ExternalLink,
} from "lucide-react";

import api from "../api/axiosConfig";
import BadgeEstado from "../componentes/BadgeEstado";
import { ModalConfirmacion } from "../componentes/ModalConfirmacion";

interface RequerimientoDTO {
  idCategoria: number;
  nombreCategoria: string;
  marca: string;
  cantidad: number;
}

interface ArticuloAsignadoDTO {
  idArticulo: number;
  nombreArticulo: string;
  codigoDuoc: string;
  marca: string;
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
  requerimientos?: RequerimientoDTO[];
  articulosAsignados?: ArticuloAsignadoDTO[];
  registroAutogestion?: string;
  destinoExterno?: string;
  recursosCowork?: RecursoCowork[];
}

interface ArticuloDTO {
  idArticulo: number;
  nombreArticulo: string;
  marca: string;
  idCategoria: number;
  nombreEstado: string;
}

const ESTADOS_ACTIVOS = ["PENDIENTE", "APROBADA", "EN PROCESO", "ATRASADO"];

export const SolicitudesPage: React.FC = () => {
  const rolActivo = localStorage.getItem("activeRole") || "";
  const currentUserEmail = localStorage.getItem("userEmail") || "";
  const isStaff = ["AYUDANTE", "DOCENTE", "COORDINADOR", "DIRECTOR"].includes(
    rolActivo.toUpperCase()
  );
  const esAltaDireccion = ["COORDINADOR", "DIRECTOR"].includes(
    rolActivo.toUpperCase()
  );

  const [misSolicitudes, setMisSolicitudes] = useState<SolicitudDTO[]>([]);
  const [todasSolicitudes, setTodasSolicitudes] = useState<SolicitudDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [vistaActiva, setVistaActiva] = useState<"mias" | "todas">(isStaff ? "todas" : "mias");
  const [filtro, setFiltro] = useState("");

  // Modal states
  const [modalDevolver, setModalDevolver] = useState(false);
  const [modalEntregar, setModalEntregar] = useState(false);
  const [idsFisicos, setIdsFisicos] = useState("");
  const [idsSeleccionadosList, setIdsSeleccionadosList] = useState<number[]>([]);
  const [articulosInventario, setArticulosInventario] = useState<ArticuloDTO[]>([]);
  const [modalRechazar, setModalRechazar] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  
  // Estados para Devolución
  const [espacioDanado, setEspacioDanado] = useState(false);
  const [comentarioEspacio, setComentarioEspacio] = useState("");
  const [articulosDanados, setArticulosDanados] = useState<{ idArticulo: number; comentario: string }[]>([]);

  const [solicitudSeleccionada, setSolicitudSeleccionada] =
    useState<SolicitudDTO | null>(null);

  // Feedback
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Estados para Auditoría (autogestion)
  const [modalAuditoria, setModalAuditoria] = useState(false);
  const [auditoriaSeleccionada, setAuditoriaSeleccionada] = useState("");

  // Feature 5: Doble confirmación visual para aceptar
  const [confirmarAprobacionId, setConfirmarAprobacionId] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const misRes = await api.get("/solicitudes/mis-solicitudes");
      setMisSolicitudes(misRes.data);

      if (isStaff) {
        const todasRes = await api.get("/solicitudes");
        setTodasSolicitudes(todasRes.data);
      }
    } catch (error) {
      console.error("Error al cargar solicitudes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const cargarInventario = async () => {
    try {
      const res = await api.get("/articulos?size=1000");
      setArticulosInventario(res.data.content);
    } catch (error) {
      console.error("Error al cargar inventario", error);
    }
  };

  useEffect(() => {
    if (modalEntregar) {
      cargarInventario();
    }
  }, [modalEntregar]);

  const handleCheckboxChange = (id: number) => {
    setIdsSeleccionadosList((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleArticuloDanadoChange = (idArticulo: number, isDamaged: boolean) => {
    if (isDamaged) {
      setArticulosDanados(prev => [...prev, { idArticulo, comentario: "" }]);
    } else {
      setArticulosDanados(prev => prev.filter(a => a.idArticulo !== idArticulo));
    }
  };

  const handleArticuloComentarioChange = (idArticulo: number, comentario: string) => {
    setArticulosDanados(prev => prev.map(a => a.idArticulo === idArticulo ? { ...a, comentario } : a));
  };

  // Filtrar solo activas para "Mis Solicitudes" del alumno y staff
  const misSolicitudesFiltradas = misSolicitudes
    .filter((s) => ESTADOS_ACTIVOS.includes(s.estado))
    .filter(
      (s) =>
        s.proposito?.toLowerCase().includes(filtro.toLowerCase()) ||
        (s.nombreEspacio && s.nombreEspacio.toLowerCase().includes(filtro.toLowerCase())) ||
        s.nombresArticulos?.some((a) =>
          a.toLowerCase().includes(filtro.toLowerCase())
        )
    );

  // Filtrar todas las activas para la gestión del staff
  const todasFiltradas = todasSolicitudes
    .filter((s) => ESTADOS_ACTIVOS.includes(s.estado))
    .filter(
      (s) =>
        s.emailUsuario?.toLowerCase().includes(filtro.toLowerCase()) ||
        s.proposito?.toLowerCase().includes(filtro.toLowerCase()) ||
        (s.nombreEspacio && s.nombreEspacio.toLowerCase().includes(filtro.toLowerCase())) ||
        s.nombresArticulos?.some((a) =>
          a.toLowerCase().includes(filtro.toLowerCase())
        )
    );

  const handleEntregar = async () => {
    if (!solicitudSeleccionada) return;
    
    // Parsear el string de IDs separados por coma
    const idsManuales = idsFisicos
      .split(",")
      .map((id) => parseInt(id.trim()))
      .filter((id) => !isNaN(id));

    // Combinar IDs manuales con los seleccionados por checkbox (evitando duplicados)
    const idsCombined = Array.from(new Set([...idsManuales, ...idsSeleccionadosList]));

    try {
      await api.patch(
        `/solicitudes/${solicitudSeleccionada.idSolicitud}/entregar`,
        idsCombined
      );
      setSuccessMsg("Artículos entregados exitosamente.");
      setTimeout(() => setSuccessMsg(""), 3000);
      setModalEntregar(false);
      setIdsFisicos("");
      setIdsSeleccionadosList([]);
      fetchData();
    } catch (error: any) {
      setErrorMsg(
        error.response?.data?.mensaje || "Error al entregar artículos."
      );
      setTimeout(() => setErrorMsg(""), 4000);
    }
  };

  const handleDevolver = async () => {
    if (!solicitudSeleccionada) return;
    try {
      await api.patch(
        `/solicitudes/${solicitudSeleccionada.idSolicitud}/devolver`,
        {
          articulosDanados,
          espacioDanado,
          comentarioEspacio: espacioDanado ? comentarioEspacio : null
        }
      );
      setSuccessMsg("Devolución registrada exitosamente.");
      setTimeout(() => setSuccessMsg(""), 3000);
      setModalDevolver(false);
      setEspacioDanado(false);
      setComentarioEspacio("");
      setArticulosDanados([]);
      setSolicitudSeleccionada(null);
      fetchData();
    } catch (error: any) {
      setErrorMsg(
        error.response?.data?.mensaje || "Error al registrar la devolución."
      );
      setTimeout(() => setErrorMsg(""), 4000);
    }
  };

  const handleCambiarEstado = async (idEstado: number, motivo?: string, solicitudDirecta?: SolicitudDTO) => {
    const solicitud = solicitudDirecta || solicitudSeleccionada;
    if (!solicitud) return;
    try {
      await api.patch(`/solicitudes/${solicitud.idSolicitud}/estado`, {
        idEstadoSolicitud: idEstado,
        motivo: motivo || ""
      });
      setSuccessMsg(idEstado === 2 ? "Solicitud aprobada exitosamente." : "Solicitud rechazada exitosamente.");
      setTimeout(() => setSuccessMsg(""), 3000);
      setModalRechazar(false);
      setMotivoRechazo("");
      setSolicitudSeleccionada(null);
      fetchData();
    } catch (error: any) {
      setErrorMsg(error.response?.data?.mensaje || "Error al cambiar el estado de la solicitud.");
      setTimeout(() => setErrorMsg(""), 4000);
    }
  };

  const formatHora = (hora: string) => {
    if (!hora) return "";
    return hora.substring(0, 5);
  };

  const solicitudesAMostrar =
    vistaActiva === "mias" ? misSolicitudesFiltradas : todasFiltradas;

  return (
    <>

      <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">


        {/* MENSAJES DE FEEDBACK */}
        {successMsg && (
          <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm flex items-center gap-2 animate-in fade-in duration-300">
            <CheckCircle size={18} className="shrink-0" />
            <p className="m-0 font-medium">{successMsg}</p>
          </div>
        )}
        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2 animate-in fade-in duration-300">
            <AlertCircle size={18} className="shrink-0" />
            <p className="m-0 font-medium">{errorMsg}</p>
          </div>
        )}

        {/* TABS PARA STAFF */}
        {isStaff && (
          <div className="flex gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm w-max">
            <button
              onClick={() => setVistaActiva("todas")}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 cursor-pointer ${
                vistaActiva === "todas"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              }`}
            >
              <span className="flex items-center gap-2">
                <FileText size={16} />
                Todas las Solicitudes
              </span>
            </button>
            <button
              onClick={() => setVistaActiva("mias")}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 cursor-pointer ${
                vistaActiva === "mias"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              }`}
            >
              <span className="flex items-center gap-2">
                <User size={16} />
                Mis Solicitudes
              </span>
            </button>
          </div>
        )}

        {/* BARRA DE BÚSQUEDA + REFRESH */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center p-2">
            <div className="pl-4 text-slate-400">
              <Search size={20} />
            </div>
            <input
              type="text"
              placeholder={
                vistaActiva === "todas"
                  ? "Buscar por email, propósito, espacio o artículo..."
                  : "Buscar por propósito, espacio o artículo..."
              }
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="w-full pl-4 pr-4 py-2 border-none outline-none font-medium text-slate-700 bg-transparent"
            />
          </div>
          <button
            onClick={fetchData}
            className="p-3 border border-slate-300 rounded-xl hover:text-blue-600 hover:border-blue-300 cursor-pointer bg-white transition-colors shadow-sm"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* TABLA */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : solicitudesAMostrar.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-sm">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ClipboardList size={32} className="text-slate-400" />
            </div>
            <p className="text-slate-500 font-bold text-lg m-0">
              No hay solicitudes activas
            </p>
            <p className="text-slate-400 text-sm mt-2 m-0">
              {vistaActiva === "mias"
                ? "No tienes solicitudes pendientes o en proceso."
                : "No hay solicitudes activas en el sistema."}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-gray-50/50">
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    {vistaActiva === "todas" && (
                      <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Solicitante
                      </th>
                    )}
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Horario
                    </th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Recursos
                    </th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Propósito
                    </th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    {isStaff && vistaActiva === "todas" && (
                      <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                        Acciones
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {solicitudesAMostrar.map((s) => (
                    <tr
                      key={s.idSolicitud}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="p-4 font-mono text-sm text-slate-500">
                        #{s.idSolicitud}
                      </td>
                      {vistaActiva === "todas" && (
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                              {s.emailUsuario?.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-slate-700 truncate max-w-[180px]">
                              {s.emailUsuario}
                            </span>
                          </div>
                        </td>
                      )}
                      <td className="p-4 text-sm text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <Calendar size={14} className="text-slate-400" />
                          {s.fecha}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <Clock size={14} className="text-slate-400" />
                          {formatHora(s.horaInicio)} - {formatHora(s.horaFin)}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-2 max-w-[200px]">
                          {s.nombreEspacio && (
                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                              <MapPin size={14} className="text-blue-500" />
                              {s.nombreEspacio}
                            </span>
                          )}
                          {!s.nombreEspacio && s.destinoExterno && (
                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-700">
                              <ExternalLink size={14} className="text-orange-500" />
                              Uso externo: {s.destinoExterno}
                            </span>
                          )}
                          <ResumenRecursosCowork recursos={s.recursosCowork} />
                          <div className="flex flex-wrap gap-1">
                            {s.nombresArticulos && s.nombresArticulos.length > 0 ? (
                              s.nombresArticulos.map((art, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs font-medium"
                                >
                                  <Package size={10} />
                                  {art}
                                </span>
                              ))
                            ) : !s.nombreEspacio ? (
                              <span className="text-xs text-slate-400 italic">
                                Sin recursos
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-slate-600 max-w-[180px] truncate">
                        {s.proposito || "—"}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1.5">
                          <div>
                            <BadgeEstado
                              estado={
                                s.estado as
                                  | "PENDIENTE"
                                  | "APROBADA"
                                  | "EN PROCESO"
                                  | "RECHAZADA"
                                  | "FINALIZADA"
                                  | "ATRASADO"
                                  | "DISPONIBLE"
                                  | "PRESTADO"
                                  | "DAÑADO"
                                  | "MANTENCION"
                              }
                            />
                            {s.registroAutogestion && (
                              <div 
                                className="mt-1.5 flex items-center text-[11px] text-[#307FE2] font-medium tracking-wide group cursor-pointer transition-all" 
                                title="Haz clic para ver detalles"
                                onClick={() => {
                                  setAuditoriaSeleccionada(s.registroAutogestion!);
                                  setModalAuditoria(true);
                                }}
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-[#307FE2] mr-1.5 shadow-[0_0_4px_rgba(48,127,226,0.5)] animate-pulse"></div>
                                <span className="opacity-80 group-hover:opacity-100 transition-opacity underline decoration-dotted underline-offset-2">Auto-gestionado</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      {isStaff && vistaActiva === "todas" && (
                        <td className="p-4">
                          {!esAltaDireccion && (s.emailUsuario?.toLowerCase() === currentUserEmail.toLowerCase() || s.nombreEspacio) ? (
                            <div className="flex items-center justify-center text-xs text-slate-400 font-medium">
                              <span className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md">
                                <AlertCircle size={12} />
                                {s.emailUsuario?.toLowerCase() === currentUserEmail.toLowerCase() ? "Requiere gestión de terceros" : "Solo gestión de artículos"}
                              </span>
                            </div>
                          ) : (
                            <div className="flex justify-center gap-2">
                            {s.estado === "APROBADA" && (
                              <button
                                onClick={() => {
                                  setSolicitudSeleccionada(s);
                                  setModalEntregar(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100 hover:border-blue-300 transition-all cursor-pointer"
                              >
                                <ArrowDownToLine size={14} />
                                Entregar
                              </button>
                            )}
                            {(s.estado === "EN PROCESO" || s.estado === "ATRASADO") && (
                              <button
                                onClick={() => {
                                  setSolicitudSeleccionada(s);
                                  setModalDevolver(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100 hover:border-emerald-300 transition-all cursor-pointer"
                              >
                                <Undo2 size={14} />
                                Devolver
                              </button>
                            )}
                            {s.estado === "PENDIENTE" && (
                                <div className="flex gap-2">
                                  {(() => {
                                    const isConfirmando = confirmarAprobacionId === s.idSolicitud;
                                    return (
                                      <button
                                        onClick={() => {
                                          if (isConfirmando) {
                                            handleCambiarEstado(2, undefined, s);
                                            setConfirmarAprobacionId(null);
                                          } else {
                                            setConfirmarAprobacionId(s.idSolicitud);
                                            setTimeout(() => setConfirmarAprobacionId(null), 3000);
                                          }
                                        }}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                          isConfirmando
                                            ? 'bg-green-600 text-white shadow-md scale-105 ring-2 ring-green-300'
                                            : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 hover:border-green-300'
                                        }`}
                                      >
                                        <CheckCircle size={14} />
                                        {isConfirmando ? "¿Confirmar?" : "Aceptar"}
                                      </button>
                                    );
                                  })()}
                                  <button
                                    onClick={() => {
                                      setSolicitudSeleccionada(s);
                                      setModalRechazar(true);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100 hover:border-red-300 transition-all cursor-pointer"
                                  >
                                    <AlertCircle size={14} />
                                    Rechazar
                                  </button>
                                </div>
                            )}
                          </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* CONTADOR */}
            <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                {solicitudesAMostrar.length} solicitud
                {solicitudesAMostrar.length !== 1 ? "es" : ""} activa
                {solicitudesAMostrar.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* MODAL ENTREGAR */}
      {modalEntregar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                  <ArrowDownToLine size={20} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 m-0">Confirmar Entrega</h3>
              </div>
              <p className="text-slate-600 text-sm mb-4">
                Por favor, ingresa los IDs de los artículos físicos que estás entregando (separados por coma) para la solicitud <strong>#{solicitudSeleccionada?.idSolicitud}</strong>.
              </p>
              
              {solicitudSeleccionada && (() => {
                const d = new Date();
                d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                const localDateStr = d.toISOString().split('T')[0];
                if (solicitudSeleccionada.fecha !== localDateStr) {
                  return (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2 animate-in fade-in">
                      <AlertCircle size={18} className="shrink-0 mt-0.5" />
                      <p className="m-0 font-medium">
                        Solo se pueden retirar los equipos el día agendado para la reserva: {solicitudSeleccionada.fecha}
                      </p>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Sección de Selección por Inventario */}
              {solicitudSeleccionada?.requerimientos && solicitudSeleccionada.requerimientos.length > 0 && (
                <div className="mb-4">
                  <strong className="block mb-2 text-sm text-gray-800">Seleccionar desde Inventario:</strong>
                  <div className="max-h-60 overflow-y-auto pr-2 flex flex-col gap-3">
                    {solicitudSeleccionada.requerimientos.map((req, idx) => {
                      // Filtrar inventario por categoria, marca y disponible
                      const disponibles = articulosInventario.filter(a => 
                        a.idCategoria === req.idCategoria && 
                        a.marca.toLowerCase() === req.marca.toLowerCase() && 
                        a.nombreEstado === "DISPONIBLE"
                      );
                      
                      return (
                        <div key={idx} className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                          <p className="text-sm font-bold text-slate-700 mb-2">
                            {req.cantidad}x {req.nombreCategoria} ({req.marca})
                          </p>
                          {disponibles.length === 0 ? (
                            <p className="text-xs text-red-500 italic">No hay stock disponible para este requerimiento.</p>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {disponibles.map(art => (
                                <label key={art.idArticulo} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer p-1.5 hover:bg-slate-100 rounded">
                                  <input 
                                    type="checkbox" 
                                    className="rounded border-slate-300"
                                    checked={idsSeleccionadosList.includes(art.idArticulo)}
                                    onChange={() => handleCheckboxChange(art.idArticulo)}
                                  />
                                  <span>#{art.idArticulo} - {art.nombreArticulo}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sección de Entrada Manual */}
              <div className="mb-2">
                <strong className="block mb-1 text-sm text-gray-800">Entrada Manual (IDs opcionales):</strong>
                <input
                  type="text"
                  value={idsFisicos}
                  onChange={(e) => setIdsFisicos(e.target.value)}
                  placeholder="Ej: 1, 4, 7 (Si usas lector de código)"
                  className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm"
                />
              </div>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
              <button
                onClick={() => {
                  setModalEntregar(false);
                  setIdsFisicos("");
                  setIdsSeleccionadosList([]);
                  setSolicitudSeleccionada(null);
                }}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleEntregar}
                disabled={
                  (() => {
                    const d = new Date();
                    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                    const localDateStr = d.toISOString().split('T')[0];
                    const wrongDate = solicitudSeleccionada?.fecha !== localDateStr;
                    const noItems = idsSeleccionadosList.length === 0 && !idsFisicos.trim() && (solicitudSeleccionada?.requerimientos?.length || 0) > 0;
                    return wrongDate || noItems;
                  })()
                }
                className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                Confirmar Entrega
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DEVOLVER */}
      {modalDevolver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                  <Undo2 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 m-0">Confirmar Devolución</h3>
                  <p className="text-xs text-slate-500 m-0">Solicitud #{solicitudSeleccionada?.idSolicitud}</p>
                </div>
              </div>
              <p className="text-slate-600 text-sm mb-6">
                Por favor, verifica el estado en que se está entregando el espacio y los recursos físicos. Marca si hay algún daño y añade los detalles.
              </p>

              {/* Daño en el Espacio */}
              {solicitudSeleccionada?.nombreEspacio && (
                <div className="mb-6 border border-slate-200 rounded-xl p-4 bg-slate-50">
                  <div className="flex items-center justify-between mb-2">
                    <strong className="text-sm text-slate-800 flex items-center gap-2">
                      <MapPin size={16} className="text-blue-500"/>
                      {solicitudSeleccionada.nombreEspacio}
                    </strong>
                    <label className="flex items-center gap-2 text-sm text-red-600 cursor-pointer font-medium bg-red-50 px-2 py-1 rounded">
                      <input 
                        type="checkbox"
                        checked={espacioDanado}
                        onChange={(e) => setEspacioDanado(e.target.checked)}
                        className="rounded border-red-300 text-red-600 focus:ring-red-200"
                      />
                      Espacio Dañado
                    </label>
                  </div>
                  {espacioDanado && (
                    <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                      <textarea
                        value={comentarioEspacio}
                        onChange={(e) => setComentarioEspacio(e.target.value)}
                        placeholder="Detalla los daños encontrados en el espacio..."
                        className="w-full p-3 border border-red-200 rounded-xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 text-sm bg-white"
                        rows={2}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Daño en Artículos Físicos */}
              {solicitudSeleccionada?.articulosAsignados && solicitudSeleccionada.articulosAsignados.length > 0 && (
                <div>
                  <strong className="block mb-3 text-sm text-gray-800">Equipos Asignados:</strong>
                  <div className="flex flex-col gap-3">
                    {solicitudSeleccionada.articulosAsignados.map(art => {
                      const isDamaged = articulosDanados.some(a => a.idArticulo === art.idArticulo);
                      const currentComentario = articulosDanados.find(a => a.idArticulo === art.idArticulo)?.comentario || "";
                      
                      return (
                        <div key={art.idArticulo} className={`border rounded-xl p-3 transition-colors ${isDamaged ? 'border-red-200 bg-red-50/30' : 'border-slate-200 bg-white'}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold text-slate-700 m-0">{art.nombreArticulo} ({art.marca})</p>
                              <p className="text-xs text-slate-500 m-0">ID: #{art.idArticulo} | Cód: {art.codigoDuoc || 'N/A'}</p>
                            </div>
                            <label className="flex items-center gap-2 text-sm text-red-600 cursor-pointer font-medium hover:bg-red-50 px-2 py-1 rounded transition-colors">
                              <input 
                                type="checkbox"
                                checked={isDamaged}
                                onChange={(e) => handleArticuloDanadoChange(art.idArticulo, e.target.checked)}
                                className="rounded border-slate-300 text-red-600 focus:ring-red-200"
                              />
                              Reportar Daño
                            </label>
                          </div>
                          {isDamaged && (
                            <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                              <textarea
                                value={currentComentario}
                                onChange={(e) => handleArticuloComentarioChange(art.idArticulo, e.target.value)}
                                placeholder={`Detalla los daños para el artículo ${art.nombreArticulo}...`}
                                className="w-full p-2 border border-red-200 rounded-lg outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 text-sm bg-white"
                                rows={2}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {(!solicitudSeleccionada?.nombreEspacio && (!solicitudSeleccionada?.articulosAsignados || solicitudSeleccionada.articulosAsignados.length === 0)) && (
                <p className="text-sm text-slate-500 italic text-center py-4">Esta solicitud no tiene recursos asignados para evaluar.</p>
              )}
            </div>
            
            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
              <button
                onClick={() => {
                  setModalDevolver(false);
                  setEspacioDanado(false);
                  setComentarioEspacio("");
                  setArticulosDanados([]);
                  setSolicitudSeleccionada(null);
                }}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDevolver}
                disabled={
                  (espacioDanado && !comentarioEspacio.trim()) || 
                  articulosDanados.some(a => !a.comentario.trim())
                }
                className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                Confirmar Devolución
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RECHAZAR */}
      {modalRechazar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                  <AlertCircle size={20} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 m-0">Rechazar Solicitud</h3>
              </div>
              <p className="text-slate-600 text-sm mb-4">
                Por favor, ingresa el motivo del rechazo para la solicitud <strong>#{solicitudSeleccionada?.idSolicitud}</strong>. Esto es obligatorio.
              </p>
              <textarea
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                placeholder="Ej: El espacio no está disponible en esa fecha..."
                className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 resize-none min-h-[100px] text-sm"
              />
            </div>
            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
              <button
                onClick={() => {
                  setModalRechazar(false);
                  setMotivoRechazo("");
                  setSolicitudSeleccionada(null);
                }}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleCambiarEstado(4, motivoRechazo)} // ID 4 = RECHAZADA
                disabled={!motivoRechazo.trim()}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AUTOGESTION */}
      {modalAuditoria && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#307FE2]/10 flex items-center justify-center text-[#307FE2] shrink-0">
                  <Shield size={20} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 m-0">Registro de Auditoría</h3>
              </div>
              <div className="bg-[#307FE2]/5 p-4 rounded-xl text-[#307FE2] text-sm border border-[#307FE2]/20 shadow-inner font-medium">
                Auto-gestionado por: <span className="font-bold">{auditoriaSeleccionada.match(/\(([^)]+)\)/)?.[1] || "Administrador"}</span>
              </div>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex justify-end border-t border-slate-100">
              <button
                onClick={() => setModalAuditoria(false)}
                className="px-5 py-2 text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-sm transition-colors cursor-pointer w-full sm:w-auto"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
