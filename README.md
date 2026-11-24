# Sistema de Gestión de Reservas y Préstamos CITT

Los asuntos, títulos, mensajes, etiquetas y botones de los correos se editan en
[`citt-backend/src/main/resources/correos/mensajes.json`](citt-backend/src/main/resources/correos/mensajes.json).
Consulta la [guía de edición y publicación de correos](Documentacion/CORREOS.md).

## Descripción del Proyecto

### El Problema
Actualmente, la gestión operativa de la Sala CITT presenta ineficiencias y fricciones significativas en dos frentes principales:

*   **Reservas a ciegas y procesos redundantes:** Las solicitudes de espacios se realizan mediante formularios estáticos que obligan a los usuarios a ingresar su información desde cero en cada ocasión. Al carecer de visibilidad en tiempo real sobre la disponibilidad de los horarios, el usuario solicita "a ciegas" y queda a la espera de una respuesta manual para confirmar su reserva.
*   **Falta de trazabilidad en el inventario:** El préstamo de artículos no está integrado en las solicitudes. El inventario depende de planillas de cálculo descentralizadas e incompletas, lo que imposibilita un seguimiento estricto. Esto genera puntos ciegos operativos, haciendo muy difícil saber quién está utilizando un equipo específico en un momento dado o determinar responsabilidades en caso de daños.

### La Solución
Este sistema resuelve estos problemas mediante una plataforma centralizada de gestión de reservas de espacios y préstamos de artículos, optimizando el flujo de información y automatizando procesos:

*   **Visibilidad Transparente:** Implementación de un calendario interactivo que permite conocer la disponibilidad de los espacios de manera anticipada.
*   **Trazabilidad Total:** Cada reserva y préstamo queda asociado de forma inmutable al usuario solicitante, con fechas y horas específicas. El sistema categoriza el inventario y separa los Artículos Tecnológicos (disponibles para préstamo dinámico) del Mobiliario (activos estáticos inherentes a cada espacio de la sala).
*   **Automatización de Feedback:** Las resoluciones de las solicitudes (aprobadas o rechazadas) detonan correos electrónicos automáticos hacia el usuario, eliminando los tiempos de incertidumbre.

### Público Objetivo
El sistema está diseñado para dar cobertura y control a todos los actores del ecosistema CITT:
*   Alumnos
*   Alumnos Ayudantes
*   Docentes
*   Coordinador
*   Director

---

## Tecnologías utilizadas

### Front-End
*   **React 19.2:** Librería principal para la interfaz de usuario
*   **Typescript 6.0:** Lenguaje de tipado estático sobre JavaScript
*   **Vite 8.0:** Bundler y servidor de desarrollo
*   **Tailwind CSS 4.3:** Framework de estilos utilitarios
*   **React Router DOM 7.16:** Enrutamiento y navegación SPA
*   **Axios 1.16:** Cliente HTTP para consumo de API REST
*   **FullCalendar 6.1:** Componente de calendario interactivo
*   **Recharts 3.8:** Gráficos y visualización de datos
*   **Lucide React 1.14:** Iconos SVG
*   **Cypress 15.17:** Testing E2E con Cucumber (BDD)

### Back-End
*   **Java 21:** Lenguaje principal
*   **Spring Boot 3.5:** Framework para la construcción de la API REST
*   **Spring Security:** Autenticación y autorización basada en filtros
*   **Spring Data JPA:** ORM y persistencia de datos con Hibernate
*   **PostgreSQL 16+:** Base de datos relacional
*   **JWT (jjwt) 0.11.5:** Generación y validación de tokens de autenticación
*   **SpringDoc OpenAPI 2.8.4:** Documentación interactiva de la API (Swagger UI)
*   **Spring Mail:** Envío de correos electrónicos vía SMTP
*   **Lombok:** Reducción de código boilerplate en entidades y DTOs
*   **Maven:** Gestión de dependencias y construcción del proyecto

---

## Requisitos previos
*   Java JDK 21 o superior
*   Node.js 20+ y npm 10+
*   PostgreSQL 16+
*   IntelliJ IDEA (Ultimate o Community) — IDE para ejecutar backend y frontend
*   Git

---

## Instalación

1.  **Clonar repositorio**
    ```bash
    git clone https://github.com/RafaelRiosFredes/Sistema-de-Reservas-CITT.git
    ```
2.  **Configurar la Base de Datos**
    Crear la base de datos en PostgreSQL:
    ```sql
    CREATE DATABASE cittdb;
    ```
3.  **Abrir el proyecto en IntelliJ IDEA**
    1.  Abrir IntelliJ → File → Open
    2.  Seleccionar la carpeta raíz `Sistema-de-Reservas-CITT`
4.  **Ejecutar el Back-end**
    1.  Navegar a `citt-backend/src/main/java/cl/duoc/citt/citt_backend/CittBackendApplication.java`
    2.  Click derecho sobre el archivo → `Run 'CittBackendApplication'`
    3.  El servidor estará disponible en: http://localhost:8080
5.  **Instalar las dependencias del Front-End**
    1.  Abrir la terminal integrada de IntelliJ (Alt + F12 en Windows)
    2.  Navegar a la carpeta del frontend:
        ```bash
        cd citt-frontend
        ```
    3.  Instalar las dependencias (solo la primera vez o cuando se agreguen nuevas):
        ```bash
        npm install
        ```
    4.  Iniciar el servidor de desarrollo:
        ```bash
        npm run dev
        ```

---

## Configuración
La configuración del backend se encuentra en: `citt-backend/src/main/resources/application.properties`

**Base de Datos**
```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/cittdb
spring.datasource.username=postgres
spring.datasource.password=postgres
```

**JWT (Seguridad)**
```properties
jwt.secret=${JWT_SECRET:clave-secreta-por-defecto}
jwt.expiration=3600000            # 1 hora
jwt.refresh-expiration=604800000  # 7 días
```

**Correo SMTP (Gmail)**
```properties
spring.mail.host=smtp.gmail.com
spring.mail.port=587
spring.mail.username=correo@gmail.com
spring.mail.password=${MAIL_PASSWORD:contraseña-de-aplicacion}
```
*\* Para generar una contraseña de aplicación de Gmail: Google Account → Seguridad → Verificación en 2 pasos → Contraseñas de aplicaciones.*

### Dominios Institucionales
| Dominio predeterminado | Rol automático | Alta | Variable de entorno |
| :--- | :--- | :--- | :--- |
| `@duocuc.cl` | Alumno | Manual y autorregistro | `CITT_DOMINIOS_ALUMNO` |
| `@profesor.duoc.cl` | Docente | Manual y autorregistro | `CITT_DOMINIOS_DOCENTE` |
| `@duoc.cl` | Administrativo | Manual y autorregistro | `CITT_DOMINIOS_ADMINISTRATIVO` |

Las propiedades están en [application.properties](citt-backend/src/main/resources/application.properties). Admiten varios dominios separados por comas. Registro, inicio de sesión y renovación usan la misma política. `CITT_CORREOS_EXCEPCION` admite correos individuales separados por comas para alta manual e inicio de sesión, con roles asignados por quien registra.

Administrativo hereda los permisos de Docente y Coordinador. Los permisos exclusivos de Dirección se asignan con el rol Director. Los roles automáticos se aplican al crear la cuenta y pueden complementarse desde Registrar Usuarios. El panel muestra la configuración activa en **Dominios admitidos**.

---

## Uso/Ejecución

### Opción 1: Ejecución Local (Desarrollo)
Requiere PostgreSQL, Java 21 y Node.js instalados localmente.
1.  Crear la base de datos en PostgreSQL: `CREATE DATABASE cittdb;`
2.  **Backend:** Abrir IntelliJ → navegar a `CittBackendApplication.java` → Run
3.  **Frontend:** En la terminal integrada (Alt + F12):
    ```bash
    cd citt-frontend
    npm install   # solo la primera vez
    npm run dev
    ```

| Servicio | URL |
| :--- | :--- |
| Front-End | http://localhost:5173 |
| Back-End | http://localhost:8080 |
| Swagger-UI | http://localhost:8080/swagger-ui.html |

### Opción 2: Ejecución en Docker
Solo requiere tener Docker y Docker Compose instalados. No necesitas PostgreSQL, Java ni Node.js en tu máquina.
```bash
docker-compose up --build
```
Esto levanta automáticamente 3 contenedores:

| Contenedor | Imagen | Puerto |
| :--- | :--- | :--- |
| `citt_db` | PostgreSQL 16 Alpine | 5433:5432 |
| `citt_backend` | Maven + JRE 21 Alpine | 8080:8080 |
| `citt_frontend` | Nginx Alpine | 5173:5173 |

Para detener los contenedores:
```bash
docker-compose down
```

---

## Arquitectura del Proyecto

```text
Sistema-de-Reservas-CITT/
│
├── citt-backend/                          # API REST (Spring Boot)
│   ├── Dockerfile
│   └── src/main/java/cl/duoc/citt/citt_backend/
│       ├── controllers/                   # Endpoints REST
│       │   ├── ArticuloController
│       │   ├── AutenticacionController
│       │   ├── CategoriaController
│       │   ├── EspacioController
│       │   ├── SolicitudController
│       │   ├── UsuarioController
│       │   ├── EstadoArticuloController
│       │   ├── EstadoEspacioController
│       │   └── EstadoSolicitudController
│       ├── dto/                           # Objetos de transferencia de datos
│       ├── exception/                     # Manejo centralizado de errores
│       ├── model/                         # Entidades JPA
│       ├── repositories/                  # Interfaces Spring Data JPA
│       ├── security/                      # JWT, filtros y configuración de seguridad
│       └── services/                      # Lógica de negocio
│
├── citt-frontend/                         # SPA (React + TypeScript)
│   ├── Dockerfile
│   └── src/
│       ├── api/                           # Configuración de Axios
│       ├── componentes/                   # Componentes reutilizables (44)
│       ├── hooks/                         # Custom hooks
│       ├── pages/                         # Vistas principales (12)
│       └── assets/                        # Recursos estáticos
│
├── Documentacion/                         # Diagramas del sistema
│
├── Gestion/                               # Documentación de gestión del proyecto
│
└── docker-compose.yml                     # Orquestación de contenedores
```

### Patrón de arquitectura
*   **Backend:** Arquitectura en capas → Controller → Service → Repository
*   **Frontend:** Arquitectura basada en componentes con separación por páginas
*   **Comunicación:** API REST con autenticación JWT (Access Token + Refresh Token)
*   **Contenedorización:** Docker multi-stage builds con orquestación via Docker Compose

---

## Base de Datos
**Motor:** PostgreSQL 16+ | **ORM:** Hibernate (Spring Data JPA) | **Estrategia DDL:** update (creación automática de tablas)

### Entidades principales
| Tabla | Descripción | Relaciones Clave |
| :--- | :--- | :--- |
| `usuarios` | Usuarios del sistema (implementa UserDetails de Spring Security) | M:N con roles |
| `roles` | Roles de acceso (ALUMNO, DOCENTE, AYUDANTE, COORDINADOR, DIRECTOR) | M:N con usuarios |
| `articulos` | Inventario de artículos del CITT (soft delete) | M:1 con categoria, M:1 con estado_articulo |
| `categoria` | Categorías de artículos (Tecnológico, Mobiliario, etc.) | - |
| `estado_articulo`| Catálogo de estados de un artículo (DISPONIBLE, PRESTADO, DAÑADO, MANTENCIÓN) | - |
| `Espacios` | Espacios reservables (labs, salas, talleres) | M:1 con estado_espacio |
| `estado_espacio` | Catálogo de estados de un espacio | - |
| `solicitud` | Solicitudes de reserva y/o préstamo | M:1 con usuario, M:1 con espacio, M:N con articulo |
| `estado_solicitud` | Catálogo de estados de solicitud | - |
| `requerimiento_articulo` | Detalle de artículos requeridos por solicitud (categoría, marca, cantidad) | M:1 con solicitud, M:1 con categoría |
| `refresh_token` | Tokens de refresco para sesiones JWT | M:1 con usuario |
| `recuperar_password_token` | Tokens temporales para recuperación de contraseña | M:1 con usuario |

### Características destacables
*   **Soft Delete en artículos:** el DELETE se intercepta y marca `eliminado = true` en vez de borrar el registro.
*   **Filtro automático:** las consultas excluyen artículos eliminados via `@SQLRestriction`.

### Diagramas
Los diagramas se encuentran en la carpeta `Documentacion/`.

---

## Documentación de la API
Con el backend en ejecución, la documentación interactiva completa está disponible en:
**Swagger UI:** http://localhost:8080/swagger-ui.html

### Flujo completo: desde el auto-registro hasta la devolución de un artículo
**Endpoints:**

| Paso | Método | Endpoint | Descripción |
| :--- | :--- | :--- | :--- |
| 1 | `POST` | `/api/auth/auto-registro` | El usuario se registra con su correo institucional. Recibe contraseña provisoria por email |
| 2 | `POST` | `/api/auth/login` | Inicia sesión. Los tokens JWT se guardan en cookies HttpOnly |
| 3 | `PUT` | `/api/auth/cambiar-password` | Cambia la contraseña provisoria (obligatorio en el primer ingreso) |
| 4 | `GET` | `/api/espacios` | Consulta los espacios disponibles |
| 5 | `GET` | `/api/solicitudes/calendario` | Visualiza la disponibilidad en el calendario |
| 6 | `POST` | `/api/solicitudes` | Crea una solicitud de reserva de espacio y/o préstamo de artículos |
| 7 | `GET` | `/api/solicitudes/mis-solicitudes`| Consulta el estado de sus solicitudes |
| 8 | `PATCH` | `/api/solicitudes/{id}/estado` | (Admin) Aprueba o rechaza la solicitud |
| 9 | `PATCH` | `/api/solicitudes/{id}/entregar`| (Admin) Asigna los artículos físicos y pasa a EN PROCESO |
| 10 | `PATCH`| `/api/solicitudes/{id}/devolver`| (Admin) Registra la devolución, marca daños si aplica, y finaliza la solicitud |

### Ejemplos de request/response

**Paso 1: Auto-registro**
`POST /api/auth/auto-registro`
```json
// Request
{ "email": "alumno@duocuc.cl" }

// Response 200
{
  "mensaje": "¡Cuenta creada! Revisa tu correo para tu clave provisoria.",
  "email": "alumno@duocuc.cl",
  "roles": ["ALUMNO"]
}
```

**Paso 2: Login**
`POST /api/auth/login`
```json
// Request
{ "email": "alumno@duocuc.cl", "password": "a1b2c3d4" }

// Response 200 (tokens en cookies HttpOnly)
"Login exitoso. Tokens configurados en cookies seguras."
```

**Paso 3: Cambiar contraseña provisoria**
`PUT /api/auth/cambiar-password`
```json
// Request
{ "passwordActual": "a1b2c3d4", "nuevaPassword": "MiClave2026" }

// Response 200
"Contraseña actualizada exitosamente"
```

**Paso 4: Consultar espacios disponibles**
`GET /api/espacios`
```json
// Response 200
[
  { "id": 1, "nombre": "Sala CITT A", "capacidad": 20, "estado": "DISPONIBLE" },
  { "id": 2, "nombre": "Laboratorio IoT", "capacidad": 15, "estado": "DISPONIBLE" }
]
```

**Paso 5: Crear solicitud (espacio + artículos)**
`POST /api/solicitudes`
```json
// Request
{
  "fecha": "2026-06-20",
  "horaInicio": "10:30:00",
  "horaFin": "12:30:00",
  "proposito": "Proyecto IoT semestral",
  "idEspacio": 1,
  "cantidadIntegrantes": 4,
  "exclusividad": false,
  "requerimientos": [
    { "idCategoria": 1, "marca": "Arduino", "cantidad": 2 }
  ]
}

// Response 201
{
  "idSolicitud": 10,
  "fecha": "2026-06-20",
  "horaInicio": "10:30:00",
  "horaFin": "12:30:00",
  "proposito": "Proyecto IoT semestral",
  "estado": "PENDIENTE",
  "emailUsuario": "alumno@duocuc.cl",
  "nombreEspacio": "Sala CITT A",
  "requerimientos": [
    { "idCategoria": 1, "nombreCategoria": "Tecnológico", "marca": "Arduino", "cantidad": 2 }
  ]
}
```

**Paso 6: Aprobar solicitud (Admin)**
`PATCH /api/solicitudes/10/estado`
```json
// Request
{ "idEstadoSolicitud": 2 }

// Response 200 → solicitud con estado "APROBADA"
```

**Paso 7: Entregar artículos físicos (Admin)**
`PATCH /api/solicitudes/10/entregar`
```json
// Request (IDs de los artículos físicos asignados)
[5, 8]

// Response 200 → solicitud con estado "EN PROCESO" y artículos asignados
```

**Paso 8: Devolver artículos (Admin)**
`PATCH /api/solicitudes/10/devolver`
```json
// Request (sin daños)
{ "articulosDanados": [], "espacioDanado": false }

// Request (con daño)
{
  "articulosDanados": [
    { "idArticulo": 5, "comentario": "Pantalla LCD rota" }
  ],
  "espacioDanado": false
}

// Response 200 → solicitud con estado "FINALIZADA"
```

---

## Estructura del equipo
*   **Francisca Carolina Arancibia Chaparro:** Scrum Master y Desarrolladora Backend
*   **Savka Paola Quezada Godoy:** Desarrolladora Frontend
*   **Rafael Ignacio Ríos Fredes:** Desarrollador Backend

---

## Tests / Pruebas

### Backend: Tests unitarios (JUnit + Spring Boot Test)
```bash
cd citt-backend
mvnw.cmd test        # Windows
./mvnw test          # Linux/Mac
```

**Tests disponibles:**
| Archivo | Módulo |
| :--- | :--- |
| `ArticuloControllerTest` | CRUD de artículos |
| `AutenticacionControllerTest`| Registro, login, contraseñas |
| `EspacioControllerTest` | Gestión de espacios |
| `SolicitudControllerTest` | Solicitudes de reserva/préstamo |
| `UsuarioControllerTest` | Gestión de usuarios |

### Frontend: Tests E2E (Cypress + Cucumber/BDD)
```bash
cd citt-frontend

# Modo interactivo (abre la interfaz de Cypress)
npm run cypress:open

# Modo headless (ejecución en terminal)
npm run cypress:run
```
*\* Requiere que tanto el backend como el frontend estén corriendo antes de ejecutar los tests E2E.*

**Escenarios disponibles (archivos `.feature`):**
| Feature | Ejemplo de escenario |
| :--- | :--- |
| `autenticacion.feature` | Ingreso con credenciales correctas → redirige al Dashboard |
| `articulos.feature` | Validación de nombre obligatorio al crear un artículo |
| `espacios.feature` | Gestión de espacios |
| `solicitudes.feature` | Flujo de solicitudes |
| `usuarios.feature` | Gestión de usuarios |

---

## Licencia

Este proyecto fue desarrollado como parte de la asignatura de Proyecto de Título en DuocUC, sede Valparaíso. Todos los derechos reservados.
