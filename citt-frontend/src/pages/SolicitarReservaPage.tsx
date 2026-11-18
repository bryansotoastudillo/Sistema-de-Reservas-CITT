import React from "react";
import { useSeguridad } from "../hooks/useSeguridad"; 
import { Info, DoorOpen, Briefcase, Users } from "lucide-react";
import { useOcupacionEspacios } from "../hooks/useOcupacionEspacios";
import { VistaOcupacionCitt } from "../componentes/planoCitt/VistaOcupacionCitt";
import BarraOcupacion from "../componentes/BarraOcupacion";

import { Link, useNavigate } from "react-router-dom";
import { puedeRegularizarReserva } from "./RegularizarReservaPage";

export const SolicitarReservaPage: React.FC = () => {
  const { isVerificando } = useSeguridad(); 
  const navigate = useNavigate();
  
  const rolActivo = localStorage.getItem("activeRole") || "ALUMNO";
  const rolUpper = rolActivo.toUpperCase();
  
  let rolUser: "PROFESOR" | "AYUDANTE" | "ALUMNO" = "ALUMNO";
  if (rolUpper.includes("PROFESOR") || rolUpper.includes("DOCENTE")) rolUser = "PROFESOR";
  else if (rolUpper.includes("AYUDANTE")) rolUser = "AYUDANTE";
  
  const { consulta, actualizar } = useOcupacionEspacios(!isVerificando);
  const espacios = typeof consulta === "object" ? consulta.espacios : [];
  const isLoading = consulta === "cargando";

  const renderEstadoLocal = (estado: string, enUsoAhora: boolean) => {
    const est = estado ? estado.toUpperCase() : "DESCONOCIDO";
    if (est === "DISPONIBLE") {
      if (enUsoAhora) {
        return <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-bold border border-amber-200">Ocupado</span>;
      }
      return <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200">🟢 Disponible</span>;
    }
    if (est === "MANTENCION") {
      return <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-bold border border-amber-200">🟡 En Mantención</span>;
    }
    if (est === "DAÑADO") {
      return <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-bold border border-red-200">🔴 Dañado</span>;
    }
    return <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold border border-gray-200">⚪ {estado}</span>;
  };

  const titulosPorRol = {
    PROFESOR: "Portal Docente - Espacios CITT",
    AYUDANTE: "Portal Ayudante - Espacios CITT",
    ALUMNO: "Espacios Disponibles CITT"
  };

  const subtitulosPorRol = {
    PROFESOR: "Visualiza los laboratorios operativos y gestiona las solicitudes de reserva para tus clases o proyectos.",
    AYUDANTE: "Revisa los laboratorios operativos y gestiona las solicitudes de reserva para tus ayudantías o talleres.",
    ALUMNO: "Visualiza los laboratorios operativos de la sede y gestiona tus solicitudes de reserva."
  };

  if (isVerificando) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#003b73]"></div>
      </div>
    );
  }

  return (
    <>

      <div className="flex flex-col gap-6 animate-in fade-in duration-500">


        <section aria-labelledby="ocupacion-actual-titulo" className="min-w-0 space-y-3">
          <div>
            <h2 id="ocupacion-actual-titulo" className="text-lg font-bold text-slate-800">Ocupación actual de los espacios</h2>
            <p className="text-sm text-slate-600">Consulta qué espacios están libres u ocupados ahora. Los estados se actualizan cada 30 segundos.</p>
            <Link to="/calendario" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#003b73] underline">
              Consultar horarios reservados
            </Link>
          </div>
          <VistaOcupacionCitt consulta={consulta} actualizar={actualizar} permitirEdicion={false} />
        </section>

        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-2">
          Detalle de Equipamiento
        </h3>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#003b73]"></div>
          </div>
        ) : consulta === "error" ? (
          <p role="alert" className="rounded-xl bg-white p-4 text-sm text-slate-700">No se pudo consultar la ocupación de los espacios.</p>
        ) : espacios.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 shadow-sm border border-gray-100 text-center">
            <Info size={44} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium text-lg">No hay espacios físicos registrados en este momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {espacios.map((espacio) => {
              const estadoUpper = espacio.estado?.toUpperCase() || "";
              const esOperativo = estadoUpper !== "DAÑADO" && estadoUpper !== "MANTENCION";
              const enUsoAhora = espacio.enUsoAhora || false; 
              
              return (
                <div 
                  key={espacio.id} 
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all flex flex-col h-full relative overflow-hidden"
                >
                  {!esOperativo && (
                    <div className="absolute inset-0 bg-gray-50/40 z-0 pointer-events-none"></div>
                  )}

                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                          Sala de Innovación
                        </span>
                        <h3 className="text-xl font-bold text-[#021626]">{espacio.nombre}</h3>
                      </div>
                      {renderEstadoLocal(espacio.estado, enUsoAhora)}
                    </div>

                    <div className="flex flex-col gap-3 mb-6 flex-grow mt-2">
                      <div className="flex items-center gap-3 text-gray-600">
                        <Users size={18} className="text-blue-600" />
                        <span className="text-sm">Capacidad: {espacio.capacidad} personas</span>
                      </div>
                      
                      <div className="flex items-start gap-3 text-gray-600">
                        <Briefcase size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
                        <span className="text-sm line-clamp-2">
                          {(() => {
                            if (!espacio.comentarios) return "Sin descripción de equipamiento.";
                            if (rolUser === "ALUMNO" && espacio.comentarios.toUpperCase().includes("DAÑADO")) {
                              return "El espacio se encuentra actualmente con daños en su equipamiento.";
                            }
                            return espacio.comentarios;
                          })()}
                        </span>
                      </div>
                    </div>

                    <BarraOcupacion 
                      enUsoAhora={enUsoAhora}
                      esDisponible={esOperativo}
                      onReservarClick={() => navigate("/crear-solicitud", { state: { idEspacio: espacio.id, nombreEspacio: espacio.nombre } })}
                    />
                    {puedeRegularizarReserva(rolActivo) && (
                      <Link to={`/regularizar-reserva?espacio=${espacio.id}`}
                        className="mt-2 rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-semibold text-[#003b73] hover:bg-slate-50">
                        Regularizar uso
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};
