import { girarDesplazamiento, objetosDelPlano, transformarEnPlano } from "./geometriaCitt";
import type { PosicionesPlano, Punto } from "./geometriaCitt";

export function moverObjetoPlano(actual: PosicionesPlano, clave: string, dx: number, dy: number,
  grados = 0, paso = 0): PosicionesPlano {
  const objetos = objetosDelPlano(actual);
  const objeto = objetos.find(valor => valor.clave === clave);
  if (!objeto) return actual;
  const anterior = actual[clave] ?? { x: 0, y: 0 };
  const giro = ((anterior.giro ?? 0) + grados + 360) % 360;
  const siguientes = { ...actual, [clave]: { ...anterior, giro } };
  const transformar = transformarEnPlano(objeto, siguientes);
  const puntos = [...objeto.base, ...objeto.muebles.flatMap(mueble => mueble.base)].map(transformar);
  objetos.filter(mueble => mueble.zonaPadre === clave && !actual[mueble.clave]?.oculto).forEach(mueble => {
    puntos.push(...mueble.base.map(transformarEnPlano(mueble, siguientes)));
  });
  const xs = puntos.map(([x]) => x);
  const ys = puntos.map(([, y]) => y);
  const minimoX = -Math.min(...xs);
  const maximoX = 767 - Math.max(...xs);
  const minimoY = -Math.min(...ys);
  const maximoY = 484 - Math.max(...ys);
  if (minimoX > maximoX || minimoY > maximoY) return actual;

  let movimientoX = Math.min(maximoX, Math.max(minimoX, dx));
  let movimientoY = Math.min(maximoY, Math.max(minimoY, dy));
  if (paso > 0) {
    const centro: Punto = [
      objeto.base.reduce((suma, punto) => suma + punto[0], 0) / objeto.base.length,
      objeto.base.reduce((suma, punto) => suma + punto[1], 0) / objeto.base.length,
    ];
    const [cx, cy] = transformar(centro);
    const primerX = Math.ceil((cx + minimoX) / paso - 1e-9);
    const ultimoX = Math.floor((cx + maximoX) / paso + 1e-9);
    const primerY = Math.ceil((cy + minimoY) / paso - 1e-9);
    const ultimoY = Math.floor((cy + maximoY) / paso + 1e-9);
    if (primerX > ultimoX || primerY > ultimoY) return actual;
    movimientoX = Math.min(ultimoX, Math.max(primerX, Math.round((cx + dx) / paso))) * paso - cx;
    movimientoY = Math.min(ultimoY, Math.max(primerY, Math.round((cy + dy) / paso))) * paso - cy;
  }
  const [x, y] = girarDesplazamiento([movimientoX, movimientoY],
    -(objeto.zonaPadre ? actual[objeto.zonaPadre]?.giro ?? 0 : 0));
  if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9 && giro === (anterior.giro ?? 0)) return actual;
  return { ...actual, [clave]: { ...anterior, x: anterior.x + x, y: anterior.y + y, giro } };
}

/** Excluye hijos de zonas ya seleccionadas para no aplicar dos veces el movimiento. */
export function raicesSeleccion(actual: PosicionesPlano, claves: readonly string[]) {
  const objetos = objetosDelPlano(actual);
  return objetos.filter(o => claves.includes(o.clave) && (!o.zonaPadre || !claves.includes(o.zonaPadre)));
}

export function moverObjetosPlano(actual: PosicionesPlano, claves: readonly string[], dx: number, dy: number,
  grados = 0, paso = 0): PosicionesPlano {
  const raices = raicesSeleccion(actual, claves);
  if (!raices.length) return actual;
  if (raices.length === 1) return moverObjetoPlano(actual, raices[0].clave, dx, dy, grados, paso);
  const todos = objetosDelPlano(actual);
  const puntos = (posiciones: PosicionesPlano) => raices.flatMap(o => {
    const miembros = [o, ...todos.filter(h => h.zonaPadre === o.clave && !posiciones[h.clave]?.oculto)];
    return miembros.flatMap(m => [...m.base, ...m.muebles.flatMap(p => p.base)].map(transformarEnPlano(m, posiciones)));
  });
  const centros = raices.map(o => transformarEnPlano(o, actual)([
    o.base.reduce((s, p) => s + p[0], 0) / o.base.length, o.base.reduce((s, p) => s + p[1], 0) / o.base.length,
  ]));
  const centro: Punto = [centros.reduce((s, p) => s + p[0], 0) / centros.length,
    centros.reduce((s, p) => s + p[1], 0) / centros.length];
  const siguientes = { ...actual };
  for (const o of raices) {
    const local: Punto = [o.base.reduce((s, p) => s + p[0], 0) / o.base.length, o.base.reduce((s, p) => s + p[1], 0) / o.base.length];
    const c = transformarEnPlano(o, actual)(local);
    const rotado = girarDesplazamiento([c[0] - centro[0], c[1] - centro[1]], grados);
    const desplazamiento = girarDesplazamiento([centro[0] + rotado[0] - c[0], centro[1] + rotado[1] - c[1]],
      -(o.zonaPadre ? actual[o.zonaPadre]?.giro ?? 0 : 0));
    const p = actual[o.clave] ?? { x: 0, y: 0 };
    siguientes[o.clave] = { ...p, x: p.x + desplazamiento[0], y: p.y + desplazamiento[1], giro: ((p.giro ?? 0) + grados + 360) % 360 };
  }
  const girados = puntos(siguientes);
  const minX = -Math.min(...girados.map(p => p[0])), maxX = 767 - Math.max(...girados.map(p => p[0]));
  const minY = -Math.min(...girados.map(p => p[1])), maxY = 484 - Math.max(...girados.map(p => p[1]));
  if (minX > maxX || minY > maxY) return actual;
  // Una rotación que exigiría separar o desplazar el grupo se rechaza completa.
  if (grados && (minX > 1e-8 || maxX < -1e-8 || minY > 1e-8 || maxY < -1e-8)) return actual;
  if (paso > 0) {
    const ancla = raices.at(-1)!;
    const c = transformarEnPlano(ancla, siguientes)([
      ancla.base.reduce((s, p) => s + p[0], 0) / ancla.base.length,
      ancla.base.reduce((s, p) => s + p[1], 0) / ancla.base.length,
    ]);
    const ajustar = (v: number, d: number, min: number, max: number) => {
      const primero = Math.ceil((v + min) / paso - 1e-9), ultimo = Math.floor((v + max) / paso + 1e-9);
      return primero > ultimo ? null : Math.min(ultimo, Math.max(primero, Math.round((v + d) / paso))) * paso - v;
    };
    const x = ajustar(c[0], dx, minX, maxX), y = ajustar(c[1], dy, minY, maxY);
    if (x === null || y === null) return actual;
    dx = x; dy = y;
  } else {
    dx = Math.min(maxX, Math.max(minX, dx)); dy = Math.min(maxY, Math.max(minY, dy));
  }
  for (const o of raices) {
    const p = siguientes[o.clave];
    const [x, y] = girarDesplazamiento([dx, dy], -(o.zonaPadre ? actual[o.zonaPadre]?.giro ?? 0 : 0));
    siguientes[o.clave] = { ...p, x: p.x + x, y: p.y + y };
  }
  return siguientes;
}
