import React from "react";
import { useNavigate } from "react-router-dom";
import { 
  Calendar, 
  PackageOpen, 
  ClipboardList,
  MonitorSmartphone,
  GraduationCap
} from "lucide-react";

export const AlumnoDashboard: React.FC = () => {
  const navigate = useNavigate();

  const accesosRapidos = [
    { titulo: "Solicitar Espacios", ruta: "/solicitar-reserva", icono: MonitorSmartphone, color: "text-emerald-600", bg: "bg-emerald-100", desc: "Reservar para estudiar o trabajar" },
    { titulo: "Solicitar Equipamiento", ruta: "/solicitar-prestamo", icono: PackageOpen, color: "text-indigo-600", bg: "bg-indigo-100", desc: "Pedir componentes o herramientas" },
    { titulo: "Mis Solicitudes Activas", ruta: "/solicitudes", icono: ClipboardList, color: "text-amber-600", bg: "bg-amber-100", desc: "Seguimiento de mis peticiones" },
    { titulo: "Calendario de Laboratorios", ruta: "/calendario", icono: Calendar, color: "text-blue-600", bg: "bg-blue-100", desc: "Ver horarios y disponibilidad" },
  ];

  return (
    <div className="space-y-8 animate-fade-in">


      {/* Accesos Rápidos (Alumno) */}
      <div>
        <h3 className="text-lg font-bold text-gray-800 mb-4">¿En qué te podemos ayudar?</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-5 xl:grid-cols-4">
          {accesosRapidos.map((acceso, index) => (
            <button
              key={index}
              onClick={() => navigate(acceso.ruta)}
              className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 text-left shadow-sm transition-all hover:shadow-lg hover:border-gray-200 cursor-pointer group md:flex-col md:gap-4 md:p-8 md:text-center"
            >
              <div className={`size-11 shrink-0 rounded-xl flex items-center justify-center md:size-16 md:rounded-2xl ${acceso.bg}`}>
                <acceso.icono className={`size-6 md:size-8 ${acceso.color}`} aria-hidden="true" />
              </div>
              <div>
                <h4 className="font-bold text-gray-800 text-lg mb-1">{acceso.titulo}</h4>
                <p className="text-sm text-gray-500">{acceso.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
