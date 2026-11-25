# Historial y selección múltiple del plano

Estos controles aparecen únicamente en **Editar plano**, también en pantalla completa.

- **Deshacer** o **Ctrl+Z** revierte el último cambio de la sesión.
- **Rehacer** o **Ctrl+Y** recupera un cambio deshecho. También se admite Ctrl+Shift+Z y Cmd en macOS.
- Cada arrastre completo es un paso, aunque genere muchos movimientos de puntero.
- Mover con botones, girar, cambiar propiedades, añadir, ocultar y eliminar muebles son cambios reversibles.
- Editar un campo de color o dimensiones se agrupa desde que recibe foco hasta que se sale de él.
- Una operación nueva después de deshacer descarta la rama de rehacer.
- Guardar o cancelar termina el historial; entrar de nuevo empieza una sesión sin pasos pendientes.
- El historial conserva hasta 100 operaciones. No se envía al servidor: solo se guarda la distribución resultante.
- Los atajos no interceptan la edición de texto en campos de formulario ni afectan al visor de solo lectura.

## Seleccionar y editar grupos

Selecciona un objeto y mantén **Shift** mientras haces clic en otros. Shift+clic sobre un objeto ya seleccionado lo quita del grupo.
También se pueden seleccionar objetos con las casillas de **Seleccionar varios objetos**, útiles desde un teléfono.

Arrastrar uno de los seleccionados mueve el grupo conservando sus distancias. Los botones de giro lo rotan
alrededor del centro promedio de los objetos. Los límites del suelo se aplican al conjunto;
si una rotación no cabe, no se aplica. La cuadrícula ajusta un ancla del conjunto sin separar sus objetos.
Seleccionar una zona junto a sus muebles no duplica el movimiento de esos muebles.

Se permite cambiar color y dimensiones en conjunto solo cuando todos los seleccionados pertenecen al mismo tipo
de mueble. Una selección que mezcle, por ejemplo, una mesa y una silla mantiene disponibles movimiento, giro,
visibilidad y eliminación, pero deshabilita color y dimensiones. Los modelos de silla de reunión, silla cowork
y silla genérica se consideran tipos distintos. Las mesas redondas y rectangulares también son tipos distintos.

El panel muestra los valores del primer objeto; al modificar un campo se aplica ese valor a todos los seleccionados.
Los muebles originales eliminados se ocultan para poder recuperarlos; los adicionales se quitan de la distribución.
Ambas operaciones pueden deshacerse durante la sesión.

## Silla cowork

Las doce sillas cowork existentes utilizan el modelo de oficina con respaldo gris de malla,
marco y base blancos, apoyabrazos negros y cinco ruedas; el asiento conserva su color azul o naranja
o el color personalizado que ya tuviera guardado. Sus IDs y posiciones anteriores se conservan.

El catálogo incluye **Añadir silla cowork**. Se guarda con `tipo: "sillaCowork"`, usando los mismos campos
de color, dimensiones, posición y giro que el resto del mobiliario adicional. La API del plano acepta ese tipo
y el visor de Pantalla lo dibuja con el mismo componente.

## Archivos y pruebas

- `useHistorialPlano.ts`: historial temporal y agrupación de gestos.
- `movimientoPlano.ts`: traslación, rotación de grupos, ajuste a cuadrícula y límites.
- `PlanoCitt.tsx`: selección con Shift y gestos de puntero.
- `VistaOcupacionCitt.tsx`: atajos, botones, sesión de edición y guardado.
- `EditorMuebles.tsx`: catálogo y propiedades comunes de la selección.
- `SillaCowork3D.tsx`: geometría proyectada del modelo de oficina.
- `PlanoCittController.java`: validación y persistencia de la distribución, incluido el nuevo tipo.

Desde `citt-frontend`, ejecuta `npm run test:plano` y `npm run build`.
Desde `citt-backend`, ejecuta `./mvnw -Dtest=PlanoCittPropiedadesTest test`
(en Windows, `mvnw.cmd`). Las pruebas de interfaz se realizan con distribuciones de prueba, sin sobrescribir el plano real.
