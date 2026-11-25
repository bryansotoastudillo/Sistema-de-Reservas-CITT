import { useCallback, useRef, useState } from "react";
import type { PosicionesPlano } from "./geometriaCitt";

type Historial = { actual: PosicionesPlano | null; anteriores: PosicionesPlano[]; siguientes: PosicionesPlano[]; pendiente: boolean };
const vacio = (): Historial => ({ actual: null, anteriores: [], siguientes: [], pendiente: false });
const iguales = (a: PosicionesPlano, b: PosicionesPlano) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** Un gesto (arrastre o edición de un campo) es una sola operación reversible. */
export function useHistorialPlano() {
  const [historial, estado] = useState<Historial>(vacio);
  const actual = useRef(historial);
  const gesto = useRef<Historial | null>(null);
  const publicar = useCallback((siguiente: Historial) => {
    actual.current = siguiente;
    estado(siguiente);
  }, []);
  const cerrarGesto = useCallback((cancelar = false) => {
    const inicio = gesto.current;
    gesto.current = null;
    const h = actual.current;
    if (!inicio?.actual || !h.actual) return;
    if (iguales(inicio.actual, h.actual)) { publicar(inicio); return; }
    publicar(cancelar ? inicio : {
      actual: h.actual, anteriores: [...h.anteriores, inicio.actual].slice(-100), siguientes: [], pendiente: false,
    });
  }, [publicar]);
  const comenzarGesto = useCallback(() => {
    if (!gesto.current && actual.current.actual) gesto.current = actual.current;
  }, []);
  const cambiar = useCallback((accion: PosicionesPlano | ((p: PosicionesPlano) => PosicionesPlano)) => {
    const h = actual.current;
    if (!h.actual) return;
    const siguiente = typeof accion === "function" ? accion(h.actual) : accion;
    if (iguales(h.actual, siguiente)) return;
    publicar({ actual: siguiente, anteriores: gesto.current ? h.anteriores : [...h.anteriores, h.actual].slice(-100), siguientes: [], pendiente: gesto.current !== null });
  }, [publicar]);
  const iniciar = useCallback((posiciones: PosicionesPlano | null) => {
    gesto.current = null;
    publicar({ ...vacio(), actual: posiciones });
  }, [publicar]);
  const deshacer = useCallback(() => {
    cerrarGesto();
    const h = actual.current;
    if (!h.actual || !h.anteriores.length) return;
    publicar({ actual: h.anteriores.at(-1)!, anteriores: h.anteriores.slice(0, -1), siguientes: [h.actual, ...h.siguientes], pendiente: false });
  }, [publicar, cerrarGesto]);
  const rehacer = useCallback(() => {
    cerrarGesto();
    const h = actual.current;
    if (!h.actual || !h.siguientes.length) return;
    publicar({ actual: h.siguientes[0], anteriores: [...h.anteriores, h.actual], siguientes: h.siguientes.slice(1), pendiente: false });
  }, [publicar, cerrarGesto]);
  return { borrador: historial.actual, cambiar, iniciar, deshacer, rehacer, comenzarGesto, cerrarGesto,
    puedeDeshacer: historial.anteriores.length > 0 || historial.pendiente,
    puedeRehacer: historial.siguientes.length > 0 };
}
