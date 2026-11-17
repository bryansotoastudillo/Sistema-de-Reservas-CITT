import { useState, useEffect, useMemo } from "react";
import { MapPin, Clock, Quote } from "lucide-react";

// Colores pastel y bordes según el rol
const ESTILOS_POR_ROL: Record<string, { bg: string; border: string; iconText: string; innerBg: string; innerBorder: string }> = {
  ALUMNO:       { bg: "bg-purple-50", border: "border-purple-200 border-l-purple-600", iconText: "text-purple-600", innerBg: "bg-purple-100/70", innerBorder: "border-purple-200" },
  AYUDANTE:     { bg: "bg-green-50", border: "border-green-200 border-l-green-600", iconText: "text-green-600", innerBg: "bg-green-100/70", innerBorder: "border-green-200" },
  DOCENTE:      { bg: "bg-blue-50", border: "border-blue-200 border-l-blue-600", iconText: "text-blue-600", innerBg: "bg-blue-100/70", innerBorder: "border-blue-200" },
  COORDINADOR:  { bg: "bg-orange-50", border: "border-orange-200 border-l-orange-500", iconText: "text-orange-600", innerBg: "bg-orange-100/70", innerBorder: "border-orange-200" },
  DIRECTOR:     { bg: "bg-orange-50", border: "border-orange-200 border-l-orange-500", iconText: "text-orange-600", innerBg: "bg-orange-100/70", innerBorder: "border-orange-200" },
};

// Color por defecto si falla el rol
const ESTILO_DEFAULT = { bg: "bg-slate-50", border: "border-slate-200 border-l-slate-600", iconText: "text-slate-600", innerBg: "bg-slate-100/70", innerBorder: "border-slate-200" };

interface HeaderBannerProps {
  pantallaActual: string;
  descripcion?: string;
}

export const HeaderBanner: React.FC<HeaderBannerProps> = ({ pantallaActual, descripcion }) => {
  const [horaActual, setHoraActual] = useState(new Date());

  // Obtenemos el rol del localStorage para pintar el fondo
  const rolActivo = localStorage.getItem("activeRole") || "";
  const estilo = ESTILOS_POR_ROL[rolActivo] || ESTILO_DEFAULT;

  // Actualizar el reloj cada segundo
  useEffect(() => {
    const intervalo = setInterval(() => {
      setHoraActual(new Date());
    }, 1000);
    return () => clearInterval(intervalo);
  }, []);

  // Funciones para darle formato a la hora y fecha
  const formatearHora = (fecha: Date) => {
    return fecha.toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatearFecha = (fecha: Date) => {
    return fecha.toLocaleDateString("es-CL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className={`${estilo.bg} border ${estilo.border} border-l-[6px] px-4 py-3 sm:px-6 sm:py-5 rounded-2xl shadow-sm mb-4 sm:mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in zoom-in-95 duration-300`}>
      <div className="flex items-start gap-4 flex-1 pr-4">
        <div className="flex flex-col justify-center">
          <h1 className="text-xl font-extrabold text-slate-800 tracking-tight m-0 leading-tight">
            {pantallaActual}
          </h1>
          {descripcion && (
            <p className="text-sm font-medium text-slate-600 mt-1 m-0 leading-snug">
              {descripcion}
            </p>
          )}
        </div>
      </div>
      
      {/* Reloj y Fecha compactos centrados */}
      <div className={`hidden sm:flex items-center justify-center shrink-0 ${estilo.innerBg} px-6 py-2.5 rounded-xl border ${estilo.innerBorder} shadow-sm backdrop-blur-sm min-w-[160px]`}>
        <div className="text-center">
          <div className="text-base font-bold text-slate-700 tabular-nums leading-none mb-1">
            {formatearHora(horaActual)}
          </div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 leading-none">
            {formatearFecha(horaActual)}
          </div>
        </div>
      </div>
    </div>
  );
};
