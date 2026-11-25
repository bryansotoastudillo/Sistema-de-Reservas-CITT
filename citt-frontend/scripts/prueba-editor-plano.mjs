import { build } from 'esbuild';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const resultado = await build({stdin:{contents:`export * from './src/componentes/planoCitt/geometriaCitt'; export * from './src/componentes/planoCitt/movimientoPlano';`,resolveDir:process.cwd()},
  bundle:true,write:false,platform:'node',format:'cjs'});
const modulo={exports:{}};
new Function('module','exports','require',resultado.outputFiles[0].text)(modulo,modulo.exports,createRequire(import.meta.url));
const {objetosDelPlano,transformarEnPlano,moverObjetosPlano}=modulo.exports;
const centro=(p,k)=>{const o=objetosDelPlano(p).find(o=>o.clave===k);return transformarEnPlano(o,p)([
  o.base.reduce((s,p)=>s+p[0],0)/o.base.length,o.base.reduce((s,p)=>s+p[1],0)/o.base.length]);};
const cerca=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const a='CW-silla-1',b='CW-silla-2';
for(const giro of [0,37,90,180]){
 const inicial={CW:{x:0,y:0,giro}};
 const nuevo=moverObjetosPlano(inicial,[a,b],8,3);
 for(const k of [a,b]){const c=centro(inicial,k),d=centro(nuevo,k);cerca(d[0]-c[0],8);cerca(d[1]-c[1],3);}
}
const girado=moverObjetosPlano({},[a,b],0,0,15);
const distancia=(p)=>Math.hypot(...centro(p,a).map((v,i)=>v-centro(p,b)[i]));
cerca(distancia(girado),distancia({}));
const vuelta=moverObjetosPlano(girado,[a,b],0,0,-15);
for(const k of [a,b])centro(vuelta,k).forEach((v,i)=>cerca(v,centro({},k)[i]));
const pared=moverObjetosPlano({},[a,b],10000,10000);
const delta=(k)=>centro(pared,k).map((v,i)=>v-centro({},k)[i]);
delta(a).forEach((v,i)=>cerca(v,delta(b)[i]));
for(const k of [a,b]){const o=objetosDelPlano(pared).find(o=>o.clave===k);for(const [x,y] of o.base.map(transformarEnPlano(o,pared))){assert.ok(x>=-1e-7&&x<=767+1e-7);assert.ok(y>=-1e-7&&y<=484+1e-7);}}
const padre=moverObjetosPlano({},['CW',a],5,0);
assert.equal(padre[a],undefined);cerca(centro(padre,a)[0]-centro({},a)[0],5);
const snap=moverObjetosPlano({},[a,b],7,1,0,10);
const relativos=(p)=>centro(p,a).map((v,i)=>v-centro(p,b)[i]);
relativos(snap).forEach((v,i)=>cerca(v,relativos({})[i]));
assert.equal(objetosDelPlano({}).filter(o=>o.zonaPadre==='CW'&&o.muebles[0]?.tipo==='sillaCowork').length,12);
const clave='extra-12345678-1234-1234-1234-123456789abc';
assert.equal(objetosDelPlano({[clave]:{x:0,y:0,tipo:'sillaCowork',color:'#ef9347',ancho:50,fondo:50,altura:100}}).find(o=>o.clave===clave).muebles[0].tipo,'sillaCowork');
console.log('Correcto: traslación en zonas giradas, giro de grupo, límites comunes, padre/hijo sin doble movimiento, snap relativo y sillas cowork.');
