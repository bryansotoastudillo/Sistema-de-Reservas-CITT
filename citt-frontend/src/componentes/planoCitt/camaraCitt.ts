import { pisoCitt } from "./geometriaCitt";
import type { Punto } from "./geometriaCitt";

export function crearCamara(grados: number) {
  const radianes = grados * Math.PI / 180;
  const seno = Math.sin(radianes);
  const coseno = Math.cos(radianes);
  const plano = ([x, y]: Punto): Punto => [x * coseno - y * seno, 0.69 * (x * seno + y * coseno)];
  const contorno = [...pisoCitt, [-17, -8] as Punto, [-17, 492] as Punto, [773, 492] as Punto].map(plano);
  const limites = contorno.reduce(([izq, der, arriba, abajo], [x, y]) =>
    [Math.min(izq, x), Math.max(der, x), Math.min(arriba, y), Math.max(abajo, y)],
  [Infinity, -Infinity, Infinity, -Infinity]);
  const [izq, der, arriba, abajo] = limites;
  const escala = Math.min(985 / (der - izq), 485 / (abajo - arriba));
  const desplazarX = 535 - escala * (izq + der) / 2;
  const desplazarY = 327 - escala * (arriba + abajo) / 2;
  return {
    proyectar(punto: Punto, altura = 0): Punto {
      const [x, y] = plano(punto);
      return [desplazarX + escala * x, desplazarY + escala * (y - altura * 0.77)];
    },
    profundidad(base: Punto[]) {
      return Math.max(...base.map((punto) => plano(punto)[1]));
    },
    caraVisible(inicio: Punto, fin: Punto) {
      return (inicio[0] - fin[0]) * coseno + (fin[1] - inicio[1]) * seno > 0;
    },
  };
}

export type Camara = ReturnType<typeof crearCamara>;

export function puntos(camara: Camara, base: Punto[], altura = 0) {
  return base.map((punto) => camara.proyectar(punto, altura).join(",")).join(" ");
}
