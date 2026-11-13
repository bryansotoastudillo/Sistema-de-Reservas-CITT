import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Calendar, Clock, MapPin, Package, FileText, Users, CheckCircle, ArrowLeft } from "lucide-react";
import api from "../api/axiosConfig";
import { CatalogoArticulos } from "../componentes/CatalogoArticulos";
import { recursosCowork, type RecursoCowork } from "../componentes/RecursosCowork";

interface RequerimientoDTO {
  idCategoria: number;
  marca: string;
  cantidad: number;
}

interface EspacioDTO {
  id: number;
  nombre: string;
  estado: string;
}

export const FormularioSolicitudPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const rolActivo = localStorage.getItem("activeRole") || "ALUMNO";
  const rolUpper = rolActivo.toUpperCase();
  const canRequestExclusividad = rolUpper.includes("DOCENTE") || rolUpper.includes("DIRECTOR") || rolUpper.includes("COORDINADOR");

  const state = location.state as {
    seleccionesGlobales?: Record<number, Record<string, number>>;
    idEspacio?: number;
    nombreEspacio?: string;
  } | null;

  const [espaciosDisponibles, setEspaciosDisponibles] = useState<EspacioDTO[]>([]);
  const [seleccionesGlobalesLocales, setSeleccionesGlobalesLocales] = useState<Record<number, Record<string, number>>>(state?.seleccionesGlobales || {});
  const [idEspacioLocal, setIdEspacioLocal] = useState<number | null>(state?.idEspacio || null);
  const [isModalArticulosOpen, setIsModalArticulosOpen] = useState(false);
  const [categoriasMap, setCategoriasMap] = useState<Record<number, string>>({});

  React.useEffect(() => {
    // Fetch espacios para el combo box
    const fetchEspacios = async () => {
      try {
        const res = await api.get("/espacios");
        // Filtramos solo los que tienen un problema operativo (DAÑADO o MANTENCION).
        // Los espacios operativos siempre aparecen; la validación de choques horarios la hace el backend.
        const disponibles = Array.isArray(res.data) ? res.data.filter((e: any) => e.estado !== "DAÑADO" && e.estado !== "MANTENCION") : [];
        setEspaciosDisponibles(disponibles);
      } catch (err) {
        console.error("Error cargando espacios", err);
      }
    };
    fetchEspacios();

    const fetchCategorias = async () => {
      try {
        const res = await api.get("/categorias/catalogo-alumnos");
        const map: Record<number, string> = {};
        if (Array.isArray(res.data)) {
          res.data.forEach((c: any) => {
            map[c.idCategoria] = c.nombreCategoria;
          });
        }
        setCategoriasMap(map);
      } catch (err) {
        console.error("Error cargando categorias", err);
      }
    };
    fetchCategorias();
  }, []);

  // Transformar seleccionesGlobales a RequerimientoDTO[]
  const requerimientos: RequerimientoDTO[] = [];
  Object.entries(seleccionesGlobalesLocales).forEach(([idCat, marcas]) => {
    Object.entries(marcas).forEach(([marca, cantidad]) => {
      requerimientos.push({
        idCategoria: Number(idCat),
        marca,
        cantidad
      });
    });
  });

  const isSoloArticulos = requerimientos.length > 0 && !idEspacioLocal;
  const isSoloEspacio = requerimientos.length === 0 && !!idEspacioLocal;
  const isMixta = requerimientos.length > 0 && !!idEspacioLocal;

  const [fecha, setFecha] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [proposito, setProposito] = useState("");
  const [cantidadIntegrantes, setCantidadIntegrantes] = useState<number | "">("");
  const [exclusividad, setExclusividad] = useState(false);
  const [usoExterno, setUsoExterno] = useState(false);
  const [destinoExterno, setDestinoExterno] = useState("");
  const [seleccionCowork, setSeleccionCowork] = useState<RecursoCowork[]>([]);
  const nombreEspacio = espaciosDisponibles.find((espacio) => espacio.id === idEspacioLocal)?.nombre
    ?? (idEspacioLocal != null && idEspacioLocal === state?.idEspacio ? state.nombreEspacio : "");
  const esCowork = /^(?:(?:area|espacio)\s+)?cowork$/i.test(
    (nombreEspacio ?? "").normalize("NFD").replace(/\p{M}/gu, "").trim(),
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsj, setErrorMsj] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState({
    fecha: "",
    horaInicio: "",
    horaFin: "",
    proposito: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsj("");
    setSuccessMsg("");
    setFieldErrors({ fecha: "", horaInicio: "", horaFin: "", proposito: "" });

    let hasErrors = false;
    const newErrors = { fecha: "", horaInicio: "", horaFin: "", proposito: "" };

    if (!fecha) { newErrors.fecha = "Este campo es requerido"; hasErrors = true; }
    if (!horaInicio) { newErrors.horaInicio = "Este campo es requerido"; hasErrors = true; }
    if (!horaFin) { newErrors.horaFin = "Este campo es requerido"; hasErrors = true; }
    if (!proposito) { newErrors.proposito = "Este campo es requerido"; hasErrors = true; }

    if (hasErrors) {
      setFieldErrors(newErrors);
      setErrorMsj("Por favor, completa todos los campos obligatorios.");
      return;
    }

    if (horaInicio < "08:00" || horaFin > "22:00") {
      setErrorMsj("El horario de reservas es estrictamente entre las 08:00 y las 22:00 horas.");
      return;
    }

    // Validar duración mínima de 15 minutos
    if (horaInicio && horaFin) {
      const [hi, mi] = horaInicio.split(":").map(Number);
      const [hf, mf] = horaFin.split(":").map(Number);
      const diffMinutos = (hf * 60 + mf) - (hi * 60 + mi);
      if (diffMinutos < 15) {
        setErrorMsj("El mínimo de tiempo de uso de una solicitud es de 15 minutos.");
        return;
      }
    }

    if (!idEspacioLocal && requerimientos.length === 0) {
      setErrorMsj("Debes seleccionar al menos un espacio o un artículo antes de crear la solicitud.");
      return;
    }

    // Si hay artículos pero no espacio, debe ser uso externo con destino
    if (!idEspacioLocal && requerimientos.length > 0) {
      if (!usoExterno) {
        setErrorMsj("Si no seleccionas un espacio, debes marcar 'Uso externo' para indicar dónde llevarás los artículos.");
        return;
      }
      if (!destinoExterno.trim()) {
        setErrorMsj("Debes indicar el destino al que llevarás los artículos.");
        return;
      }
    }

    // El backend espera formato "HH:mm:ss", pero los input time devuelven "HH:mm"
    const horaInicioFmt = horaInicio.length === 5 ? `${horaInicio}:00` : horaInicio;
    const horaFinFmt = horaFin.length === 5 ? `${horaFin}:00` : horaFin;

    try {
      setIsSubmitting(true);
      await api.post("/solicitudes", {
        fecha,
        horaInicio: horaInicioFmt,
        horaFin: horaFinFmt,
        proposito,
        idEspacio: idEspacioLocal || null,
        cantidadIntegrantes: cantidadIntegrantes ? Number(cantidadIntegrantes) : null,
        exclusividad: exclusividad,
        requerimientos: requerimientos.length > 0 ? requerimientos : [],
        destinoExterno: usoExterno ? destinoExterno.trim() : null,
        recursosCowork: esCowork ? seleccionCowork : [],
      });

      // Muestra mensaje de éxito y espera antes de redirigir
      setSuccessMsg("Solicitud creada exitosamente");
      setTimeout(() => {
        navigate("/solicitudes");
      }, 1500);

    } catch (error: any) {
      console.error(error);
      setErrorMsj(error.response?.data?.mensaje || "Ocurrió un error al procesar la solicitud.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-colors cursor-pointer"
          title="Volver"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Crear Solicitud</h1>
          <p className="text-sm text-gray-500">
            {isSoloEspacio ? "Reserva de Espacio" : isSoloArticulos ? "Préstamo de Artículos" : isMixta ? "Reserva Mixta (Espacio + Artículos)" : "Nueva Solicitud"}
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 w-full mx-auto animate-in fade-in duration-500">

        {/* LADO IZQUIERDO: FORMULARIO */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-lg font-bold text-[#021626] flex items-center gap-2">
              <FileText size={20} className="text-blue-600" />
              Detalles de la Solicitud
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-6" noValidate>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Calendar size={16} className="text-blue-500" /> Fecha
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={e => { setFecha(e.target.value); setFieldErrors(p => ({ ...p, fecha: "" })); }}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 transition-all text-gray-700 outline-none ${fieldErrors.fecha ? 'border-red-500 focus:ring-red-500/20' : 'border-gray-200 focus:ring-blue-500/20 focus:border-blue-500'}`}
                />
                {fieldErrors.fecha && <span className="text-red-500 text-xs font-medium">{fieldErrors.fecha}</span>}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Users size={16} className="text-blue-500" /> N° Integrantes (Opcional)
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="Ej: 3"
                  value={cantidadIntegrantes}
                  onChange={e => setCantidadIntegrantes(e.target.value ? Number(e.target.value) : "")}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Clock size={16} className="text-blue-500" /> Hora Inicio
                </label>
                <input
                  type="time"
                  min="08:00"
                  max="22:00"
                  value={horaInicio}
                  onChange={e => { setHoraInicio(e.target.value); setFieldErrors(p => ({ ...p, horaInicio: "" })); }}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 transition-all text-gray-700 outline-none ${fieldErrors.horaInicio ? 'border-red-500 focus:ring-red-500/20' : 'border-gray-200 focus:ring-blue-500/20 focus:border-blue-500'}`}
                />
                {fieldErrors.horaInicio && <span className="text-red-500 text-xs font-medium">{fieldErrors.horaInicio}</span>}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Clock size={16} className="text-blue-500" /> Hora Fin
                </label>
                <input
                  type="time"
                  min="08:00"
                  max="22:00"
                  value={horaFin}
                  onChange={e => { setHoraFin(e.target.value); setFieldErrors(p => ({ ...p, horaFin: "" })); }}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 transition-all text-gray-700 outline-none ${fieldErrors.horaFin ? 'border-red-500 focus:ring-red-500/20' : 'border-gray-200 focus:ring-blue-500/20 focus:border-blue-500'}`}
                />
                {fieldErrors.horaFin && <span className="text-red-500 text-xs font-medium">{fieldErrors.horaFin}</span>}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <MapPin size={16} className="text-blue-500" /> Espacio Físico (Opcional)
              </label>
              <select
                value={idEspacioLocal || ""}
                onChange={e => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  setIdEspacioLocal(val);
                  setSeleccionCowork([]);
                  if (val) {
                    setUsoExterno(false);
                    setDestinoExterno("");
                  }
                }}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700 outline-none bg-white cursor-pointer"
              >
                <option value="">Sin espacio seleccionado (Solo préstamo)</option>
                {espaciosDisponibles.map(esp => (
                  <option key={esp.id} value={esp.id}>{esp.id === state?.idEspacio ? state.nombreEspacio || esp.nombre : esp.nombre}</option>
                ))}
                {/* Si venía un espacio preseleccionado pero no está en la lista de disponibles, forzamos mostrarlo */}
                {idEspacioLocal && !espaciosDisponibles.some(e => e.id === idEspacioLocal) && state?.nombreEspacio && (
                  <option value={idEspacioLocal}>{state.nombreEspacio} (Seleccionado previamente)</option>
                )}
              </select>
            </div>

            {esCowork && (
              <fieldset className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <legend className="px-1 text-sm font-bold text-slate-800">Recursos audiovisuales del cowork</legend>
                <p className="mb-3 text-sm text-slate-600">Marca los recursos que necesitas. Todas las opciones son opcionales.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(Object.keys(recursosCowork) as RecursoCowork[]).map((recurso) => (
                    <label key={recurso} className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                      <input type="checkbox" className="size-4 accent-blue-700"
                        checked={seleccionCowork.includes(recurso)}
                        onChange={(event) => {
                          const marcado = event.target.checked;
                          setSeleccionCowork((previa) => marcado
                            ? [...previa, recurso] : previa.filter((valor) => valor !== recurso));
                        }}
                      />
                      {recursosCowork[recurso]}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {/* USO EXTERNO — Solo visible si hay artículos, no hay espacio y no se pidió exclusividad */}
            {!idEspacioLocal && !exclusividad && requerimientos.length > 0 && (
              <div className="flex flex-col gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={usoExterno}
                    onChange={(e) => {
                      setUsoExterno(e.target.checked);
                      if (!e.target.checked) setDestinoExterno("");
                    }}
                    className="w-5 h-5 rounded border-orange-300 text-orange-600 focus:ring-orange-200"
                  />
                  <span className="text-sm font-bold text-orange-900">
                    Uso externo (sacar artículos fuera del CITT)
                    <span className="block text-xs font-normal text-orange-700 mt-0.5">
                      Marca esta opción si necesitas llevar los equipos a otro lugar fuera de la sala CITT.
                    </span>
                  </span>
                </label>
                {usoExterno && (
                  <input
                    type="text"
                    value={destinoExterno}
                    onChange={(e) => setDestinoExterno(e.target.value)}
                    placeholder="¿Hacia dónde llevarás los artículos? (Ej: Sala A-301, Laboratorio X...)"
                    className="w-full px-4 py-3 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-gray-700 outline-none"
                  />
                )}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-700">Propósito de la solicitud</label>
              <textarea
                rows={4}
                value={proposito}
                onChange={e => { setProposito(e.target.value); setFieldErrors(p => ({ ...p, proposito: "" })); }}
                placeholder="Indica brevemente para qué necesitas los recursos (Ej: Trabajo de título, proyecto personal, clase práctica...)"
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 transition-all text-gray-700 outline-none resize-none ${fieldErrors.proposito ? 'border-red-500 focus:ring-red-500/20' : 'border-gray-200 focus:ring-blue-500/20 focus:border-blue-500'}`}
              />
              {fieldErrors.proposito && <span className="text-red-500 text-xs font-medium">{fieldErrors.proposito}</span>}
            </div>

            {canRequestExclusividad && (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <input
                  type="checkbox"
                  id="exclusividad"
                  checked={exclusividad}
                  onChange={(e) => setExclusividad(e.target.checked)}
                  className="w-5 h-5 rounded border-amber-300 text-amber-600 focus:ring-amber-200"
                />
                <label htmlFor="exclusividad" className="text-sm font-bold text-amber-900 cursor-pointer select-none">
                  Solicitar exclusividad del CITT
                  <span className="block text-xs font-normal text-amber-700 mt-0.5">Al marcar esta opción, reservarás todos los espacios del CITT en este horario (requiere seleccionar un espacio principal).</span>
                </label>
              </div>
            )}

            {errorMsj && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
                {errorMsj}
              </div>
            )}

            {successMsg && (
              <div className="p-4 bg-green-50 text-green-700 rounded-xl text-sm font-medium border border-green-100 flex items-center gap-2">
                <CheckCircle size={18} />
                {successMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-4 rounded-xl font-bold text-white shadow-md flex justify-center items-center gap-2 transition-all cursor-pointer ${isSubmitting ? "bg-blue-400" : "bg-[#003B5C] hover:bg-blue-800"}`}
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <CheckCircle size={20} />
                  Confirmar Solicitud
                </>
              )}
            </button>

          </form>
        </div>

        {/* LADO DERECHO: RESUMEN DE RECURSOS */}
        <div className="w-full lg:w-[350px] flex flex-col gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-6">
            <div className="p-6 bg-[#021626] text-white">
              <h3 className="font-bold text-lg">Resumen de Recursos</h3>
              <p className="text-blue-300 text-xs mt-1">Lo que estás solicitando</p>
            </div>

            <div className="p-6 flex flex-col gap-6">

              {exclusividad ? (
                <div className="flex flex-col gap-3">
                  <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider">Espacios Físicos (Exclusividad)</h4>
                  <div className="flex flex-col gap-2">
                    {espaciosDisponibles.map(esp => (
                      <div key={esp.id} className="flex items-center gap-3 p-2 bg-amber-50/50 rounded-xl border border-amber-200">
                        <div className="p-1.5 bg-amber-100 rounded-lg text-amber-600">
                          <MapPin size={16} />
                        </div>
                        <span className="font-bold text-sm text-amber-900">{esp.nombre}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : idEspacioLocal && (
                <div className="flex flex-col gap-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Espacio Físico</h4>
                  <div className="flex items-center gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                      <MapPin size={20} />
                    </div>
                    <span className="font-bold text-gray-700">
                      {(idEspacioLocal === state?.idEspacio && state.nombreEspacio)
                        || espaciosDisponibles.find(esp => esp.id === idEspacioLocal)?.nombre || "Espacio seleccionado"}
                    </span>
                  </div>
                </div>
              )}

              {requerimientos.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Artículos ({requerimientos.reduce((acc, curr) => acc + curr.cantidad, 0)})</h4>
                  <div className="flex flex-col gap-3">
                    {Object.entries(seleccionesGlobalesLocales).map(([idCatStr, marcas]) => {
                      const idCat = Number(idCatStr);
                      const entries = Object.entries(marcas);
                      if (entries.length === 0) return null;
                      const catName = categoriasMap[idCat] || `Categoría ${idCat}`;

                      return (
                        <div key={idCat} className="flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wide">
                            {catName}
                          </div>
                          <div className="flex flex-col">
                            {entries.map(([marca, cantidad], index) => (
                              <div key={marca} className={`flex justify-between items-center p-3 ${index !== entries.length - 1 ? 'border-b border-slate-100' : ''}`}>
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                  <Package size={16} className="text-slate-400" />
                                  {marca}
                                </div>
                                <span className="bg-blue-50 px-2 py-1 rounded text-xs font-bold text-blue-700 border border-blue-100">
                                  x{cantidad}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!exclusividad && !idEspacioLocal && requerimientos.length === 0 && (
                <div className="p-4 text-center text-gray-400 text-sm italic">
                  No hay recursos seleccionados
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsModalArticulosOpen(true)}
                className="mt-2 w-full py-2.5 rounded-xl text-sm font-bold border border-[#003B5C] text-[#003B5C] hover:bg-blue-50 transition-colors flex justify-center items-center gap-2 cursor-pointer"
              >
                <Package size={16} />
                Añadir / Editar Artículos
              </button>

            </div>
          </div>
        </div>

      </div>

      {/* MODAL CATÁLOGO ARTÍCULOS */}
      {isModalArticulosOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-[#021626] text-white">
              <h3 className="text-xl font-bold m-0 flex items-center gap-2">
                <Package size={24} />
                Seleccionar Artículos
              </h3>
              <button
                onClick={() => setIsModalArticulosOpen(false)}
                className="text-gray-300 hover:text-white transition-colors cursor-pointer"
              >
                ✕ Cerrar
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
              <CatalogoArticulos
                isEmbedded={true}
                initialSelecciones={seleccionesGlobalesLocales}
                onConfirmSelection={(selecciones) => {
                  setSeleccionesGlobalesLocales(selecciones);
                  setIsModalArticulosOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
