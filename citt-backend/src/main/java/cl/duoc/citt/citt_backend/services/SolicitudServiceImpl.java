package cl.duoc.citt.citt_backend.services;

import cl.duoc.citt.citt_backend.dto.RequerimientoDTO;
import cl.duoc.citt.citt_backend.dto.SolicitudRequestDTO;
import cl.duoc.citt.citt_backend.dto.SolicitudResponseDTO;
import cl.duoc.citt.citt_backend.dto.ActualizarEstadoSolicitudRequestDTO;
import cl.duoc.citt.citt_backend.exception.ReglaNegocioException;
import cl.duoc.citt.citt_backend.model.*;
import cl.duoc.citt.citt_backend.repositories.*;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SolicitudServiceImpl implements SolicitudService {

    private final SolicitudRepository solicitudRepository;
    private final UsuarioRepository usuarioRepository;
    private final EspacioRepository espacioRepository;
    private final ArticuloRepository articuloRepository;
    private final EstadoSolicitudRepository estadoSolicitudRepository;
    private final EstadoEspacioRepository estadoEspacioRepository;
    private final EstadoArticuloRepository estadoArticuloRepository;
    private final CategoriaRepository categoriaRepository;
    private final EmailService emailService;
    private final ApplicationEventPublisher eventos;

    @Override
    @Transactional
    public SolicitudResponseDTO crearSolicitud(SolicitudRequestDTO dto, String emailUsuario) {

        if (dto.getHoraInicio().isAfter(dto.getHoraFin()) || dto.getHoraInicio().equals(dto.getHoraFin())) {
            throw new ReglaNegocioException("La hora de inicio debe ser anterior a la hora de fin.");
        }

        // Validar duración mínima de 15 minutos
        long duracionMinutos = java.time.Duration.between(dto.getHoraInicio(), dto.getHoraFin()).toMinutes();
        if (duracionMinutos < 15) {
            throw new ReglaNegocioException("El mínimo de tiempo de uso de una solicitud es de 15 minutos.");
        }

        LocalTime apertura = LocalTime.of(8, 0);
        LocalTime cierre = LocalTime.of(22, 0);

        if (dto.getHoraInicio().isBefore(apertura) || dto.getHoraFin().isAfter(cierre)) {
            throw new ReglaNegocioException("El horario de reservas del CITT es estrictamente entre las 08:00 y las 22:00 horas.");
        }

        if (dto.getFecha().isBefore(LocalDate.now())) {
            throw new ReglaNegocioException("La fecha de la reserva no puede estar en el pasado.");
        }

        if (dto.getFecha().equals(LocalDate.now()) && dto.getHoraInicio().isBefore(LocalTime.now())) {
            throw new ReglaNegocioException("La hora de inicio de la reserva no puede estar en el pasado.");
        }

        Usuario usuario = usuarioRepository.findByEmail(emailUsuario)
                .orElseThrow(() -> new ReglaNegocioException("Usuario no encontrado"));

        EstadoSolicitud estadoPendiente = estadoSolicitudRepository.findByNombreIgnoreCase("PENDIENTE")
                .orElseThrow(() -> new ReglaNegocioException("Estado PENDIENTE no configurado en la BD."));

        Solicitud solicitud = Solicitud.builder()
                .usuario(usuario)
                .fecha(dto.getFecha())
                .horaInicio(dto.getHoraInicio())
                .horaFin(dto.getHoraFin())
                .proposito(dto.getProposito())
                .estadoSolicitud(estadoPendiente)
                .cantidadIntegrantes(dto.getCantidadIntegrantes() != null ? dto.getCantidadIntegrantes() : 1)
                .exclusividad(dto.getExclusividad() != null ? dto.getExclusividad() : false)
                .articulos(new ArrayList<>())
                .requerimientos(new ArrayList<>())
                .build();

        Boolean pideExclusividad = dto.getExclusividad() != null ? dto.getExclusividad() : false;

        if (pideExclusividad) {
            boolean hasPermission = usuario.getRoles().stream()
                    .anyMatch(r -> {
                        String nombre = r.getNombre().toUpperCase();
                        return nombre.equals("DOCENTE") || nombre.equals("DIRECTOR") || nombre.equals("COORDINADOR");
                    });

            if (!hasPermission) {
                throw new ReglaNegocioException("Solo Docentes, Directores y Coordinadores pueden solicitar la exclusividad del CITT.");
            }
        }

        int exclusividadesExistentes = solicitudRepository.contarExclusividadesActivas(dto.getFecha(), dto.getHoraInicio(), dto.getHoraFin());
        if (exclusividadesExistentes > 0) {
            throw new ReglaNegocioException("El CITT se encuentra reservado por completo con exclusividad institucional en el horario seleccionado.");
        }

        if (dto.getIdEspacio() != null) {
            Espacio espacio = espacioRepository.findById(dto.getIdEspacio())
                    .orElseThrow(() -> new ReglaNegocioException("El espacio solicitado no existe"));

            if (solicitud.getCantidadIntegrantes() > espacio.getCapacidad()) {
                throw new ReglaNegocioException("La cantidad de integrantes supera la capacidad del espacio.");
            }

            if (pideExclusividad) {
                int reservasActivas = solicitudRepository.contarCualquierReservaEnHorario(dto.getFecha(), dto.getHoraInicio(), dto.getHoraFin());
                if (reservasActivas > 0) {
                    throw new ReglaNegocioException("No se puede solicitar la exclusividad del CITT; existen otras reservas comunes agendadas en este bloque horario.");
                }
            } else {
                int choquesSala = solicitudRepository.contarChoquesDeHorario(espacio.getId(), dto.getFecha(), dto.getHoraInicio(), dto.getHoraFin());
                if (choquesSala > 0) {
                    throw new ReglaNegocioException("El espacio seleccionado ya tiene reservas en el horario seleccionado.", org.springframework.http.HttpStatus.CONFLICT);
                }
            }
            solicitud.setEspacio(espacio);

        } else if (pideExclusividad) {
            throw new ReglaNegocioException("Para solicitar la exclusividad del CITT debe seleccionar un espacio físico principal.");
        }

        if (dto.getRequerimientos() != null && !dto.getRequerimientos().isEmpty()) {
            for (RequerimientoDTO req : dto.getRequerimientos()) {

                String marcaNormalizada = req.getMarca() != null ? req.getMarca().trim().toUpperCase() : "GENERICO";

                Categoria cat = categoriaRepository.findById(req.getIdCategoria())
                        .orElseThrow(() -> new ReglaNegocioException("La categoría " + req.getIdCategoria() + " no existe."));

                int stockDisponible = articuloRepository.contarDisponiblesPorCategoriaYMarca(req.getIdCategoria(), marcaNormalizada);

                if (stockDisponible < req.getCantidad()) {
                    throw new ReglaNegocioException("No hay stock suficiente para " + cat.getNombreCategoria() + " marca " + marcaNormalizada +
                            ". Solicitados: " + req.getCantidad() + ", Disponibles: " + stockDisponible, org.springframework.http.HttpStatus.CONFLICT);
                }

                RequerimientoArticulo requerimiento = RequerimientoArticulo.builder()
                        .solicitud(solicitud)
                        .categoria(cat)
                        .marca(marcaNormalizada)
                        .cantidad(req.getCantidad())
                        .build();

                solicitud.getRequerimientos().add(requerimiento);
            }
        }

        if (solicitud.getEspacio() == null && solicitud.getRequerimientos().isEmpty()) {
            throw new ReglaNegocioException("Debe solicitar al menos un espacio o un artículo.");
        }

        // Regla de Uso Externo: Si pide artículos SIN espacio, debe indicar destino externo
        if (solicitud.getEspacio() == null && !solicitud.getRequerimientos().isEmpty()) {
            if (dto.getDestinoExterno() == null || dto.getDestinoExterno().trim().isEmpty()) {
                throw new ReglaNegocioException(
                    "Para solicitar artículos sin un espacio del CITT, debe activar 'Uso externo' e indicar el destino al que llevará los equipos."
                );
            }
            solicitud.setDestinoExterno(dto.getDestinoExterno().trim());
        }

        SolicitudResponseDTO creada = mapToDTO(solicitudRepository.save(solicitud));
        eventos.publishEvent(new NotificacionNuevaSolicitud.SolicitudCreada(creada));
        return creada;
    }

    @Override
    @Transactional(readOnly = true)
    public List<SolicitudResponseDTO> obtenerMisSolicitudes(String emailUsuario) {
        Usuario usuario = usuarioRepository.findByEmail(emailUsuario)
                .orElseThrow(() -> new ReglaNegocioException("Usuario no encontrado"));

        return solicitudRepository.findByUsuarioOrderByFechaDesc(usuario).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<SolicitudResponseDTO> obtenerTodas() {
        return solicitudRepository.findAll(org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "idSolicitud")).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public SolicitudResponseDTO cambiarEstado(Long idSolicitud, ActualizarEstadoSolicitudRequestDTO dto, String emailAdmin) {
        Solicitud solicitud = solicitudRepository.findById(idSolicitud)
                .orElseThrow(() -> new ReglaNegocioException("Solicitud no encontrada"));

        if (solicitud.getUsuario().getEmail().equalsIgnoreCase(emailAdmin)) {
            Usuario adminUser = usuarioRepository.findByEmail(emailAdmin)
                    .orElseThrow(() -> new ReglaNegocioException("Administrador no encontrado"));
            
            boolean esAltaDireccion = adminUser.getRoles().stream()
                    .anyMatch(r -> r.getNombre().equalsIgnoreCase("COORDINADOR") || r.getNombre().equalsIgnoreCase("DIRECTOR"));
            
            if (!esAltaDireccion) {
                throw new ReglaNegocioException("Prohibido: No puedes gestionar (aprobar o rechazar) tus propias solicitudes. Espera a que otro administrador lo haga.");
            } else {
                String log = "[AUDITORÍA] Estado cambiado por auto-gestión de alta dirección (" + emailAdmin + "). ";
                solicitud.setRegistroAutogestion(solicitud.getRegistroAutogestion() == null ? log : solicitud.getRegistroAutogestion() + log);
            }
        } else if (solicitud.getEspacio() != null) {
            Usuario adminUser = usuarioRepository.findByEmail(emailAdmin)
                    .orElseThrow(() -> new ReglaNegocioException("Administrador no encontrado"));
            
            boolean esAltaDireccion = adminUser.getRoles().stream()
                    .anyMatch(r -> r.getNombre().equalsIgnoreCase("COORDINADOR") || r.getNombre().equalsIgnoreCase("DIRECTOR"));
            
            if (!esAltaDireccion) {
                throw new ReglaNegocioException("Prohibido: Solo Coordinadores y Directores pueden gestionar solicitudes de espacios.");
            }
        }

        EstadoSolicitud estadoDb = estadoSolicitudRepository.findById(dto.getIdEstadoSolicitud())
                .orElseThrow(() -> new ReglaNegocioException("El estado con ID '" + dto.getIdEstadoSolicitud() + "' no existe en el sistema."));

        String nombreEstado = estadoDb.getNombre().toUpperCase();

        if (nombreEstado.equals("EN PROCESO") || nombreEstado.equals("FINALIZADA")) {
            throw new ReglaNegocioException("Para pasar a EN PROCESO o FINALIZADA, utilice las opciones de entregar o devolver equipos.");
        }

        if (nombreEstado.equals("RECHAZADA")) {
            if (dto.getMotivo() == null || dto.getMotivo().isBlank()) {
                throw new ReglaNegocioException("Para rechazar o cancelar una solicitud, debe especificar obligatoriamente un motivo explicativo.");
            }
            solicitud.setMotivoRechazo(dto.getMotivo().trim().toUpperCase());
        }

        solicitud.setEstadoSolicitud(estadoDb);
        Solicitud guardada = solicitudRepository.save(solicitud);

        SolicitudResponseDTO dtoResponse = mapToDTO(guardada);

        // 📧 GATILLAR CORREOS AUTOMÁTICOS CONECTADOS A TU EMAILSERVICE REAL
        if (nombreEstado.equals("RECHAZADA")) {
            emailService.enviarCorreoRechazo(
                    dtoResponse.getEmailUsuario(),
                    dtoResponse.getIdSolicitud(),
                    guardada.getMotivoRechazo()
            );
        } else if (nombreEstado.equals("APROBADA")) {
            eventos.publishEvent(new EmailService.SolicitudAprobada(dtoResponse));
        }

        return dtoResponse;
    }

    @Override
    @Transactional
    public SolicitudResponseDTO entregarArticulos(Long idSolicitud, List<Long> idsArticulosEntregados, String emailAdmin) {
        Solicitud solicitud = solicitudRepository.findById(idSolicitud)
                .orElseThrow(() -> new ReglaNegocioException("Solicitud no encontrada"));

        if (solicitud.getUsuario().getEmail().equalsIgnoreCase(emailAdmin)) {
            Usuario adminUser = usuarioRepository.findByEmail(emailAdmin)
                    .orElseThrow(() -> new ReglaNegocioException("Administrador no encontrado"));
            
            boolean esAltaDireccion = adminUser.getRoles().stream()
                    .anyMatch(r -> r.getNombre().equalsIgnoreCase("COORDINADOR") || r.getNombre().equalsIgnoreCase("DIRECTOR"));
            
            if (!esAltaDireccion) {
                throw new ReglaNegocioException("Prohibido: No puedes entregar recursos físicos de tus propias solicitudes.");
            } else {
                String log = "[AUDITORÍA] Recursos entregados por auto-gestión  (" + emailAdmin + "). ";
                solicitud.setRegistroAutogestion(solicitud.getRegistroAutogestion() == null ? log : solicitud.getRegistroAutogestion() + log);
            }
        } else if (solicitud.getEspacio() != null) {
            Usuario adminUser = usuarioRepository.findByEmail(emailAdmin)
                    .orElseThrow(() -> new ReglaNegocioException("Administrador no encontrado"));
            
            boolean esAltaDireccion = adminUser.getRoles().stream()
                    .anyMatch(r -> r.getNombre().equalsIgnoreCase("COORDINADOR") || r.getNombre().equalsIgnoreCase("DIRECTOR"));
            
            if (!esAltaDireccion) {
                throw new ReglaNegocioException("Prohibido: Solo Coordinadores y Directores pueden gestionar solicitudes de espacios.");
            }
        }

        // 1. CONTROL DE FLUJO SOBERANO: Candado de estados
        if (!solicitud.getEstadoSolicitud().getNombre().equalsIgnoreCase("APROBADA")) {
            throw new ReglaNegocioException("Operación rechazada: Solo se pueden entregar recursos para solicitudes que estén estrictamente en estado APROBADA.");
        }

        if (!solicitud.getFecha().equals(LocalDate.now())) {
            throw new ReglaNegocioException("Restricción de tiempo: Solo se pueden retirar los equipos el día agendado para la reserva: " + solicitud.getFecha());
        }

        List<Articulo> articulosFisicos = new ArrayList<>();
        if (idsArticulosEntregados != null && !idsArticulosEntregados.isEmpty()) {
            articulosFisicos = articuloRepository.findAllById(idsArticulosEntregados);

            if (articulosFisicos.size() != idsArticulosEntregados.size()) {
                throw new ReglaNegocioException("Error de consistencia: Uno o más IDs de artículos escaneados no existen en el inventario.");
            }

            // Validar disponibilidad física de cada unidad antes de ser asignada
            for (Articulo art : articulosFisicos) {
                if (!art.getEstadoArticulo().getNombreEstado().equalsIgnoreCase("DISPONIBLE")) {
                    throw new ReglaNegocioException("Conflicto de inventario: El artículo con código " + art.getCodigoDuoc() + " ya se encuentra " + art.getEstadoArticulo().getNombreEstado());
                }
            }
        }

        // 2. CORRESPONDENCIA EXACTA (La Balanza Logística de Requerimientos)
        // Agrupar cantidades solicitadas por la combinación "idCategoria_MARCA"
        java.util.Map<String, Integer> mapaRequeridos = solicitud.getRequerimientos().stream()
                .collect(Collectors.toMap(
                        r -> r.getCategoria().getIdCategoria() + "_" + r.getMarca().trim().toUpperCase(),
                        RequerimientoArticulo::getCantidad,
                        Integer::sum
                ));

        // Agrupar cantidades físicas que el ayudante intenta entregar por la misma combinación
        java.util.Map<String, Integer> mapaEntregados = new java.util.HashMap<>();
        for (Articulo art : articulosFisicos) {
            String clave = art.getCategoria().getIdCategoria() + "_" + art.getMarca().trim().toUpperCase();
            mapaEntregados.put(clave, mapaEntregados.getOrDefault(clave, 0) + 1);
        }

        // Comparar mapas de forma simétrica. Si difieren en marcas, categorías o cantidades, frena el flujo.
        if (!mapaRequeridos.equals(mapaEntregados)) {
            throw new ReglaNegocioException("Discrepancia en recursos: Los artículos físicos escaneados no coinciden en categoría, marca o cantidad exacta con lo especificado en la solicitud original.");
        }

        // 3. CAMBIO DE ESTADOS ATÓMICO (Solo artículos)
        if (!articulosFisicos.isEmpty()) {
            EstadoArticulo prestado = estadoArticuloRepository.findAll().stream()
                    .filter(e -> e.getNombreEstado().equalsIgnoreCase("PRESTADO")).findFirst()
                    .orElseThrow(() -> new ReglaNegocioException("Estado PRESTADO no configurado en la BD."));
            articulosFisicos.forEach(art -> art.setEstadoArticulo(prestado));
            articuloRepository.saveAll(articulosFisicos);
            solicitud.setArticulos(articulosFisicos);
        }

        // NOTA: Ya NO se cambia el estado del espacio a OCUPADO.
        // La disponibilidad temporal del espacio se controla a nivel de solicitudes
        // (la query contarChoquesDeHorario verifica choques por fecha/hora).
        // El estado del espacio solo refleja su condición operativa (DISPONIBLE, DAÑADO, MANTENCION).

        EstadoSolicitud enProceso = estadoSolicitudRepository.findByNombreIgnoreCase("EN PROCESO")
                .orElseThrow(() -> new ReglaNegocioException("Estado EN PROCESO no configurado en la BD."));
        solicitud.setEstadoSolicitud(enProceso);

        return mapToDTO(solicitudRepository.save(solicitud));
    }

    @Override
    @Transactional
    public SolicitudResponseDTO devolverArticulos(Long idSolicitud, cl.duoc.citt.citt_backend.dto.DevolucionRequestDTO dto, String emailAdmin) {
        Solicitud solicitud = solicitudRepository.findById(idSolicitud)
                .orElseThrow(() -> new ReglaNegocioException("Solicitud no encontrada"));

        if (solicitud.getUsuario().getEmail().equalsIgnoreCase(emailAdmin)) {
            Usuario adminUser = usuarioRepository.findByEmail(emailAdmin)
                    .orElseThrow(() -> new ReglaNegocioException("Administrador no encontrado"));
            
            boolean esAltaDireccion = adminUser.getRoles().stream()
                    .anyMatch(r -> r.getNombre().equalsIgnoreCase("COORDINADOR") || r.getNombre().equalsIgnoreCase("DIRECTOR"));
            
            if (!esAltaDireccion) {
                throw new ReglaNegocioException("Prohibido: No puedes gestionar la devolución de tus propias solicitudes.");
            } else {
                String log = "[AUDITORÍA] Devolución recibida por auto-gestión de alta dirección (" + emailAdmin + "). ";
                solicitud.setRegistroAutogestion(solicitud.getRegistroAutogestion() == null ? log : solicitud.getRegistroAutogestion() + log);
            }
        } else if (solicitud.getEspacio() != null) {
            Usuario adminUser = usuarioRepository.findByEmail(emailAdmin)
                    .orElseThrow(() -> new ReglaNegocioException("Administrador no encontrado"));
            
            boolean esAltaDireccion = adminUser.getRoles().stream()
                    .anyMatch(r -> r.getNombre().equalsIgnoreCase("COORDINADOR") || r.getNombre().equalsIgnoreCase("DIRECTOR"));
            
            if (!esAltaDireccion) {
                throw new ReglaNegocioException("Prohibido: Solo Coordinadores y Directores pueden gestionar solicitudes de espacios.");
            }
        }

        // 1. CONTROL DE FLUJO SOBERANO: Evita re-procesar una solicitud finalizada o inactiva
        String estadoActual = solicitud.getEstadoSolicitud().getNombre().toUpperCase();
        if (!estadoActual.equals("EN PROCESO") && !estadoActual.equals("ATRASADO")) {
            throw new ReglaNegocioException("Operación rechazada: Solo se pueden devolver los recursos de una solicitud que esté EN PROCESO o ATRASADO.");
        }

        EstadoArticulo disponibleArt = estadoArticuloRepository.findAll().stream()
                .filter(e -> e.getNombreEstado().equalsIgnoreCase("DISPONIBLE")).findFirst()
                .orElseThrow(() -> new ReglaNegocioException("Estado DISPONIBLE de artículo no configurado en la BD."));
        EstadoArticulo danadoArt = estadoArticuloRepository.findAll().stream()
                .filter(e -> e.getNombreEstado().equalsIgnoreCase("DAÑADO")).findFirst()
                .orElseThrow(() -> new ReglaNegocioException("Estado DAÑADO de artículo no configurado en la BD."));

        // 2. PROCESAMIENTO DE ARTÍCULOS
        if (solicitud.getArticulos() != null && !solicitud.getArticulos().isEmpty()) {
            for (Articulo art : solicitud.getArticulos()) {

                cl.duoc.citt.citt_backend.dto.ArticuloDanadoDTO reporteDano = dto.getArticulosDanados().stream()
                        .filter(a -> a.getIdArticulo().equals(art.getIdArticulo()))
                        .findFirst()
                        .orElse(null);

                if (reporteDano != null) {
                    if (reporteDano.getComentario() == null || reporteDano.getComentario().trim().isEmpty()) {
                        throw new ReglaNegocioException("Justificación obligatoria: Debe ingresar una explicación sobre el daño detectado en el artículo: " + art.getNombreArticulo());
                    }
                    art.setEstadoArticulo(danadoArt);
                    art.setComentarios("DAÑADO EN RESERVA #" + solicitud.getIdSolicitud() + " - MOTIVO: " + reporteDano.getComentario().trim().toUpperCase());
                } else {
                    art.setEstadoArticulo(disponibleArt);
                }
            }
            articuloRepository.saveAll(solicitud.getArticulos());

            // Feature 4: Registrar IDs de artículos dañados en la solicitud
            List<Long> idsDanados = solicitud.getArticulos().stream()
                    .filter(art -> dto.getArticulosDanados().stream()
                            .anyMatch(d -> d.getIdArticulo().equals(art.getIdArticulo())))
                    .map(Articulo::getIdArticulo)
                    .collect(Collectors.toList());
            if (!idsDanados.isEmpty()) {
                solicitud.setIdsArticulosDanados(
                        idsDanados.stream().map(String::valueOf).collect(Collectors.joining(","))
                );
            }
        }

        // 3. PROCESAMIENTO DEL ESPACIO FÍSICO (Solo si se reporta daño)
        // NOTA: Ya NO se revierte el estado del espacio de OCUPADO a DISPONIBLE,
        // porque el espacio nunca fue marcado como OCUPADO. Solo se maneja el caso de daño.
        if (Boolean.TRUE.equals(dto.getEspacioDanado()) && solicitud.getEspacio() != null) {
            if (dto.getComentarioEspacio() == null || dto.getComentarioEspacio().trim().isEmpty()) {
                throw new ReglaNegocioException("Justificación obligatoria: Debe ingresar una explicación detallada indicando qué daños sufrió el espacio físico.");
            }

            EstadoEspacio danadoEspacio = estadoEspacioRepository.findAll().stream()
                    .filter(e -> e.getNombre().equalsIgnoreCase("DAÑADO")).findFirst()
                    .orElseThrow(() -> new ReglaNegocioException("Estado DAÑADO de espacio no configurado en la BD."));

            solicitud.getEspacio().setEstado(danadoEspacio);
            solicitud.getEspacio().setComentarios("DAÑADO EN RESERVA #" + solicitud.getIdSolicitud() + " - MOTIVO: " + dto.getComentarioEspacio().trim().toUpperCase());
            espacioRepository.save(solicitud.getEspacio());

            // Feature 4: Registrar daño del espacio en la solicitud
            solicitud.setEspacioDanadoEnDevolucion(true);
            solicitud.setComentarioDanoEspacio(dto.getComentarioEspacio().trim());
        }

        // Feature 2: Guardar timestamp real de devolución
        solicitud.setFechaDevolucionReal(LocalDateTime.now());

        EstadoSolicitud finalizada = estadoSolicitudRepository.findByNombreIgnoreCase("FINALIZADA")
                .orElseThrow(() -> new ReglaNegocioException("Estado FINALIZADA no configurado en la BD."));
        solicitud.setEstadoSolicitud(finalizada);

        return mapToDTO(solicitudRepository.save(solicitud));
    }

    @Override
    @Transactional(readOnly = true)
    public List<cl.duoc.citt.citt_backend.dto.CalendarioEventoDTO> obtenerEventosCalendario(String emailUsuario) {
        Usuario usuario = null;
        if (emailUsuario != null && !emailUsuario.equals("anonymousUser")) {
             usuario = usuarioRepository.findByEmail(emailUsuario).orElse(null);
        }
        
        boolean isAdminOrStaff = false;
        boolean isAlumno = true;

        if (usuario != null) {
            isAdminOrStaff = usuario.getRoles().stream()
                    .anyMatch(r -> {
                        String nombre = r.getNombre().toUpperCase();
                        return nombre.equals("COORDINADOR") || nombre.equals("DIRECTOR") || nombre.equals("DOCENTE") || nombre.equals("AYUDANTE");
                    });
                    
            isAlumno = usuario.getRoles().stream()
                    .anyMatch(r -> r.getNombre().equalsIgnoreCase("ALUMNO"));
        }
        
        boolean finalIsAdminOrStaff = isAdminOrStaff;
        boolean finalIsAlumno = isAlumno;

        List<Solicitud> solicitudes = solicitudRepository.findSolicitudesParaCalendario();
        
        return solicitudes.stream().map(s -> {
            cl.duoc.citt.citt_backend.dto.CalendarioEventoDTO dto = cl.duoc.citt.citt_backend.dto.CalendarioEventoDTO.builder()
                    .idSolicitud(s.getIdSolicitud())
                    .title(finalIsAlumno && !finalIsAdminOrStaff ? "Ocupado" : s.getProposito())
                    .date(s.getFecha())
                    .start(s.getHoraInicio())
                    .end(s.getHoraFin())
                    .nombreEspacio(s.getEspacio() != null ? s.getEspacio().getNombre() : "CITT Completo")
                    .esExclusivo(finalIsAlumno && !finalIsAdminOrStaff ? false : s.getExclusividad())
                    .build();
                    
            if (finalIsAdminOrStaff) {
                dto.setSolicitanteEmail(s.getUsuario().getEmail());
                dto.setEstadoActual(s.getEstadoSolicitud().getNombre());
            }
            return dto;
        }).collect(Collectors.toList());
    }

    private SolicitudResponseDTO mapToDTO(Solicitud s) {
        return SolicitudResponseDTO.builder()
                .idSolicitud(s.getIdSolicitud())
                .fecha(s.getFecha())
                .horaInicio(s.getHoraInicio())
                .horaFin(s.getHoraFin())
                .proposito(s.getProposito())
                .estado(s.getEstadoSolicitud().getNombre())
                .cantidadIntegrantes(s.getCantidadIntegrantes())
                .exclusividad(s.getExclusividad())
                .emailUsuario(s.getUsuario().getEmail())
                .nombreEspacio(s.getEspacio() != null ? s.getEspacio().getNombre() : null)
                .nombresArticulos(
                        s.getArticulos() != null && !s.getArticulos().isEmpty()
                                ? s.getArticulos().stream().map(Articulo::getNombreArticulo).collect(Collectors.toList())
                                : s.getRequerimientos() != null
                                ? s.getRequerimientos().stream()
                                .map(r -> r.getCantidad() + "x " + r.getCategoria().getNombreCategoria() + " (" + r.getMarca() + ")")
                                .collect(Collectors.toList())
                                : new ArrayList<>()
                )
                .requerimientos(
                        s.getRequerimientos() != null
                                ? s.getRequerimientos().stream().map(r -> {
                            RequerimientoDTO req = new RequerimientoDTO();
                            req.setIdCategoria(r.getCategoria().getIdCategoria());
                            req.setNombreCategoria(r.getCategoria().getNombreCategoria());
                            req.setMarca(r.getMarca());
                            req.setCantidad(r.getCantidad());
                            return req;
                        }).collect(Collectors.toList())
                                : new ArrayList<>()
                )
                .articulosAsignados(
                        s.getArticulos() != null
                                ? s.getArticulos().stream().map(a -> {
                            cl.duoc.citt.citt_backend.dto.ArticuloAsignadoDTO asig = new cl.duoc.citt.citt_backend.dto.ArticuloAsignadoDTO();
                            asig.setIdArticulo(a.getIdArticulo());
                            asig.setNombreArticulo(a.getNombreArticulo());
                            asig.setCodigoDuoc(a.getCodigoDuoc());
                            asig.setMarca(a.getMarca());
                            return asig;
                        }).collect(Collectors.toList())
                                : new ArrayList<>()
                )
                // Feature 2: Timestamp real de devolución
                .fechaDevolucionReal(s.getFechaDevolucionReal())
                // Feature 4: Rastreo de daños por solicitud
                .espacioDanadoEnDevolucion(s.getEspacioDanadoEnDevolucion())
                .comentarioDanoEspacio(s.getComentarioDanoEspacio())
                .idsArticulosDanados(s.getIdsArticulosDanados())
                .motivoRechazo(s.getMotivoRechazo())
                .registroAutogestion(s.getRegistroAutogestion())
                .destinoExterno(s.getDestinoExterno())
                .build();
    }
}
