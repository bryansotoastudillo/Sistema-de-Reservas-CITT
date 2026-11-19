import { girarDesplazamiento, mueblesEditables, objetosEditables, transformarEnPlano } from "./geometriaCitt";
import type { PosicionesPlano, Punto } from "./geometriaCitt";

export function moverObjetoPlano(actual: PosicionesPlano, clave: string, dx: number, dy: number,
  grados = 0, paso = 0): PosicionesPlano {
  const objeto = objetosEditables.find(valor => valor.clave === clave);
  if (!objeto) return actual;
  const anterior = actual[clave] ?? { x: 0, y: 0 };
  const giro = ((anterior.giro ?? 0) + grados + 360) % 360;
  const siguientes = { ...actual, [clave]: { ...anterior, giro } };
  const transformar = transformarEnPlano(objeto, siguientes);
  const puntos = [...objeto.base, ...objeto.muebles.flatMap(mueble => mueble.base)].map(transformar);
  mueblesEditables.filter(mueble => mueble.zonaPadre === clave).forEach(mueble => {
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
  return { ...actual, [clave]: { x: anterior.x + x, y: anterior.y + y, giro } };
}
