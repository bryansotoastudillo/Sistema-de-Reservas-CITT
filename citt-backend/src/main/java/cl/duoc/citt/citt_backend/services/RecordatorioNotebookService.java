package cl.duoc.citt.citt_backend.services;

import cl.duoc.citt.citt_backend.repositories.NotebookMonitoreadoRepository;
import cl.duoc.citt.citt_backend.repositories.SolicitudRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@RequiredArgsConstructor
@Slf4j
public class RecordatorioNotebookService {
    private static final ZoneId ZONA_CITT = ZoneId.of("America/Santiago");
    private static final Duration ANTICIPACION = Duration.ofMinutes(30);
    private final SolicitudRepository solicitudes;
    private final NotebookMonitoreadoRepository notebooks;
    private final EmailService correo;
    private final TransactionTemplate transaccion;

    @Scheduled(fixedDelay = 300_000)
    public void enviarProximos() {
        LocalDateTime ahora = LocalDateTime.now(ZONA_CITT);
        for (Long id : solicitudes.prestamosConRecordatorioPendiente(
                ahora.toLocalDate(), ahora.plus(ANTICIPACION).toLocalDate())) {
            try {
                transaccion.executeWithoutResult(estado -> enviar(id, LocalDateTime.now(ZONA_CITT)));
            } catch (RuntimeException e) {
                log.warn("No se pudo registrar el recordatorio de la solicitud #{}", id, e);
            }
        }
    }

    void enviar(Long id, LocalDateTime ahora) {
        var solicitud = solicitudes.bloquearPorId(id).orElse(null);
        if (solicitud == null || solicitud.getRecordatorioNotebookEnviado() != null
                || !"EN PROCESO".equals(solicitud.getEstadoSolicitud().getNombre())) return;
        var vencimiento = solicitud.getFecha().atTime(solicitud.getHoraFin());
        if (!vencimiento.isAfter(ahora) || vencimiento.isAfter(ahora.plus(ANTICIPACION))) return;

        var equipos = notebooks.nombresPrestados(id);
        if (equipos.isEmpty()) return;
        try {
            correo.enviarCorreo(solicitud.getUsuario().getEmail(), CorreoSolicitud.recordatorioNotebook(
                    id, solicitud.getFecha(), solicitud.getHoraFin(), String.join(", ", equipos)));
            solicitud.setRecordatorioNotebookEnviado(Instant.now());
        } catch (Exception e) {
            log.warn("No se pudo enviar el recordatorio de la solicitud #{} ({})", id, e.getClass().getSimpleName());
        }
    }
}
