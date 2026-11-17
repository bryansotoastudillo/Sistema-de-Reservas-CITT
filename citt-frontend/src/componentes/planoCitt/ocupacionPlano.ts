import { zonasCitt } from "./geometriaCitt";
import type { EstadoPlano } from "./estadosPlano";

type Ocupacion = { nombre: string; estado: string; enUsoAhora: boolean; clavePlano?: string | null };

export function normalizar(nombre: string) {
  return nombre.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().replace(/\s+/g, " ").toLowerCase();
}

function estadoDe(espacio?: Ocupacion): EstadoPlano {
  if (!espacio?.estado) return "sinDatos";
  if (normalizar(espacio.estado) !== "disponible") return "fuera";
  if (typeof espacio.enUsoAhora !== "boolean") return "sinDatos";
  return espacio.enUsoAhora ? "ocupado" : "libre";
}

export function asociarOcupacion<Espacio extends Ocupacion>(espacios: Espacio[]) {
  return zonasCitt.map((zona) => {
    const nombres = [zona.nombre, zona.alias ?? zona.nombre, ...(zona.otrosNombres ?? [])].map(normalizar);
    const vinculados = espacios.filter(espacio => espacio.clavePlano === zona.clave);
    const coincidencias = vinculados.length ? vinculados : espacios.filter(
      espacio => espacio.clavePlano === undefined && nombres.includes(normalizar(espacio.nombre)),
    );
    const espacio = coincidencias.length === 1 ? coincidencias[0] : undefined;
    const nombre = espacio && !nombres.includes(normalizar(espacio.nombre)) ? espacio.nombre : zona.nombre;
    return { ...zona, nombre, espacio, estado: estadoDe(espacio) };
  });
}
