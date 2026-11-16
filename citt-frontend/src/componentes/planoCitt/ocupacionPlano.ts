import { zonasCitt } from "./geometriaCitt";
import type { EstadoPlano } from "./estadosPlano";

type Ocupacion = { nombre: string; estado: string; enUsoAhora: boolean };

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
    const coincidencias = espacios.filter(espacio => nombres.includes(normalizar(espacio.nombre)));
    const espacio = coincidencias.length === 1 ? coincidencias[0] : undefined;
    return { ...zona, espacio, estado: estadoDe(espacio) };
  });
}
