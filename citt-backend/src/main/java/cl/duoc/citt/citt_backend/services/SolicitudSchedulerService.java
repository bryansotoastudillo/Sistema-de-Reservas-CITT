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
 * 1. Artículos retirados cuya hora de fin ya pasó → ATRASADO
 * 2. Detecta solicitudes PENDIENTE cuya hora de fin ya pasó → RECHAZADA (nunca se aceptó)
 * 3. Espacios aprobados vencidos → FINALIZADA, sin aviso de retiro/devolución.
 * 4. Artículos aprobados sin retiro → FINALIZADA y aviso de plazo de retiro vencido.
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
        EstadoSolicitud finalizada = estadoSolicitudRepository
                .findByNombreIgnoreCase("FINALIZADA").orElse(null);

        if (enProceso == null || atrasado == null || rechazada == null || finalizada == null) {
            return;
        }

        LocalDateTime ahora = LocalDateTime.now(ZoneId.of("America/Santiago"));

        // --- Lógica existente: EN PROCESO → ATRASADO ---
        List<Solicitud> enProcesoList = solicitudRepository.findByEstadoSolicitud(enProceso);
        for (Solicitud s : enProcesoList) {
            LocalDateTime limiteDevolucion = LocalDateTime.of(s.getFecha(), s.getHoraFin());

            if (!ahora.isBefore(limiteDevolucion)) {
                if (!s.tieneArticulosRetirados()) {
                    finalizar(s, finalizada);
                    continue;
                }
                s.setEstadoSolicitud(atrasado);
                solicitudRepository.save(s);

                s.correosNotificacion().forEach(correo -> emailService.enviarCorreoAtraso(
                        correo,
                        s.getFecha(),
                        s.getHoraFin()
                ));

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

                    s.correosNotificacion().forEach(correo ->
                            emailService.enviarCorreoRechazo(correo, s.getIdSolicitud(), s.getMotivoRechazo()));

                    log.info("Solicitud #{} RECHAZADA automáticamente (PENDIENTE vencida, hora fin: {})",
                            s.getIdSolicitud(), s.getHoraFin());
                }
            }
        }

        // La aprobación de un espacio no exige retiro ni devolución de recursos físicos.
        if (aprobada != null) {
            List<Solicitud> aprobadasList = solicitudRepository.findByEstadoSolicitud(aprobada);
            for (Solicitud s : aprobadasList) {
                LocalDateTime limiteHora = LocalDateTime.of(s.getFecha(), s.getHoraFin());
                if (!ahora.isBefore(limiteHora)) {
                    boolean retiroPendiente = s.tieneArticulos() && !s.tieneArticulosRetirados();
                    if (s.tieneArticulosRetirados()) {
                        s.setEstadoSolicitud(atrasado);
                        solicitudRepository.save(s);
                        s.correosNotificacion().forEach(correo -> emailService.enviarCorreoAtraso(correo, s.getFecha(), s.getHoraFin()));
                        continue;
                    }
                    if (retiroPendiente) s.setMotivoRechazo("PLAZO DE RETIRO VENCIDO: NO SE REGISTRÓ EL RETIRO DE LOS ARTÍCULOS ANTES DE " + s.getHoraFin() + ".");
                    finalizar(s, finalizada);

                    if (retiroPendiente) s.correosNotificacion().forEach(correo ->
                            emailService.enviarCorreoVencimientoSinRetiro(correo, s.getIdSolicitud(), s.getHoraFin()));

                    log.info("Solicitud #{} FINALIZADA automáticamente (hora fin: {})",
                            s.getIdSolicitud(), s.getHoraFin());
                }
            }
        }
        // Corregir registros antiguos de espacios que se hubieran marcado como atrasados.
        for (Solicitud s : solicitudRepository.findByEstadoSolicitud(atrasado)) {
            if (!s.tieneArticulosRetirados() && !ahora.isBefore(s.getFecha().atTime(s.getHoraFin()))) finalizar(s, finalizada);
        }
    }

    private void finalizar(Solicitud s, EstadoSolicitud finalizada) {
        s.setEstadoSolicitud(finalizada);
        if (s.getEspacio() != null && s.getFechaLiberacionEspacio() == null) {
            s.setFechaLiberacionEspacio(s.getFecha().atTime(s.getHoraFin()));
        }
        solicitudRepository.save(s);
    }
}
