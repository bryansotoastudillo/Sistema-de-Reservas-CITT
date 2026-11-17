import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  Laptop,
  Smartphone,
  Printer,
  Monitor,
} from "lucide-react";

export interface MarcaDesglose {
  marca: string;
  cantidad: number;
}

export interface CategoriaCatalogo {
  idCategoria: number;
  nombreCategoria: string;
  totalCategoria: number;
  desgloseMarcas: MarcaDesglose[];
}

interface CategoriaAccordionProps {
  categoria: CategoriaCatalogo;
  selecciones: Record<string, number>;
  onActualizarSeleccion: (marca: string, cantidad: number) => void;
}

interface AnimatedBrandItemProps {
  item: MarcaDesglose;
  idx: number;
  selecciones: Record<string, number>;
  onActualizarSeleccion: (marca: string, cantidad: number) => void;
}

// Subcomponente que maneja su propia animación de altura muy suave (grid-template-rows)
const AnimatedBrandItem: React.FC<AnimatedBrandItemProps> = ({
  item,
  idx,
  selecciones,
  onActualizarSeleccion,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Escalonamos la aparición: 50ms base + 150ms de diferencia entre cada uno
    const t = setTimeout(() => setMounted(true), 50 + idx * 150);
    return () => clearTimeout(t);
  }, [idx]);

  const cantidadSeleccionada = selecciones[item.marca] || 0;
  const isSelected = cantidadSeleccionada > 0;

  const handleIncrementar = (marca: string, stockMaximo: number) => {
    if (cantidadSeleccionada < stockMaximo) {
      onActualizarSeleccion(marca, cantidadSeleccionada + 1);
    }
  };

  const handleDecrementar = (marca: string) => {
    if (cantidadSeleccionada <= 1) {
      onActualizarSeleccion(marca, 0);
    } else {
      onActualizarSeleccion(marca, cantidadSeleccionada - 1);
    }
  };

  return (
    <div
      className="grid transition-all duration-500 ease-in-out"
      style={{
        gridTemplateRows: mounted ? "1fr" : "0fr",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(-10px)",
      }}
    >
      <div className="overflow-hidden">
        <div
          className={`relative mb-3 flex flex-col gap-3 rounded-xl p-3 transition-colors md:flex-row md:items-center md:justify-between md:p-4 ${
            isSelected
              ? "border-2 border-blue-600 bg-white shadow-sm"
              : "border border-slate-200 bg-white hover:border-blue-300"
          }`}
        >
          {/* Línea horizontal conectora del árbol */}
          <div className="absolute -left-6 top-1/2 hidden w-6 -translate-y-1/2 border-t-2 border-slate-200 md:block" />

          {/* Lado Izquierdo: Nombre de Marca */}
          <div className="flex-1">
            <h4 className="m-0 text-base font-bold leading-tight text-slate-800 [overflow-wrap:anywhere] md:text-lg">
              {item.marca}
            </h4>
          </div>

          {/* Lado Derecho: Controles interactivos */}
          <div className="flex flex-wrap items-center justify-between gap-2 md:justify-end md:gap-4">
            {isSelected && (
              <div className="flex h-11 items-center overflow-hidden rounded-lg border border-blue-100 bg-blue-50 shadow-sm">
                <button
                  type="button"
                  aria-label={`Aumentar cantidad de ${item.marca}`}
                  onClick={() => handleIncrementar(item.marca, item.cantidad)}
                  disabled={cantidadSeleccionada >= item.cantidad}
                  className="h-full min-w-11 text-blue-600 hover:bg-blue-100 font-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  +
                </button>
                <div aria-live="polite" className="flex h-full min-w-9 items-center justify-center border-x border-blue-100 bg-white px-2 font-bold text-slate-800">
                  {cantidadSeleccionada}
                </div>
                <button
                  type="button"
                  aria-label={`Reducir cantidad de ${item.marca}`}
                  onClick={() => handleDecrementar(item.marca)}
                  className="h-full min-w-11 text-blue-600 hover:bg-blue-100 font-black transition-colors"
                >
                  -
                </button>
              </div>
            )}

            <span className="text-sm font-medium text-slate-600 md:text-right">
              {item.cantidad} disponibles
            </span>

            {/* Botón de Acción Final */}
            {!isSelected && (
                <button
                  type="button"
                  onClick={() => {
                    onActualizarSeleccion(item.marca, 1);
                  }}
                  className="min-h-11 whitespace-nowrap rounded-lg bg-[#007bff] px-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 md:px-6"
                >
                  Seleccionar
                </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const CategoriaAccordion: React.FC<CategoriaAccordionProps> = ({
  categoria,
  selecciones,
  onActualizarSeleccion,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const renderIcon = () => {
    const nombre = categoria.nombreCategoria.toLowerCase();
    if (nombre.includes("tablet") || nombre.includes("celular"))
      return <Smartphone size={20} />;
    if (nombre.includes("impresora")) return <Printer size={20} />;
    if (nombre.includes("monitor")) return <Monitor size={20} />;
    return <Laptop size={20} />;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden transition-all mb-4">
      <button
        type="button"
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-2 p-3 text-left transition-colors hover:bg-slate-50 sm:p-5"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="flex min-w-0 items-center gap-2 sm:gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm" aria-hidden="true">
            {renderIcon()}
          </span>
          <span className="break-words font-bold text-slate-800 sm:text-lg">
            {categoria.nombreCategoria}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-2 sm:gap-5">
          <span className="text-xs font-medium text-slate-600 sm:text-sm">
            {categoria.totalCategoria} disponibles
          </span>
          <span className="flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500" aria-hidden="true">
            {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </span>
        </span>
      </button>
      {isOpen && (
        <div className="px-3 pb-4 pt-2 sm:px-6 sm:pb-6">
          <div className="relative pt-1 md:ml-5 md:border-l-2 md:border-slate-200 md:pl-6">
            {categoria.desgloseMarcas.map((item, idx) => (
              <AnimatedBrandItem
                key={item.marca}
                item={item}
                idx={idx}
                selecciones={selecciones}
                onActualizarSeleccion={onActualizarSeleccion}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoriaAccordion;
