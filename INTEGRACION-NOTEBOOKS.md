# Notebooks en Reservas CITT

El agente Windows envía reportes JSON por HTTPS a `POST /api/notebooks/reportes`. La API identifica al equipo por su token y actualiza la última lectura en PostgreSQL. El vínculo se guarda en `notebook_monitoreado.id_articulo` y permite mostrar el estado de inventario, incluido **PRESTADO**, junto con la telemetría.

## Probar en el servidor de CITT

1. Incorpora los cambios a la versión de Reservas CITT que se despliega en OCI. Usa un ambiente de prueba con su propia base PostgreSQL.
2. Construye y despliega backend y frontend juntos. El backend debe usar la base que ya utiliza Reservas CITT. La configuración actual de Hibernate con `ddl-auto=update` crea la tabla nueva al iniciar. Si el ambiente administra el esquema con migraciones, el administrador de la base debe aplicar la tabla antes de iniciar ese backend.
3. Sirve el portal y su API en el mismo dominio por HTTPS. El front compilado usa `/api` en producción salvo que `VITE_API_BASE_URL` indique otro destino. Mantén el proxy de `/api/` hacia Spring Boot.
4. Inicia sesión como Coordinación o Dirección. En **Notebooks**, busca el artículo del equipo, verifica su código Duoc o número de serie y elige **Vincular y descargar configuración**.
5. Instala el agente actualizado en un notebook piloto y confirma que aparece su primera lectura. Una vez validado, repite con los demás Dell.

## Instalar el agente de CITT

Copia `agente-notebooks` a una ubicación en Windows x64 que solo los administradores puedan modificar. Coloca el `configuracion.json` descargado junto a `instalar_notebook.ps1`. Cada notebook debe recibir la configuración de su propio artículo. Para este flujo HTTPS se usa el certificado de confianza del sitio.

Abre PowerShell de 64 bits como administrador en la carpeta y ejecuta:

```powershell
.\instalar_notebook.ps1
```

El instalador descarga y verifica una copia privada de Python y configura el arranque con Windows. Si tienes el ZIP oficial de Python incluido en el paquete de instalación sin conexión, puedes pasar su ruta con `-PythonZip`. Si el equipo ya tiene una tarea del sistema anterior apuntando a otro servidor, el instalador se detiene para que el administrador revise esa migración.

## Ubicación durante préstamos externos

En el notebook institucional piloto, activa los servicios de ubicación de Windows según la configuración del equipo e instala con:

```powershell
.\instalar_notebook.ps1 -HabilitarUbicacion
```

Una actualización conserva esa opción. Puedes deshabilitarla con `-HabilitarUbicacion:$false` al reinstalar. El agente consulta Windows después de que el servidor confirma que el notebook está entregado en un préstamo externo, incluso si el préstamo está atrasado. Si Windows no entrega una lectura nueva o el equipo está desconectado, el reporte de inventario sigue su flujo habitual y las coordenadas no se encolan.

Para validar el piloto, entrega el notebook en una solicitud de artículos con destino externo. Verifica que **Notebooks** muestre la hora, la antigüedad y la precisión de la última posición con Wi-Fi institucional y luego con otra red, usando la tarea del sistema. Si el equipo lleva más de 15 minutos sin reportar o aún no ha enviado su primer reporte, el panel avisa y permite abrir la ficha del préstamo.

Al registrar la devolución, la ubicación deja de aparecer como lectura actual. Coordinación y Dirección pueden consultar las lecturas de préstamos externos en **Historial de 30 días**. Cada lectura vence al cumplir 30 días, sale de las consultas en ese momento y se elimina de la base en la siguiente limpieza programada, que se ejecuta cada cinco minutos. Google Maps recibe las coordenadas si alguien abre el enlace.

## Lecturas y permisos

- Se guarda el último reporte por artículo. Un reporte atrasado no reemplaza una lectura más reciente.
- El agente reporta cada cinco minutos. Mientras Windows ejecuta el agente, el estado reportado es encendido. El portal muestra **Sin reporte reciente** después de diez minutos. Los eventos disponibles de inicio, apagado, suspensión y reanudación se consultan del registro de Windows y se entregan en el siguiente reporte.
- Se envían batería, cargador, nombre del equipo, estado, programas y eventos de energía. También se muestra la última ejecución detectada de programas cuando hay datos. Los nombres de cuentas locales y redes Wi-Fi quedan fuera del envío a CITT.
- El listado y la emisión de configuraciones requieren una sesión de Coordinación o Dirección. El token de cada notebook solo sirve para reportar y se guarda como hash en la base. Renovar la clave requiere reemplazar el archivo en ese notebook.
