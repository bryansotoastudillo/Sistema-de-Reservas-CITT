import { rolesGestionCitt } from "../utils/roles";
import React, { useEffect, useState } from "react";
import api from "../api/axiosConfig";

import { RefreshCw } from "lucide-react";
import InputBusqueda from "../componentes/InputBusqueda";
import SelectForm from "../componentes/SelectForm";
import Paginador from "../componentes/Paginador";
import { AccionesArticulos } from "../componentes/AccionesArticulos";
import { TablaArticulosGestion } from "../componentes/TablaArticulosGestion";
import { CatalogoArticulos } from "../componentes/CatalogoArticulos";
import { TablaArticulosLectura } from "../componentes/TablaArticulosLectura";

export const ArticulosPage: React.FC = () => {
  // 1. Buscamos el rol que el usuario seleccionó explícitamente en el Login
  const rolActivo = localStorage.getItem("activeRole") || "";
  const rolesRaw = localStorage.getItem("userRoles");
  const userRoles: string[] = rolesRaw ? JSON.parse(rolesRaw) : [];

  // 2. Evaluador de acceso: Prioriza el 'rolActivo'. Si no existe (fallback), usa el array global.
  const verificarAcceso = (rolesPermitidos: string[]) => {
    const rolUpper = rolActivo.toUpperCase();
    if (rolUpper) return rolesPermitidos.includes(rolUpper);
    return userRoles.some((r) => rolesPermitidos.includes(r.toUpperCase()));
  };

  const isAdminArea = verificarAcceso(["ADMIN", ...rolesGestionCitt]);
  const isAyudante = verificarAcceso(["AYUDANTE"]);
  const isAlumno = verificarAcceso(["ALUMNO", "DOCENTE"]);

  // 3. MUTUA EXCLUSIÓN: Forzamos matemáticamente a que solo una vista pueda ser True
  const mostrarVistaAdmin = isAdminArea;
  const mostrarVistaAyudante = false; // Ayudante ya no ve la tabla de lectura
  const mostrarVistaCatalogo = !isAdminArea;

  const [articulos, setArticulos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroCategoriaId, setFiltroCategoriaId] = useState("");
  const [mostrarEliminados, setMostrarEliminados] = useState(false);

  const fetchCategorias = async () => {
    try {
      const response = await api.get("/categorias/todas");
      setCategorias(response.data);
    } catch (error) {
      console.error("Error al cargar categorías", error);
    }
  };

  const fetchArticulos = async (page = 0) => {
    // Si la vista activa es el catálogo, evitamos la petición inútil a la tabla
    if (mostrarVistaCatalogo) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await api.get("/articulos", {
        params: {
          page,
          size: 10,
          nombre: filtroNombre || undefined,
          idCategoria: filtroCategoriaId || undefined,
          mostrarEliminados: mostrarEliminados,
        },
      });
      setArticulos(response.data.content || response.data);
      setTotalPages(response.data.totalPages || 0);
      setCurrentPage(page);
    } catch (error) {
      console.error("Error al cargar artículos", error);
    } finally {
      setLoading(false);
    }
  };

  const refrescarDatos = () => {
    fetchArticulos(currentPage);
    fetchCategorias();
  };

  useEffect(() => {
    if (!mostrarVistaCatalogo) fetchCategorias();
  }, [mostrarVistaCatalogo]);

  useEffect(() => {
    fetchArticulos(currentPage);
  }, [currentPage, filtroNombre, filtroCategoriaId, mostrarEliminados]);

  return (
    <>

      {/* HEADER DE FILTROS OCULTO PARA EL CATÁLOGO */}
      {!mostrarVistaCatalogo && (
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Izquierda: Buscador y Filtro */}
            <div className="flex-1 w-full flex flex-col md:flex-row items-center gap-4">
              <div className="flex-1 w-full max-w-md">
                <InputBusqueda
                  placeholder="Buscar por nombre o marca..."
                  value={filtroNombre}
                  onChange={(e) => setFiltroNombre(e.target.value)}
                />
              </div>
              <div className="w-full md:w-64">
                <SelectForm
                  label=""
                  value={filtroCategoriaId}
                  onChange={(e) => setFiltroCategoriaId(e.target.value)}
                  opciones={[
                    { valor: "", texto: "Todas las Categorías" },
                    ...categorias.map((c) => ({
                      valor: c.idCategoria.toString(),
                      texto: c.nombreCategoria,
                    })),
                  ]}
                />
              </div>
            </div>

            {/* Derecha: Botones de acción */}
            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <button
                onClick={refrescarDatos}
                className="p-2 border border-slate-300 rounded-lg hover:text-blue-600 cursor-pointer bg-white transition-colors"
                title="Actualizar Inventario"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              {mostrarVistaAdmin && (
                <AccionesArticulos
                  onActualizar={refrescarDatos}
                  categorias={categorias}
                />
              )}
            </div>
          </div>

          {/* Fila inferior: Checkbox */}
          <div className="flex items-center">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer w-max hover:text-blue-600 transition-colors">
              <input
                type="checkbox"
                checked={mostrarEliminados}
                onChange={(e) => setMostrarEliminados(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              Mostrar artículos dados de baja
            </label>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* RENDERIZADO ESTRICTAMENTE EXCLUYENTE */}
          {mostrarVistaAdmin && (
            <TablaArticulosGestion
              articulos={articulos}
              onActualizar={refrescarDatos}
              categorias={categorias}
            />
          )}

          {mostrarVistaAyudante && (
            <TablaArticulosLectura articulos={articulos} />
          )}

          {mostrarVistaCatalogo && <CatalogoArticulos />}

          {/* PAGINADOR OCULTO PARA CATÁLOGO */}
          {!mostrarVistaCatalogo && totalPages > 0 && (
            <div className="mt-6">
              <Paginador
                paginaActual={currentPage}
                totalPaginas={totalPages}
                onCambiarPagina={setCurrentPage}
              />
            </div>
          )}
        </>
      )}
    </>
  );
};
