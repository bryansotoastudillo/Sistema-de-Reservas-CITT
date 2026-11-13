package cl.duoc.citt.citt_backend.services;

import cl.duoc.citt.citt_backend.model.EstadoSolicitud;
import cl.duoc.citt.citt_backend.model.Solicitud;
import cl.duoc.citt.citt_backend.repositories.EstadoSolicitudRepository;
import cl.duoc.citt.citt_backend.repositories.SolicitudRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

/**
 * Servicio programado que:
 * 1. Detecta solicitudes EN PROCESO cuya hora de fin ya pasó → ATRASADO
 * 2. Detecta solicitudes PENDIENTE cuya hora de fin ya pasó → RECHAZADA (nunca se aceptó)
 * 3. Detecta solicitudes APROBADA cuya hora de fin ya pasó → RECHAZADA (nunca se retiró)
 * Se ejecuta cada 5 minutos.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SolicitudSchedulerService {

    private final SolicitudRepository solicitudRepository;
    private final EstadoSolicitudRepository estadoSolicitudRepository;
    private final EmailService emailService;

    @Scheduled(fixedRate = 300000) // cada 5 minutos (300,000 ms)
    @Transactional
    public void detectarSolicitudesVencidas() {
        EstadoSolicitud enProceso = estadoSolicitudRepository
                .findByNombreIgnoreCase("EN PROCESO").orElse(null);
        EstadoSolicitud atrasado = estadoSolicitudRepository
                .findByNombreIgnoreCase("ATRASADO").orElse(null);
        EstadoSolicitud pendiente = estadoSolicitudRepository
                .findByNombreIgnoreCase("PENDIENTE").orElse(null);
        EstadoSolicitud aprobada = estadoSolicitudRepository
                .findByNombreIgnoreCase("APROBADA").orElse(null);
        EstadoSolicitud rechazada = estadoSolicitudRepository
                .findByNombreIgnoreCase("RECHAZADA").orElse(null);

        if (enProceso == null || atrasado == null || rechazada == null) {
            return;
        }

        LocalDateTime ahora = LocalDateTime.now(ZoneId.of("America/Santiago"));

        // --- Lógica existente: EN PROCESO → ATRASADO ---
        List<Solicitud> enProcesoList = solicitudRepository.findByEstadoSolicitud(enProceso);
        for (Solicitud s : enProcesoList) {
            LocalDateTime limiteDevolucion = LocalDateTime.of(s.getFecha(), s.getHoraFin());

            if (ahora.isAfter(limiteDevolucion)
                    && solicitudRepository.marcarAtrasada(s.getIdSolicitud(), enProceso, atrasado) == 1) {
                emailService.enviarCorreoAtraso(
                        s.getUsuario().getEmail(),
                        s.getFecha(),
                        s.getHoraFin()
                );

                log.info("Solicitud #{} marcada como ATRASADA (fecha: {}, hora fin: {})",
                        s.getIdSolicitud(), s.getFecha(), s.getHoraFin());
            }
        }

        // --- PENDIENTE → RECHAZADA (nunca se aceptó a tiempo) ---
        if (pendiente != null) {
            List<Solicitud> pendientesList = solicitudRepository.findByEstadoSolicitud(pendiente);
            for (Solicitud s : pendientesList) {
                LocalDateTime limiteHora = LocalDateTime.of(s.getFecha(), s.getHoraFin());
                if (ahora.isAfter(limiteHora)) {
                    s.setEstadoSolicitud(rechazada);
                    s.setMotivoRechazo("RECHAZADA AUTOMÁTICAMENTE: LA SOLICITUD NO FUE REVISADA ANTES DEL HORARIO LÍMITE (" + s.getHoraFin() + ").");
                    solicitudRepository.save(s);

                    emailService.enviarCorreoRechazo(
                            s.getUsuario().getEmail(), s.getIdSolicitud(), s.getMotivoRechazo()
                    );

                    log.info("Solicitud #{} RECHAZADA automáticamente (PENDIENTE vencida, hora fin: {})",
                            s.getIdSolicitud(), s.getHoraFin());
                }
            }
        }

        // --- APROBADA → RECHAZADA (aceptada pero nunca se retiraron los recursos) ---
        if (aprobada != null) {
            List<Solicitud> aprobadasList = solicitudRepository.findByEstadoSolicitud(aprobada);
            for (Solicitud s : aprobadasList) {
                LocalDateTime limiteHora = LocalDateTime.of(s.getFecha(), s.getHoraFin());
                if (ahora.isAfter(limiteHora)) {
                    s.setEstadoSolicitud(rechazada);
                    s.setMotivoRechazo("RECHAZADA AUTOMÁTICAMENTE: LA SOLICITUD FUE APROBADA PERO LOS RECURSOS NUNCA FUERON RETIRADOS ANTES DEL HORARIO LÍMITE (" + s.getHoraFin() + ").");
                    solicitudRepository.save(s);

                    emailService.enviarCorreoRechazo(
                            s.getUsuario().getEmail(), s.getIdSolicitud(), s.getMotivoRechazo()
                    );

                    log.info("Solicitud #{} RECHAZADA automáticamente (APROBADA sin retiro, hora fin: {})",
                            s.getIdSolicitud(), s.getHoraFin());
                }
            }
        }
    }
}
