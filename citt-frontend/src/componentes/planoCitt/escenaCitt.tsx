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

type Vertice = readonly [Punto, number];

function SillaReunion3D({ camara, mueble }: { camara: Camara; mueble: Mueble }) {
  const [x, y] = mueble.base[0];
  const [finX, finY] = mueble.base[2];
  const sentido = mueble.haciaIzquierda ? 1 : -1;
  const vertice = (lateral: number, respaldo: number, altura: number): Vertice => [
    [(x + finX) / 2 + sentido * respaldo * (finX - x) / 2,
      (y + finY) / 2 - sentido * lateral * (finY - y) / 2],
    altura,
  ];
  const proyectar = ([planta, altura]: Vertice) => camara.proyectar(planta, altura);
  const puntos3D = (vertices: Vertice[]) => vertices.map(proyectar).join(" ");
  const patas = [-1, 1].flatMap(lado => [-1, 1].map(fondo => [
    vertice(0, 0, 12), vertice(lado * .77, fondo * .77, 6), vertice(lado * .8, fondo * .8, 3),
  ]));
  const tela = (tono: number) => {
    if (!mueble.acabado) return `rgb(${tono} ${tono + 4} ${tono + 6})`;
    const color = mueble.acabado[0];
    return `rgb(${[1, 3, 5].map(i => Math.min(255, Math.round(parseInt(color.slice(i, i + 2), 16) * tono / 177))).join(" ")})`;
  };
  const contorno = Array.from({ length: 24 }, (_, i) => i * Math.PI / 12);
  const cojin = (angulo: number, escala: number, altura: number) =>
    vertice(Math.sin(angulo) * escala, Math.cos(angulo) * escala * .91 - .09, altura);
  const caras = contorno.map((angulo, i) => {
    const siguiente = contorno[(i + 1) % contorno.length];
    return { vertices: [cojin(angulo, .86, 15), cojin(siguiente, .86, 15),
      cojin(siguiente, .92, 12), cojin(angulo, .92, 12)], color: tela(133 + Math.round(11 * Math.sin(angulo))) };
  });
  caras.push({ vertices: contorno.map(angulo => cojin(angulo, .86, 15)), color: tela(177) });

  const arco = 1.93;
  const borde = (angulo: number, radio: number, altura: number) =>
    vertice(Math.sin(angulo) * radio, Math.cos(angulo) * radio, altura);
  const altoRespaldo = (angulo: number) => 16 + (mueble.altura - 16) * Math.cos(angulo / arco * Math.PI / 2);
  function agregarCaraRespaldo(vertices: Vertice[], color: string) {
    const proyectados = vertices.map(proyectar);
    const area = proyectados.reduce((suma, [px, py], i) => {
      const [sigX, sigY] = proyectados[(i + 1) % proyectados.length];
      return suma + px * sigY - py * sigX;
    }, 0);
    if (area > 0) caras.push({ vertices, color });
  }
  for (let i = 0; i < 18; i++) {
    const a = -arco + i * arco / 9;
    const b = a + arco / 9;
    const arribaA = borde(a, .99, altoRespaldo(a));
    const arribaB = borde(b, .99, altoRespaldo(b));
    const labioA = borde(a, .91, altoRespaldo(a) - .7);
    const labioB = borde(b, .91, altoRespaldo(b) - .7);
    const luz = Math.round(10 * Math.sin(a));
    agregarCaraRespaldo([arribaA, arribaB, borde(b, .83, 11), borde(a, .83, 11)], tela(142 + luz));
    agregarCaraRespaldo([borde(a, .67, 14.8), borde(b, .67, 14.8), labioB, labioA], tela(168 + luz));
    agregarCaraRespaldo([labioA, labioB, arribaB, arribaA], tela(189 + luz));
  }
  const superficie = caras.map(({ vertices, color }) => ({
    vertices, color,
    profundidad: vertices.reduce((suma, [punto, altura]) => suma + camara.profundidadPunto(punto, altura), 0) / vertices.length,
  })).sort((a, b) => a.profundidad - b.profundidad);

  return <g>
    <polygon points={puntos3D(contorno.map(angulo => cojin(angulo, 1, 2)))} fill="#192e3c" opacity=".12" />
    {patas.map((pata, i) => {
      const [ruedaX, ruedaY] = proyectar(pata[2]);
      return <g key={i}>
        <ellipse cx={ruedaX} cy={ruedaY + 1} rx="2.4" ry="2.8" fill="#30363b" />
        <polyline points={puntos3D(pata)} fill="none" stroke="#f3f5f5" strokeWidth="2.1"
          strokeLinecap="round" strokeLinejoin="round" />
      </g>;
    })}
    {superficie.map(({ vertices, color }, i) =>
      <polygon key={i} points={puntos3D(vertices)} fill={color} stroke={color} strokeWidth=".45" strokeLinejoin="round" />)}
  </g>;
}

export function Mueble3D({ camara, mueble }: { camara: Camara; mueble: Mueble }) {
  if (mueble.tipo === "sillaReunion") return <SillaReunion3D camara={camara} mueble={mueble} />;
  const x = Math.min(...mueble.base.map(p => p[0]));
  const y = Math.min(...mueble.base.map(p => p[1]));
  const finX = Math.max(...mueble.base.map(p => p[0]));
  const finY = Math.max(...mueble.base.map(p => p[1]));
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

  const esMesa = mueble.tipo === "mesa" || mueble.tipo === "mesaRedonda";
  if (mueble.tipo === "mesaRedonda") {
    const cx = (x + finX) / 2;
    const cy = (y + finY) / 2;
    const radio = Math.min(ancho, fondo) / 2;
    const circulo = (r: number) => Array.from({ length: 32 }, (_, i): Punto =>
      [cx + r * Math.cos(i * Math.PI / 16), cy + r * Math.sin(i * Math.PI / 16)]);
    return <g data-mesa-pedestal="true">
      <polygon points={puntos(camara, mueble.base, 1)} fill="#192e3c" opacity=".15" />
      <Prisma camara={camara} base={circulo(radio * .55)} altura={4} nivel={1}
        fondo="#687278" canto="#3e4c55" borde="#53636a" />
      <Prisma camara={camara} base={circulo(radio * .12)} altura={alto - 3} nivel={4}
        fondo="#687278" canto="#3e4c55" borde="#53636a" />
      <Prisma camara={camara} base={mueble.base} altura={alto} nivel={alto - 4}
        fondo={superficie} canto={frente} cantoLateral={lateral} borde={borde} />
    </g>;
  }
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
          fondo={mueble.colorPersonalizado ? superficie : "#b1b4b2"}
          canto={mueble.colorPersonalizado ? frente : "#737b7d"}
          cantoLateral={mueble.colorPersonalizado ? lateral : "#626e71"} borde="#687375" />
      )}
    </g>
  );
}
