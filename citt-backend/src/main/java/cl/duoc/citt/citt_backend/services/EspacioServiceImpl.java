package cl.duoc.citt.citt_backend.services;


import cl.duoc.citt.citt_backend.dto.EspacioRequestDTO;
import cl.duoc.citt.citt_backend.dto.EspacioResponseDTO;
import cl.duoc.citt.citt_backend.dto.EspacioUpdateDTO;
import cl.duoc.citt.citt_backend.dto.EspacioEstadoRequest;
import cl.duoc.citt.citt_backend.exception.ReglaNegocioException;
import cl.duoc.citt.citt_backend.model.Espacio;
import cl.duoc.citt.citt_backend.model.EstadoEspacio;
import cl.duoc.citt.citt_backend.model.Solicitud;
import cl.duoc.citt.citt_backend.repositories.EspacioRepository;
import cl.duoc.citt.citt_backend.repositories.EstadoEspacioRepository;
import cl.duoc.citt.citt_backend.repositories.EstadoSolicitudRepository;
import cl.duoc.citt.citt_backend.repositories.SolicitudRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;


@Service
@RequiredArgsConstructor
public class EspacioServiceImpl implements EspacioService {

    private static final ZoneId ZONA_CITT = ZoneId.of("America/Santiago");

    private final EspacioRepository repository;
    private final EstadoEspacioRepository estadoRepository;
    private final SolicitudRepository solicitudRepository;
    private final EstadoSolicitudRepository estadoSolicitudRepository;

    @Override
    public EspacioResponseDTO crear(EspacioRequestDTO dto){
        // REGLA DE NEGOCIO: Nombre único
        if (repository.existsByNombreIgnoreCase(dto.getNombre().trim())) {
            throw new ReglaNegocioException("Ya existe un espacio registrado con el nombre: " + dto.getNombre());
        }

        EstadoEspacio disponible = estadoRepository.findAll()
                .stream()
                .filter(e -> e.getNombre().equalsIgnoreCase("DISPONIBLE"))
                .findFirst()
                .orElseThrow(() -> new ReglaNegocioException("Estado DISPONIBLE no existe"));

        Espacio espacio = Espacio.builder()
                .nombre(dto.getNombre().trim())
                .comentarios(null) // Nace sin comentarios
                .capacidad(dto.getCapacidad())
                .estado(disponible)
                .build();

        return mapToDTO(repository.save(espacio));
    }


    @Override
    @Transactional(readOnly = true)
    public List<EspacioResponseDTO> listar(String estadoNombre) {
        List<Espacio> lista;

        // Si el frontend envía un estado (ej: ?estado=DAÑADO), filtramos en la lista
        if (estadoNombre != null && !estadoNombre.isEmpty()) {
            lista = repository.findAll().stream()
                    .filter(e -> e.getEstado().getNombre().equalsIgnoreCase(estadoNombre))
                    .collect(Collectors.toList());
        } else {
            // Si no envía nada, listamos todo como antes
            lista = repository.findAll();
        }

        LocalDateTime ahora = LocalDateTime.now(ZONA_CITT);
        List<Solicitud> ocupaciones = ocupacionesActuales(ahora);
        return lista.stream().map(espacio -> mapToDTO(espacio, ocupaciones, ahora)).toList();
    }

    @Override
    public EspacioResponseDTO obtenerPorId(Long id){
        Espacio espacio = repository.findById(id)
                .orElseThrow(() -> new ReglaNegocioException("Espacio no encontrado"));
        return mapToDTO(espacio);
    }

    @Override
    @Transactional
    public EspacioResponseDTO actualizar(Long id, EspacioUpdateDTO dto) {
        Espacio espacio = repository.bloquearPorId(id)
                .orElseThrow(() -> new ReglaNegocioException("Espacio no encontrado"));

        // REGLA DE NEGOCIO: Evitar nombres duplicados en otros IDs
        Optional<Espacio> duplicado = repository.findByNombreIgnoreCase(dto.getNombre().trim());
        if (duplicado.isPresent() && !duplicado.get().getId().equals(id)) {
            throw new ReglaNegocioException("Ya existe otro espacio ocupando el nombre: " + dto.getNombre());
        }

        if (dto.getEstado() != null) {
            EstadoEspacio estado = estadoRepository.findAll().stream()
                    .filter(e -> e.getNombre().equalsIgnoreCase(dto.getEstado()))
                    .findFirst()
                    .orElseThrow(() -> new ReglaNegocioException("Estado no válido: " + dto.getEstado()));

            espacio.setEstado(estado);

            // AUTO-LIMPIEZA: Si el coordinador repara el espacio y lo vuelve DISPONIBLE, borramos el comentario de daño.
            if (estado.getNombre().equalsIgnoreCase("DISPONIBLE")) {
                espacio.setComentarios(null);
            } else {
                espacio.setOcupadoManualmenteHasta(null);
            }
        }

        espacio.setNombre(dto.getNombre().trim());
        espacio.setCapacidad(dto.getCapacidad());

        return mapToDTO(repository.save(espacio));
    }

    @Override
    @Transactional
    public EspacioResponseDTO cambiarEstado(Long id, EspacioEstadoRequest cambio) {
        LocalDateTime ahora = LocalDateTime.now(ZONA_CITT);
        // Las devoluciones también bloquean la solicitud antes de modificar el espacio.
        List<Solicitud> activas = cambio.estado() == EspacioEstadoRequest.Estado.LIBRE
                ? solicitudRepository.idsOcupacionesActualesDelEspacio(id, ahora.toLocalDate(), ahora.toLocalTime())
                    .stream().map(solicitudRepository::bloquearPorId).flatMap(Optional::stream)
                    .filter(solicitud -> sigueEnUso(solicitud, ahora)).toList()
                : List.of();
        Espacio espacio = repository.bloquearPorId(id)
                .orElseThrow(() -> new ReglaNegocioException("Espacio no encontrado"));

        switch (cambio.estado()) {
            case LIBRE -> {
                for (Solicitud solicitud : activas) {
                    if (!solicitud.getEspacio().getId().equals(id)) {
                        throw new ReglaNegocioException("Libera la reserva de todo el CITT desde su espacio principal: "
                                + solicitud.getEspacio().getNombre() + ".", HttpStatus.CONFLICT);
                    }
                    solicitud.setFechaLiberacionEspacio(ahora);
                    if (solicitud.getArticulos().isEmpty() && solicitud.getRequerimientos().isEmpty()) {
                        solicitud.setEstadoSolicitud(estadoSolicitudRepository.findByNombreIgnoreCase("FINALIZADA")
                                .orElseThrow(() -> new ReglaNegocioException("Estado FINALIZADA no configurado.")));
                        solicitud.setFechaDevolucionReal(ahora);
                    }
                }
                espacio.setEstado(estadoOperativo("DISPONIBLE"));
                espacio.setComentarios(null);
                espacio.setOcupadoManualmenteHasta(null);
            }
            case OCUPADO -> {
                if (!"DISPONIBLE".equalsIgnoreCase(espacio.getEstado().getNombre())) {
                    throw new ReglaNegocioException("Marca el espacio como libre antes de ocuparlo.", HttpStatus.CONFLICT);
                }
                if (cambio.minutos() == null) throw new ReglaNegocioException("Indica los minutos de ocupación.");
                LocalDateTime hasta = ahora.plusMinutes(cambio.minutos());
                if (solicitudRepository.contarReservasPosteriores(id, ahora.toLocalDate(), ahora.toLocalTime(),
                        hasta.toLocalDate(), hasta.toLocalTime()) > 0) {
                    throw new ReglaNegocioException("Hay una reserva posterior en ese horario. Reduce la duración de la ocupación.",
                            HttpStatus.CONFLICT);
                }
                espacio.setOcupadoManualmenteHasta(hasta);
            }
            case FUERA_DE_SERVICIO, DANADO -> {
                espacio.setEstado(estadoOperativo(cambio.estado() == EspacioEstadoRequest.Estado.DANADO
                        ? "DAÑADO" : "MANTENCION"));
                espacio.setOcupadoManualmenteHasta(null);
            }
        }
        return mapToDTO(espacio, ocupacionesActuales(ahora), ahora);
    }

    private EstadoEspacio estadoOperativo(String nombre) {
        return estadoRepository.findAll().stream().filter(estado -> nombre.equalsIgnoreCase(estado.getNombre()))
                .findFirst().orElseThrow(() -> new ReglaNegocioException("Estado no configurado: " + nombre));
    }

    private boolean sigueEnUso(Solicitud solicitud, LocalDateTime ahora) {
        if (solicitud.getFechaLiberacionEspacio() != null) return false;
        return switch (solicitud.getEstadoSolicitud().getNombre()) {
            case "EN PROCESO", "ATRASADO" -> true;
            case "APROBADA" -> solicitud.getFecha().equals(ahora.toLocalDate())
                    && !solicitud.getHoraInicio().isAfter(ahora.toLocalTime())
                    && solicitud.getHoraFin().isAfter(ahora.toLocalTime());
            default -> false;
        };
    }

    @Override
    public void eliminar(Long id) {

        Espacio espacio = repository.findById(id)
                .orElseThrow(() -> new ReglaNegocioException("Espacio no encontrado"));

        repository.delete(espacio);
    }

    private EspacioResponseDTO mapToDTO(Espacio espacio) {
        LocalDateTime ahora = LocalDateTime.now(ZONA_CITT);
        return mapToDTO(espacio, ocupacionesActuales(ahora), ahora);
    }

    private List<Solicitud> ocupacionesActuales(LocalDateTime ahora) {
        return solicitudRepository.findOcupacionesActuales(ahora.toLocalDate(), ahora.toLocalTime());
    }

    private EspacioResponseDTO mapToDTO(Espacio espacio, List<Solicitud> ocupaciones, LocalDateTime ahora) {
        boolean manual = espacio.getOcupadoManualmenteHasta() != null && espacio.getOcupadoManualmenteHasta().isAfter(ahora);
        boolean enUso = manual || ocupaciones.stream().anyMatch(solicitud ->
                Boolean.TRUE.equals(solicitud.getExclusividad())
                        || solicitud.getEspacio().getId().equals(espacio.getId()));

        return EspacioResponseDTO.builder()
                .id(espacio.getId())
                .nombre(espacio.getNombre())
                .comentarios(espacio.getComentarios())
                .capacidad(espacio.getCapacidad())
                .estado(espacio.getEstado().getNombre().toUpperCase())
                .enUsoAhora(enUso)
                .build();
    }



}
