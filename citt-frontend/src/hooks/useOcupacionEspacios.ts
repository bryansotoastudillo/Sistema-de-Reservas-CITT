import { useEffect, useState } from "react";
import api from "../api/axiosConfig";

export type Espacio = {
  id: number;
  nombre: string;
  comentarios: string;
  estado: string;
  capacidad: number;
  enUsoAhora: boolean;
};

export type ConsultaEspacios = "cargando" | "error" | { espacios: Espacio[]; actualizado: Date };

export function useOcupacionEspacios(habilitado: boolean) {
  const [consulta, setConsulta] = useState<ConsultaEspacios>("cargando");
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!habilitado) return;

    const controller = new AbortController();
    let consultando = false;
    async function cargar() {
      if (consultando || document.hidden) return;
      consultando = true;
      try {
        const { data } = await api.get<Espacio[]>("/espacios", { signal: controller.signal, timeout: 10000 });
        if (!Array.isArray(data)) throw new Error("Respuesta de espacios inválida");
        if (!controller.signal.aborted) setConsulta({ espacios: data, actualizado: new Date() });
      } catch {
        if (!controller.signal.aborted) setConsulta("error");
      } finally {
        consultando = false;
      }
    }

    void cargar();
    const intervalo = window.setInterval(cargar, 30000);
    document.addEventListener("visibilitychange", cargar);
    return () => {
      controller.abort();
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", cargar);
    };
  }, [habilitado, intento]);

  return { consulta, actualizar: () => setIntento((valor) => valor + 1) };
}
