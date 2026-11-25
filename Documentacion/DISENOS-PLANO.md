# Biblioteca de diseños del plano

En Editar plano, **Diseños guardados** abre tarjetas con nombre y portada PNG. La biblioteca es compartida
por coordinadores y directores y se almacena en la tabla PostgreSQL `diseno_plano_citt`, dentro de la base de datos
de la aplicación y de sus respaldos. No depende del almacenamiento del navegador ni de carpetas de imágenes sueltas.

**Predeterminado** se crea una sola vez desde la distribución publicada al abrir la biblioteca por primera vez.
Se conserva como referencia y no se puede eliminar. No es una distribución vacía ni se reemplaza con cada guardado.
Los demás diseños se guardan desde el borrador actual con un nombre único de hasta 80 caracteres.
Se conservan hasta 30 diseños contando el predeterminado.

Cada diseño contiene una copia completa de las posiciones y propiedades: muebles adicionales, ocultos,
colores, dimensiones y giros. No guarda estados de ocupación ni reservas; esas funciones siguen consultándose en vivo.
La portada es una captura estática sin selección ni cuadrícula, generada al guardar el diseño.
La portada del predeterminado se genera desde sus propios datos cuando falta, no desde el borrador actual.

Cargar pide confirmación y **reemplaza** el borrador completo, en lugar de mezclarlo con los objetos de otro diseño.
Así se eliminan del borrador los muebles ocultos o adicionales que no existían en el diseño cargado.
La operación puede deshacerse. Se publica en el plano y Pantalla únicamente al pulsar **Guardar plano**.
Cancelar la edición conserva la distribución publicada. Eliminar una tarjeta elimina su instantánea y portada,
sin modificar el plano activo ni los demás diseños.
**Limpiar muebles adicionales ocultos** permite quitar esos objetos del borrador sin cambiar la visibilidad
de los muebles originales. Pide confirmación, admite Deshacer y se publica solo con Guardar plano.

## API y caché

- `GET /api/plano-citt/disenos`: metadatos de las tarjetas, sin imágenes base64 ni distribución completa.
- `GET /api/plano-citt/disenos/{id}`: distribución de una tarjeta, sin caché para evitar datos antiguos.
- `POST /api/plano-citt/disenos`: nombre, posiciones completas y miniatura PNG base64.
- `GET /api/plano-citt/disenos/{id}/portada`: PNG inmutable con caché privada de 30 días; carga diferida en la galería.
- `PATCH /api/plano-citt/disenos/{id}/portada`: completa una portada ausente, sin reemplazar una ya guardada.
- `DELETE /api/plano-citt/disenos/{id}`: elimina una tarjeta adicional; el predeterminado está protegido.

Todos los endpoints requieren permisos de coordinación o dirección. La creación reutiliza la validación del plano
y limita la imagen a PNG real de hasta 800×600 píxeles y 600000 caracteres codificados.
Las capturas actuales son de 400×244. La galería no monta escenas 3D por tarjeta.
El diseño activo mantiene su control de revisión para evitar sobrescribir cambios de otra sesión.

El esquema se incorpora con la actualización Hibernate configurada en el proyecto.
Pruebas: `DisenosPlanoTest`, `PlanoCittPropiedadesTest` y `DisenosPlanoPostgresTest` (esta última requiere PostgreSQL aislado).

El contorno de selección utiliza la altura efectiva de los muebles, incluido el respaldo de la silla genérica,
también en muebles adicionales sin zona padre. El tamaño y la altura dejan de depender del valor fijo anterior.
