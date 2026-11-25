import type { Camara } from "./camaraCitt";
import type { Mueble, Punto } from "./geometriaCitt";

type Vertice = readonly [Punto, number];
type Cara = { vertices: Vertice[]; color: string; borde?: string; trazo?: number };

/** Silla de oficina: asiento de color, respaldo gris de malla, brazos y base blanca de cinco ruedas. */
export function SillaCowork3D({ camara, mueble }: { camara: Camara; mueble: Mueble }) {
  const xs = mueble.base.map(p => p[0]), ys = mueble.base.map(p => p[1]);
  const ancho = Math.max(...xs) - Math.min(...xs), fondo = Math.max(...ys) - Math.min(...ys);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const sentido = mueble.haciaNorte ? -1 : 1;
  const v = (x: number, y: number, z: number): Vertice => [[cx + x * ancho, cy + sentido * y * fondo], z * mueble.altura];
  const caras: Cara[] = [];
  const cara = (vertices: Vertice[], color: string, borde?: string, trazo?: number) => caras.push({ vertices, color, borde, trazo });
  function caja(x: number, y: number, a: number, f: number, bajo: number, alto: number, color: string, lado = color) {
    const p = [[x,y],[x+a,y],[x+a,y+f],[x,y+f]];
    cara(p.map(([u,w])=>v(u,w,alto)), color);
    for (let i=0;i<4;i++) {
      const [u,w]=p[i], [j,k]=p[(i+1)%4];
      cara([v(u,w,bajo),v(j,k,bajo),v(j,k,alto),v(u,w,alto)],lado);
    }
  }
  function barra(a: Vertice, b: Vertice, anchoBarra: number, color: string) {
    const [p,z]=a,[q,h]=b, dx=q[0]-p[0],dy=q[1]-p[1],l=Math.hypot(dx,dy)||1;
    const nx=-dy/l*anchoBarra/2, ny=dx/l*anchoBarra/2;
    cara([[[p[0]+nx,p[1]+ny],z],[[q[0]+nx,q[1]+ny],h],[[q[0]-nx,q[1]-ny],h],[[p[0]-nx,p[1]-ny],z]],color);
  }
  const blanco="#e5e8e5", sombra="#aab4b5", negro="#29353c";
  // Estrella y ruedas: cada brazo llega a una rueda independiente.
  for(let i=0;i<5;i++) {
    const angulo=i*Math.PI*2/5+.2, x=Math.cos(angulo)*.46,y=Math.sin(angulo)*.46;
    barra(v(0,0,.12),v(x,y,.045),ancho*.095,blanco);
    barra(v(0,0,.095),v(x,y,.025),ancho*.035,sombra);
    caja(x-.045,y-.045,.09,.09,.015,.075,negro,"#1e292e");
  }
  caja(-.045,-.045,.09,.09,.08,.35,"#b9c2c2","#71838a");
  caja(-.15,-.17,.3,.3,.32,.38,negro);
  // Cojín con esquinas redondeadas y espesor visible.
  const color=mueble.acabado?.[0]??"#4d81b4";
  const oscurecer=(factor:number)=>`rgb(${[1,3,5].map(i=>Math.round(parseInt(color.slice(i,i+2),16)*factor)).join(" ")})`;
  const cojin = Array.from({length:24},(_,i)=>{
    const a=i*Math.PI/12;
    return [Math.sign(Math.cos(a))*Math.pow(Math.abs(Math.cos(a)),.45)*.42,
      Math.sign(Math.sin(a))*Math.pow(Math.abs(Math.sin(a)),.45)*.39-.025] as const;
  });
  cara(cojin.map(([x,y])=>v(x,y,.43)),color);
  cojin.forEach(([x,y],i)=>{
    const [u,w]=cojin[(i+1)%cojin.length];
    cara([v(x,y,.37),v(u,w,.37),v(u,w,.43),v(x,y,.43)],oscurecer(.72));
  });
  // Respaldo ergonómico inclinado, con marco exterior blanco y malla gris.
  const espalda=(x:number,z:number,offset=0)=>v(x,.31+(z-.43)*.24+offset,z);
  const contorno=[[-.41,.48],[-.4,.88],[-.34,.99],[.34,.99],[.4,.88],[.41,.48],[.32,.42],[-.32,.42]];
  cara(contorno.map(([x,z])=>espalda(x,z,.035)),blanco,"#aeb8b8",.5);
  cara(contorno.map(([x,z])=>espalda(x*.89,.44+(z-.44)*.91,-.025)),"#5c686e","#34464f",.5);
  for(let i=1;i<9;i++) {
    const z=.49+i*.048;
    cara([espalda(-.32,z,-.028),espalda(.32,z,-.028)],"none","#829095",.35);
  }
  for(let i=-3;i<=3;i++) cara([espalda(i*.09,.5,-.029),espalda(i*.09,.91,-.029)],"none","#7c8a90",.3);
  // Apoyabrazos negros sobre soportes blancos.
  for(const lado of [-1,1]) {
    caja(lado*.46-.025,-.02,.05,.10,.38,.64,blanco,sombra);
    caja(lado*.46-.065,-.25,.13,.48,.62,.66,"#3c464b",negro);
  }
  const ordenadas=caras.map(c=>({...c, profundidad:c.vertices.reduce((s,[p,z])=>s+camara.profundidadPunto(p,z),0)/c.vertices.length}))
    .sort((a,b)=>a.profundidad-b.profundidad);
  return <g data-silla-cowork="true">
    {ordenadas.map((c,i)=>c.vertices.length===2
      ? <polyline key={i} points={c.vertices.map(([p,z])=>camara.proyectar(p,z).join(',')).join(' ')} fill="none" stroke={c.borde} strokeWidth={c.trazo}/>
      : <polygon key={i} points={c.vertices.map(([p,z])=>camara.proyectar(p,z).join(',')).join(' ')} fill={c.color}
          stroke={c.borde} strokeWidth={c.trazo??.25} strokeLinejoin="round"/>)}
  </g>;
}
