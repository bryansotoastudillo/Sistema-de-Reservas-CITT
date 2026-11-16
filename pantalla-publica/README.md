# Pantalla CITT

`index.html` conserva el calendario y carga el carrusel desde `carrusel.js`. Nginx sirve ambos archivos en `/pantalla/` y publica las imágenes junto al catálogo en `/pantalla/contenido/`.

El backend escribe `catalogo.json` en `CITT_PANTALLA_DIR`, un directorio persistente con los archivos de imagen. En producción monta ese mismo directorio desde el servidor web. La carpeta histórica `/pantalla/media/` es independiente y puede permanecer disponible para clientes con la versión anterior de la pantalla abierta.

Coordinación y Dirección administran el catálogo desde `/contenido-pantalla` en Gestión CITT. La pantalla lee el catálogo al abrirse y al iniciar cada vuelta, y monta el plano 3D como última tarjeta. Cada reemplazo recibe una URL distinta. Las versiones retiradas dejan de aparecer desde la siguiente consulta y se limpian después de un día.
