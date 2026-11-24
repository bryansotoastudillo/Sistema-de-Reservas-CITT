# Textos de los correos CITT

Todos los textos que se muestran en los correos están en `citt-backend/src/main/resources/correos/mensajes.json`.
En el servidor, el archivo fuente está en `/home/mrecabal/citt-app/citt-backend/src/main/resources/correos/mensajes.json`.
El mismo catálogo se utiliza tanto para Gmail como para Brevo.

## Buscar y editar un mensaje

Cada entrada de `correos` tiene un ID estable. En Java se utiliza, por ejemplo,
`CorreoCitt.desdeCatalogo("solicitud.aprobada", ...)`; busca ese mismo ID en el JSON.

| ID | Cuándo se utiliza |
| --- | --- |
| `solicitud.pendiente` | Aviso a coordinadores y directores de una solicitud nueva |
| `solicitud.recibida` | Acuse de recibo para el solicitante |
| `solicitud.aprobada` | Reserva confirmada y botón para Google Calendar |
| `solicitud.aprobadaEspacio` | Confirmación solo de espacio, sin retiro ni devolución de artículos |
| `solicitud.rechazada` | Solicitud rechazada, acompañada de su motivo |
| `solicitud.vencidaSinRetiro` | Finalizó el horario aprobado sin registro de retiro |
| `solicitud.atrasada` | Recursos pendientes de devolución |
| `cuenta.creada` | Bienvenida con contraseña provisoria |
| `cuenta.claveProvisoria` | Nueva clave provisoria emitida por administración |
| `cuenta.recuperacion` | Código para recuperar la contraseña |

Campos de cada entrada:

- `descripcion`: explica a quien mantiene el catálogo para qué sirve el mensaje; no se envía al usuario.
- `asunto`: asunto del correo y título de su documento HTML; debe ocupar una sola línea.
- `titulo`: encabezado principal dentro del correo.
- `mensaje`: descripción o cuerpo del mensaje; admite saltos de línea con `\n`.
- `etiqueta`: texto de la insignia de estado, por ejemplo «Confirmada».
- `boton`: texto del botón; su enlace se construye en Java.

Ejemplo de edición:

```json
"solicitud.aprobada": {
  "descripcion": "Confirmación de la reserva, con enlace a Google Calendar.",
  "asunto": "Reserva #{idSolicitud} confirmada - CITT Duoc UC",
  "titulo": "Tu reserva está confirmada",
  "mensaje": "Preséntate a la hora indicada para usar el espacio o retirar los artículos en el mesón del CITT.",
  "etiqueta": "Confirmada",
  "boton": "Agregar a Google Calendar"
}
```

Conserva los IDs y los nombres de los campos. Los cinco correos de solicitud con número permiten
usar `{idSolicitud}` en sus textos. `solicitud.atrasada` y los correos de cuenta no reciben ese marcador.
Las fechas, horarios, nombres, motivos, recursos, contraseñas y códigos se incorporan como datos
de cada envío; no se deben escribir en el catálogo.

La sección `textos` centraliza la marca institucional, el nombre del remitente, el pie,
las etiquetas de la tabla (`datos.*`), el motivo predeterminado y los textos del evento de calendario.
`horario` acepta `{horaInicio}` y `{horaFin}`; `horaLimite` acepta `{horaFin}`;
`calendario.titulo` acepta `{idSolicitud}` y `calendario.detalles` acepta `{idSolicitud}` y `{portal}`.
Las demás entradas compartidas son texto literal.

Los textos se escapan al construir el HTML: escribe texto plano, no etiquetas HTML.
Los colores, la estructura HTML, las reglas de negocio, los destinatarios y los enlaces siguen definidos en Java.

## Validar y publicar

El JSON se incorpora al JAR y se carga una vez al iniciar el backend. Editar el archivo fuente por sí solo
no cambia los correos del contenedor en ejecución. Para publicar una edición:

1. Edita y guarda `mensajes.json` en UTF-8. Respeta las comillas y comas del formato JSON.
2. Ejecuta las pruebas desde `citt-backend`:

   ```powershell
   .\mvnw.cmd "-Dtest=CatalogoCorreosTest,CorreoSolicitudVencidaTest,EmailServiceTest,NotificacionNuevaSolicitudTest" test
   ```

3. Haz commit y push del cambio para conservarlo en GitHub.
4. Actualiza ese archivo en el servidor y, desde `/home/mrecabal/citt-app`, reconstruye y recrea únicamente el backend:

   ```bash
   docker compose -p citt-app -f docker-compose.servidor.yml -f docker-compose.mail.yml build backend
   docker compose -p citt-app -f docker-compose.servidor.yml -f docker-compose.mail.yml up -d --no-deps --no-build backend
   docker logs --since 5m --tail 100 citt-app-backend
   ```

5. Comprueba un envío autorizado y su registro. Las pruebas automatizadas usan envíos simulados y no mandan correos reales.

El catálogo se valida al iniciar: un JSON inválido, IDs obligatorios ausentes, campos vacíos,
IDs duplicados o variables no admitidas impiden cargarlo. Corrige el archivo y vuelve a construir el backend;
conserva un respaldo previo al publicar.

## Funcionamiento interno

- `CatalogoCorreos.java`: carga y valida el JSON, busca IDs y sustituye los marcadores en una sola pasada.
- `CorreoCitt.java`: aplica el diseño institucional y escapa textos, etiquetas y datos.
- `CorreoSolicitud.java`: prepara datos de las solicitudes y el enlace de Google Calendar.
- `EmailService.java`: selecciona los mensajes de cuenta y entrega el correo al proveedor configurado.

Para añadir un tipo de correo, crea su ID y sus seis campos en el JSON, incorpora la llamada
`desdeCatalogo` en el flujo correspondiente y agrega una prueba. Si necesitas nuevas variables,
decláralas en la validación de `CatalogoCorreos` y suminístralas desde Java.
