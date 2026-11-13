package cl.duoc.citt.citt_backend.services;

import cl.duoc.citt.citt_backend.dto.SolicitudResponseDTO;
import cl.duoc.citt.citt_backend.repositories.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionalEventListener;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificacionNuevaSolicitud {

    private final UsuarioRepository usuarioRepository;
    private final EmailService emailService;

    record SolicitudCreada(SolicitudResponseDTO solicitud) {}

    @Async
    @TransactionalEventListener
    public void notificar(SolicitudCreada evento) {
        SolicitudResponseDTO solicitud = evento.solicitud();
        CorreoCitt correo = CorreoSolicitud.pendiente(solicitud);

        for (String destinatario : usuarioRepository.findEmailsDeCoordinadoresYDirectores()) {
            try {
                emailService.enviarCorreo(destinatario, correo);
                log.info("Aviso de nueva solicitud #{} enviado a {}", solicitud.getIdSolicitud(), destinatario);
            } catch (Exception e) {
                log.warn("Fallo al enviar aviso de solicitud #{} a {}: {}",
                        solicitud.getIdSolicitud(), destinatario, e.getMessage());
            }
        }
    }
}
