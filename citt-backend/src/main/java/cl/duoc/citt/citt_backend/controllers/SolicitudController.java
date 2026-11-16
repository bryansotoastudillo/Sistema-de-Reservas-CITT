package cl.duoc.citt.citt_backend.controllers;

import cl.duoc.citt.citt_backend.dto.ActualizarEstadoSolicitudRequestDTO;
import cl.duoc.citt.citt_backend.dto.RegularizarReservaRequest;
import cl.duoc.citt.citt_backend.dto.SolicitudRequestDTO;
import cl.duoc.citt.citt_backend.dto.SolicitudResponseDTO;
import cl.duoc.citt.citt_backend.services.SolicitudService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/solicitudes")
@RequiredArgsConstructor
@Tag(name = "Solicitudes", description = "Operaciones para gestión de reservas de espacios y préstamos de artículos")
public class SolicitudController {

    private final SolicitudService solicitudService;

    @Operation(summary = "Crear nueva solicitud", description = "El alumno o docente crea una reserva para espacio, artículos o ambos.")
    @PostMapping
    public ResponseEntity<SolicitudResponseDTO> crearSolicitud(@Valid @RequestBody SolicitudRequestDTO dto) {
        // Obtenemos el correo del usuario logueado usando el JWT
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return new ResponseEntity<>(solicitudService.crearSolicitud(dto, email), HttpStatus.CREATED);
    }

    @PostMapping("/regularizacion")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'AYUDANTE', 'DIRECTOR')")
    public ResponseEntity<SolicitudResponseDTO> regularizarReserva(@Valid @RequestBody RegularizarReservaRequest dto) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return ResponseEntity.status(HttpStatus.CREATED).body(solicitudService.regularizarReserva(dto, email));
    }

    @Operation(summary = "Ver mis solicitudes", description = "Devuelve el historial de solicitudes del usuario autenticado.")
    @GetMapping("/mis-solicitudes")
    public ResponseEntity<List<SolicitudResponseDTO>> misSolicitudes() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return ResponseEntity.ok(solicitudService.obtenerMisSolicitudes(email));
    }

    @Operation(summary = "Listar todas las solicitudes (Admin)", description = "Permite a los administradores ver todas las reservas.")
    @GetMapping
    @PreAuthorize("hasAnyRole('AYUDANTE', 'DOCENTE', 'COORDINADOR', 'DIRECTOR')")
    public ResponseEntity<List<SolicitudResponseDTO>> obtenerTodas() {
        return ResponseEntity.ok(solicitudService.obtenerTodas());
    }

    @Operation(summary = "Cambiar estado de solicitud (Admin)", description = "Aprueba, rechaza o finaliza una solicitud.")
    @PatchMapping("/{id}/estado")
    @PreAuthorize("hasAnyRole('AYUDANTE', 'DOCENTE', 'COORDINADOR', 'DIRECTOR')")
    public ResponseEntity<SolicitudResponseDTO> cambiarEstado(
            @PathVariable Long id,
            @Valid @RequestBody ActualizarEstadoSolicitudRequestDTO dto) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return ResponseEntity.ok(solicitudService.cambiarEstado(id, dto, email));
    }

    @Operation(summary = "Entregar recursos físicos", description = "Asigna los IDs físicos exactos y pasa la solicitud a EN PROCESO.")
    @PatchMapping("/{id}/entregar")
    @PreAuthorize("hasAnyRole('AYUDANTE', 'DOCENTE', 'COORDINADOR', 'DIRECTOR')")
    public ResponseEntity<SolicitudResponseDTO> entregarRecursos(
            @PathVariable Long id,
            @RequestBody List<Long> idsArticulosFisicos) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return ResponseEntity.ok(solicitudService.entregarArticulos(id, idsArticulosFisicos, email));
    }

    @Operation(summary = "Devolver recursos", description = "Recibe los artículos, permite marcar cuáles se dañaron con su justificación y pasa la solicitud a FINALIZADA.")
    @PatchMapping("/{id}/devolver")
    @PreAuthorize("hasAnyRole('AYUDANTE', 'DOCENTE', 'COORDINADOR', 'DIRECTOR')")
    public ResponseEntity<SolicitudResponseDTO> devolverRecursos(
            @PathVariable Long id,
            @RequestBody(required = false) cl.duoc.citt.citt_backend.dto.DevolucionRequestDTO dto) {

        // Si el admin no envía body (todo volvió en perfecto estado)
        if(dto == null) {
            dto = new cl.duoc.citt.citt_backend.dto.DevolucionRequestDTO();
        }
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return ResponseEntity.ok(solicitudService.devolverArticulos(id, dto, email));
    }

    @Operation(summary = "Obtener eventos para el calendario", description = "Retorna reservas de espacios aprobadas o en uso. Filtra datos sensibles si no es Admin.")
    @GetMapping("/calendario")
    public ResponseEntity<List<cl.duoc.citt.citt_backend.dto.CalendarioEventoDTO>> obtenerEventosCalendario() {
        String email = null;
        if (SecurityContextHolder.getContext().getAuthentication() != null) {
            email = SecurityContextHolder.getContext().getAuthentication().getName();
        }
        return ResponseEntity.ok(solicitudService.obtenerEventosCalendario(email));
    }

}
