import { rectangulo } from "./geometriaCitt";
import type { Mueble, Punto } from "./geometriaCitt";
import { puntos } from "./camaraCitt";
import type { Camara } from "./camaraCitt";

export function Prisma({ camara, base, altura, fondo, canto, borde, nivel = 0, cantoLateral }: {
  camara: Camara; base: Punto[]; altura: number; fondo: string; canto: string; borde: string;
  nivel?: number; cantoLateral?: string;
}) {
  return (
    <>
      {base.map((inicio, indice) => {
        const fin = base[(indice + 1) % base.length];
        if (!camara.caraVisible(inicio, fin)) return null;
        const cara = [camara.proyectar(inicio, nivel), camara.proyectar(fin, nivel),
          camara.proyectar(fin, altura), camara.proyectar(inicio, altura)];
        const lateral = Math.abs(fin[1] - inicio[1]) > Math.abs(fin[0] - inicio[0]);
        return <polygon key={indice} points={cara.map((punto) => punto.join(",")).join(" ")}
          fill={lateral ? cantoLateral ?? canto : canto} />;
      })}
      <polygon points={puntos(camara, base, altura)} fill={fondo} stroke={borde} strokeWidth="0.9" strokeLinejoin="round" />
    </>
  );
}

export function Mueble3D({ camara, mueble }: { camara: Camara; mueble: Mueble }) {
  const [x, y] = mueble.base[0];
  const [finX, finY] = mueble.base[2];
  const ancho = finX - x;
  const fondo = finY - y;
  const alto = mueble.altura;
  const [superficie, frente, lateral, borde] = mueble.acabado ?? ["#d9b78d", "#927252", "#a78662", "#99795d"];

  if (!mueble.tipo) {
    return (
      <g opacity={mueble.opacidad}>
        <Prisma camara={camara} base={mueble.base} altura={alto} nivel={mueble.nivel ?? 2}
          fondo={superficie} canto={frente} cantoLateral={lateral} borde={borde} />
      </g>
    );
  }

  const esMesa = mueble.tipo === "mesa";
  const patas = [x + 3, finX - 7].flatMap((px) => [y + 3, finY - 7].map((py) => rectangulo(px, py, 4, 4)));
  return (
    <g>
      <polygon points={puntos(camara, mueble.base.map(([px, py]) => [px + 7, py + 8]), 2)} fill="#192e3c" opacity=".15" />
      {patas.map((base, i) => (
        <Prisma key={i} camara={camara} base={base} altura={alto - 3} nivel={2}
          fondo={mueble.patas ?? "#687278"} canto={mueble.patas ?? "#535e64"}
          cantoLateral={mueble.patas ?? "#3e4c55"} borde={mueble.patas ?? "#53636a"} />
      ))}
      <Prisma camara={camara} base={mueble.base} altura={alto} nivel={alto - (esMesa ? 4 : 5)}
        fondo={superficie} canto={frente} cantoLateral={lateral} borde={borde} />
      {esMesa ? (
        <>
          {mueble.patas === "#d5a322" && [0.31, 0.65].map((fraccion) => {
            const veta = y + fondo * fraccion;
            return <polyline key={fraccion} points={puntos(camara, [[x + 3, veta], [finX - 3, veta]], alto)}
              fill="none" stroke="#bb946b" strokeWidth="0.7" opacity=".55" />;
          })}
          {mueble.monitor && (
            <>
              <Prisma camara={camara} base={rectangulo(x + 4, y + 8, Math.min(ancho - 8, 19), 4)}
                altura={alto + 15} nivel={alto + 1} fondo="#749cab" canto="#263e4c" cantoLateral="#183243" borde="#375765" />
              <Prisma camara={camara} base={rectangulo(x + 5, y + 19, Math.min(ancho - 10, 16), 6)}
                altura={alto + 1} nivel={alto} fondo="#667d87" canto="#344e5a" borde="#617782" />
            </>
          )}
        </>
      ) : (
        <Prisma camara={camara} base={rectangulo(x, y, ancho, 4)} altura={alto + 9} nivel={alto}
          fondo="#b1b4b2" canto="#737b7d" cantoLateral="#626e71" borde="#687375" />
      )}
    </g>
  );
}
