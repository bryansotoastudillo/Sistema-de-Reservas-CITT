# Reservas de espacios y préstamos de artículos

La reserva de una sala y la custodia de un artículo tienen ciclos diferentes.

| Tipo | Aprobación | Retiro | Devolución | Al finalizar el horario |
| --- | --- | --- | --- | --- |
| Solo espacio | APROBADA y correo `solicitud.aprobadaEspacio` | No se exige | No se exige | FINALIZADA automáticamente; sin avisos de retiro ni devolución |
| Artículos | APROBADA | El personal confirma los IDs físicos; pasa a EN PROCESO | El personal recibe y revisa los artículos; pasa a FINALIZADA | Si fueron retirados y no devueltos: ATRASADO y aviso de devolución pendiente |
| Espacio y artículos | Se reserva la sala y se aprueba el préstamo | Se confirma solo el retiro de artículos | Devolver artículos no libera anticipadamente la sala | La sala termina por horario; el préstamo conserva su seguimiento |

Si unos artículos aprobados nunca se retiran, la solicitud se finaliza y se envía únicamente
el aviso `solicitud.vencidaSinRetiro`; no se exige devolver algo que nunca salió.
Las solicitudes pendientes que nadie revisa siguen rechazándose al vencer su horario.
El proceso automático se ejecuta cada cinco minutos; la consulta de ocupación respeta el horario exacto.

## Confirmar físicamente un préstamo

En **Solicitudes**, el personal autorizado usa **Confirmar retiro**, selecciona las unidades del inventario
o ingresa sus IDs y confirma. El backend exige que coincidan categoría, marca y cantidad,
que estén disponibles, que la solicitud esté aprobada y que el plazo no haya terminado.
Se registra `fechaRetiroReal` y las unidades quedan PRESTADO.

Al recibirlas, usa **Registrar devolución**, revisa las unidades y registra daños si los hay.
Se guarda `fechaDevolucionReal` y las unidades quedan DISPONIBLE o DAÑADO.
El historial permite consultar ambas fechas. No se permiten devoluciones duplicadas ni retiros de solicitudes solo de espacio.

Se conservan los permisos existentes: ayudantes/docentes para artículos y coordinadores/directores
para gestionar espacios o solicitudes mixtas. Las restricciones de autogestión siguen aplicándose.

Los endpoints existentes se mantienen: `PATCH /api/solicitudes/{id}/entregar` y `PATCH /api/solicitudes/{id}/devolver`.
Los cambios de estado generales no sustituyen esas confirmaciones físicas.

## Espacios y solicitudes mixtas

La disponibilidad depende de fecha, hora y `fechaLiberacionEspacio`, no de que unos artículos se hayan devuelto.
Si se devuelven antes del final de una reserva mixta, la sala conserva el tiempo aprobado.
Si los artículos se atrasan, la sala queda libre al terminar su horario.
La liberación manual de espacios sigue siendo la forma de terminar anticipadamente su uso.
Las reservas finalizadas se conservan en calendario e historial.

## Datos y validación

La columna nullable `solicitud.fecha_retiro_real` se incorpora mediante la actualización de esquema de Hibernate
configurada en este proyecto. Los registros antiguos mantienen ese dato vacío; no se inventa una fecha de retiro.
El proceso automático reconoce préstamos existentes por las unidades asignadas pendientes de devolución.
También finaliza, sin nuevos avisos de artículos, registros antiguos solo de espacios que hubieran quedado EN PROCESO o ATRASADO.
Los rechazos históricos no se modifican.

Las pruebas `FlujoSolicitudesTest` comprueban las transiciones y los avisos; `ReservaEspacioFlujoPostgresTest`
comprueba ocupación, horarios y solicitudes mixtas con una base PostgreSQL aislada.
Esta última requiere `CITT_PRUEBA_POSTGRES_AISLADO=true` y una conexión exclusiva de pruebas;
nunca debe ejecutarse contra la base principal porque crea y elimina su propio esquema.
