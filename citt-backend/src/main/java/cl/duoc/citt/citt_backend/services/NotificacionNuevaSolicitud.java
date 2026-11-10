package cl.duoc.citt.citt_backend.services;

import cl.duoc.citt.citt_backend.dto.SolicitudResponseDTO;
import cl.duoc.citt.citt_backend.repositories.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.util.HtmlUtils;

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
        String asunto = "Nueva solicitud #" + solicitud.getIdSolicitud() + " pendiente de revisión - CITT";
        StringBuilder cuerpo = new StringBuilder("Se registró una nueva solicitud en el CITT.\n\n")
                .append("Solicitante: ").append(HtmlUtils.htmlEscape(solicitud.getEmailUsuario())).append('\n')
                .append("Fecha: ").append(solicitud.getFecha()).append('\n')
                .append("Horario: ").append(solicitud.getHoraInicio())
                .append(" a ").append(solicitud.getHoraFin()).append('\n');

        if (solicitud.getNombreEspacio() != null) {
            cuerpo.append("Espacio: ").append(HtmlUtils.htmlEscape(solicitud.getNombreEspacio())).append('\n');
        }
        if (!solicitud.getNombresArticulos().isEmpty()) {
            cuerpo.append("Artículos solicitados:\n");
            for (String articulo : solicitud.getNombresArticulos()) {
                cuerpo.append("- ").append(HtmlUtils.htmlEscape(articulo)).append('\n');
            }
        }
        if (solicitud.getDestinoExterno() != null) {
            cuerpo.append("Destino externo: ").append(HtmlUtils.htmlEscape(solicitud.getDestinoExterno())).append('\n');
        }
        cuerpo.append("\nRevisa la solicitud en el Sistema de Reservas CITT.");

        for (String destinatario : usuarioRepository.findEmailsDeCoordinadoresYDirectores()) {
            try {
                emailService.enviarCorreo(destinatario, asunto, cuerpo.toString());
                log.info("Aviso de nueva solicitud #{} enviado a {}", solicitud.getIdSolicitud(), destinatario);
            } catch (Exception e) {
                log.warn("Fallo al enviar aviso de solicitud #{} a {}: {}",
                        solicitud.getIdSolicitud(), destinatario, e.getMessage());
            }
        }
    }
}
