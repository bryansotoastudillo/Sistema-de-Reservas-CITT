# Visor de ocupación del CITT

El visor de solo lectura se abre en `/visor-espacios.html`. Cada apertura o pulsación de **Actualizar** hace una consulta. El visor reutiliza la geometría y la interpretación de estados de Gestión de Espacios.

## Desde otra página

```html
<div id="mapa-citt"></div>
<script type="module">
  import { montarPlanoCitt } from "https://administracion.cittvalparaiso.cl/visor-plano-citt.js";

  const visor = montarPlanoCitt(document.getElementById("mapa-citt"));
  // Al volver a mostrar el plano en una rotación de contenidos:
  // visor.actualizar();
  // Al retirar el plano:
  // visor.desmontar();
</script>
```

También puedes usar un iframe con origen
`https://administracion.cittvalparaiso.cl/visor-espacios.html` y recargarlo al volver a mostrarlo.

## API de lectura

`GET https://administracion.cittvalparaiso.cl/api/plano-citt/visor`

- `revision`: revisión de la distribución guardada.
- `posiciones`: desplazamientos `x`, `y` y giro opcional `giro`, en grados, por clave del plano.
- `espacios`: identificador, nombre, estado operativo y `enUsoAhora` calculado a partir de las reservas vigentes.
- `consultadoEn`: instante de la consulta en formato ISO 8601.

El endpoint admite CORS sin credenciales y responde con `Cache-Control: no-store`. El mismo módulo exporta `consultarPlanoCitt()` para leer el JSON desde otra página. Para dibujar el plano oficial se necesita el visor, que incluye la geometría base.
