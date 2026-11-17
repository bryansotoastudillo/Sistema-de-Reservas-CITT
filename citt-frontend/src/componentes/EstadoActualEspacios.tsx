import { CheckCircle2, CircleDot, XCircle } from "lucide-react";
import type { Espacio } from "../hooks/useOcupacionEspacios";

interface Props {
  espacios: Espacio[];
}

const EstadoActualEspacios = ({ espacios }: Props) => {
  return (
    <div className="w-full">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
        Estado Actual de Espacios
      </h3>
      
      {/* Contenedor con scroll horizontal en caso de que sean muchos laboratorios */}
      <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
        {espacios.map((e) => {
          const estado = e.estado?.toUpperCase();
          const ocupado = estado === "DISPONIBLE" && e.enUsoAhora;
          const libre = estado === "DISPONIBLE" && e.enUsoAhora === false;
          const Icono = libre ? CheckCircle2 : ocupado ? CircleDot : XCircle;
          const color = libre ? "text-green-700" : ocupado ? "text-amber-700" : "text-red-600";
          const borde = libre ? "border-b-green-500" : ocupado ? "border-b-amber-500" : "border-b-red-500";
          const etiqueta = libre ? "LIBRE" : ocupado ? "OCUPADO" : estado === "DAÑADO" ? "DAÑADO"
            : estado === "MANTENCION" ? "EN MANTENCIÓN" : "SIN DATOS";

          return (
            <div 
              key={e.id} 
              className={`min-w-[160px] flex-1 bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-3 border-b-[6px] ${borde}`}
            >
              <Icono className={color} size={26} aria-hidden="true" />
              
              <div className="text-center">
                <p className={`font-bold text-lg ${color}`}>
                  {e.nombre}
                </p>
                <p className={`mt-1 text-xs font-bold tracking-wide ${color}`}>{etiqueta}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EstadoActualEspacios;
