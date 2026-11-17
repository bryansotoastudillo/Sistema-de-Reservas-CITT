import React, { useEffect, useState } from "react";
import { Search, PackageOpen, RefreshCw, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosConfig";
import CategoriaAccordion from "./CategoriaAccordion";
import type { CategoriaCatalogo } from "./CategoriaAccordion";

export interface CatalogoArticulosProps {
  initialSelecciones?: Record<number, Record<string, number>>;
  onConfirmSelection?: (selecciones: Record<number, Record<string, number>>) => void;
  isEmbedded?: boolean;
}

export const CatalogoArticulos: React.FC<CatalogoArticulosProps> = ({
  initialSelecciones = {},
  onConfirmSelection,
  isEmbedded = false
}) => {
  const navigate = useNavigate();
  const [categorias, setCategorias] = useState<CategoriaCatalogo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filtro, setFiltro] = useState("");

  // ESTADO MAESTRO DE SELECCIONES (El "Carrito")
  // Estructura: { idCategoria: { marca: cantidad } }
  const [seleccionesGlobales, setSeleccionesGlobales] = useState<
    Record<number, Record<string, number>>
  >(initialSelecciones);

  const fetchCatalogo = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/categorias/catalogo-alumnos");
      setCategorias(response.data);
    } catch (error) {
      console.error("Error cargando el catálogo de artículos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Carga de datos desde el nuevo endpoint de Swagger
  useEffect(() => {
    fetchCatalogo();
  }, []);

  // Función para inyectar al acordeón y centralizar el estado
  const actualizarSeleccion = (
    idCategoria: number,
    marca: string,
    cantidad: number,
  ) => {
    setSeleccionesGlobales((prev) => {
      const categoriaActual = { ...(prev[idCategoria] || {}) };

      if (cantidad <= 0) {
        delete categoriaActual[marca]; // Limpia la memoria si vuelve a 0
      } else {
        categoriaActual[marca] = cantidad;
      }

      return {
        ...prev,
        [idCategoria]: categoriaActual,
      };
    });
  };

  const calcularTotalSeleccionados = () => {
    let total = 0;
    Object.values(seleccionesGlobales).forEach((categoriaSeleccion) => {
      Object.values(categoriaSeleccion).forEach((cantidad) => {
        total += cantidad;
      });
    });
    return total;
  };

  const totalItems = calcularTotalSeleccionados();

  if (isLoading && categorias.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Filtrado simple por nombre de categoría
  const categoriasFiltradas = categorias.filter((cat) =>
    cat.nombreCategoria.toLowerCase().includes(filtro.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">


      {/* 2. BARRA DE BÚSQUEDA Y REFRESCO */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center p-2">
          <div className="pl-4 text-slate-400">
            <Search size={20} />
          </div>
          <input
            type="text"
            placeholder="Todas las categorías..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="w-full pl-4 pr-4 py-2 border-none outline-none font-medium text-slate-700 bg-transparent"
          />
        </div>
        <button
          onClick={fetchCatalogo}
          className="p-3 border border-slate-300 rounded-xl hover:text-blue-600 hover:border-blue-300 cursor-pointer bg-white transition-colors shadow-sm"
          title="Actualizar catálogo"
        >
          <RefreshCw className={`w-5 h-5 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
        </button>
      </div>

      {/* 3. LISTADO DE ACORDEONES */}
      <div className="flex flex-col">
        {categoriasFiltradas.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-sm">
            <p className="text-slate-500 font-bold text-lg">
              No se encontraron artículos disponibles en este momento.
            </p>
          </div>
        ) : (
          categoriasFiltradas.map((cat) => (
            <CategoriaAccordion
              key={cat.idCategoria}
              categoria={cat}
              selecciones={seleccionesGlobales[cat.idCategoria] || {}}
              onActualizarSeleccion={(marca, cantidad) =>
                actualizarSeleccion(cat.idCategoria, marca, cantidad)
              }
            />
          ))
        )}
      </div>

      {/* 4. BARRA FLOTANTE DE SELECCIÓN */}
      {(totalItems > 0 || isEmbedded) && (
        <div className={`${isEmbedded ? 'sticky bottom-0 rounded-b-xl' : 'fixed inset-x-0 bottom-[var(--barra-citt,0px)] lg:bottom-0 lg:left-64'} bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] p-3 sm:px-6 md:px-10 flex flex-col md:flex-row justify-between items-center gap-2 sm:gap-4 z-40 animate-in slide-in-from-bottom-full duration-300`}>
          <div className="flex items-center gap-3 text-slate-700 font-bold">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
              <ShoppingCart size={20} />
            </div>
            <div>
              <p className="m-0 text-lg leading-tight">{totalItems} artículo{totalItems !== 1 ? "s" : ""} seleccionado{totalItems !== 1 ? "s" : ""}</p>
              <p className="m-0 text-xs text-slate-500 font-medium">Listos para solicitar préstamo</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (isEmbedded && onConfirmSelection) {
                onConfirmSelection(seleccionesGlobales);
              } else {
                navigate("/crear-solicitud", { state: { seleccionesGlobales } });
              }
            }}
            className="w-full md:w-auto px-8 py-3 bg-[#003B5C] hover:bg-blue-800 text-white rounded-xl font-bold transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            {isEmbedded ? "Confirmar Artículos" : "Solicitar Préstamo"}
          </button>
        </div>
      )}
    </div>
  );
};
