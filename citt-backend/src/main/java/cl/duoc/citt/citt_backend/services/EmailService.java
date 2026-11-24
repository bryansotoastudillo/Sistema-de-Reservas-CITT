package cl.duoc.citt.citt_backend.services;

import cl.duoc.citt.citt_backend.dto.SolicitudResponseDTO;
import cl.duoc.citt.citt_backend.exception.ReglaNegocioException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class EmailService {

    private static final String NOMBRE_REMITENTE = CatalogoCorreos.texto("remitente");

    @Value("${app.mail.provider:brevo}")
    private String provider = "brevo";

    @Value("${spring.mail.username:}")
    private String gmailUsername;

    private final JavaMailSender mailSender;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    // Configuración de Brevo API — leída desde variables de entorno
    @Value("${brevo.sender-email:citt.ts01@gmail.com}")
    private String remitente;

    @Value("${brevo.api-key}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();

    void enviarCorreo(String destinatario, CorreoCitt correo) throws Exception {
        switch (provider.trim().toLowerCase(java.util.Locale.ROOT)) {
            case "brevo" -> enviarPorBrevo(destinatario, correo);
            case "gmail" -> {
                if (gmailUsername == null || gmailUsername.isBlank()) {
                    throw new IllegalStateException("Falta GMAIL_USERNAME");
                }
                var message = mailSender.createMimeMessage();
                var helper = new MimeMessageHelper(message, "UTF-8");
                helper.setFrom(gmailUsername, NOMBRE_REMITENTE);
                helper.setTo(destinatario);
                helper.setSubject(correo.asunto());
                helper.setText(correo.html(), true);
                mailSender.send(message);
            }
            default -> throw new IllegalArgumentException("Proveedor de correo inválido: use brevo o gmail");
        }
    }
    private void enviarPorBrevo(String destinatario, CorreoCitt correo) throws Exception {
        if (apiKey == null || apiKey.isBlank()) throw new IllegalStateException("Falta BREVO_API_KEY");
        String url = "https://api.brevo.com/v3/smtp/email";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("api-key", apiKey);
        headers.set("accept", "application/json");

        Map<String, Object> body = new HashMap<>();

        Map<String, String> sender = new HashMap<>();
        sender.put("name", NOMBRE_REMITENTE);
        sender.put("email", remitente);
        body.put("sender", sender);

        Map<String, String> to = new HashMap<>();
        to.put("email", destinatario);
        body.put("to", List.of(to));

        body.put("subject", correo.asunto());
        body.put("htmlContent", correo.html());

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        restTemplate.exchange(url, HttpMethod.POST, request, String.class);
    }

    record SolicitudAprobada(SolicitudResponseDTO solicitud, List<String> destinatarios) {
        SolicitudAprobada(SolicitudResponseDTO solicitud) {
            this(solicitud, List.of(solicitud.getEmailUsuario()));
        }
    }

    record SolicitudRechazada(Long id, String motivo, List<String> destinatarios) {}

    @Async
    @TransactionalEventListener
    public void notificarRechazo(SolicitudRechazada evento) {
        evento.destinatarios().forEach(destino -> enviarCorreoRechazo(destino, evento.id(), evento.motivo()));
    }

    @Async
    @TransactionalEventListener
    public void enviarCorreoAprobacion(SolicitudAprobada evento) {
        SolicitudResponseDTO solicitud = evento.solicitud();
        CorreoCitt correo = CorreoSolicitud.aprobada(solicitud);
        for (String destinatario : evento.destinatarios()) {
            try {
                enviarCorreo(destinatario, correo);
                log.info("Confirmación de solicitud #{} enviada a {}", solicitud.getIdSolicitud(), destinatario);
            } catch (Exception e) {
                log.error("Fallo al enviar confirmación de solicitud #{} a {}: {}",
                        solicitud.getIdSolicitud(), destinatario, e.getMessage());
            }
        }
    }

    @Async
    public void enviarCorreoVencimientoSinRetiro(String destinatario, Long idSolicitud, LocalTime horaFin) {
        try {
            enviarCorreo(destinatario, CorreoSolicitud.vencidaSinRetiro(idSolicitud, horaFin));
            log.info("Notificación de vencimiento sin retiro de solicitud #{} enviada a {}", idSolicitud, destinatario);
        } catch (Exception e) {
            log.error("Fallo al enviar vencimiento sin retiro de solicitud #{} a {}: {}",
                    idSolicitud, destinatario, e.getMessage());
        }
    }

    @Async
    public void enviarCorreoRechazo(String destinatario, Long idSolicitud, String motivoRechazo) {
        try {
            enviarCorreo(destinatario, CorreoSolicitud.rechazada(idSolicitud, motivoRechazo));
            log.info("Notificación de rechazo enviada con éxito a {}", destinatario);
        } catch (Exception e) {
            log.error("Fallo al despachar correo de rechazo a {}: {}", destinatario, e.getMessage());
        }
    }

    public void enviarPasswordProvisoria(String destinatario, String password) {
        try {
            enviarCorreo(destinatario, CorreoCitt.desdeCatalogo("cuenta.creada", CorreoCitt.Estado.INFORMATIVO,
                    Map.of(), Map.of(CatalogoCorreos.texto("datos.claveProvisoria"), password)));
            log.info("Correo enviado exitosamente a {}", destinatario);
        } catch (Exception e) {
            log.error("Error crítico al enviar correo a {}: {}", destinatario, e.getMessage());
            throw new ReglaNegocioException(
                    "No se pudo enviar el correo con tu clave. Por favor, intenta más tarde o contacta a soporte."
            );
        }
    }

    public void enviarNuevaClaveProvisoria(String destinatario, String cuenta, String clave) {
        try {
            enviarCorreo(destinatario, CorreoCitt.desdeCatalogo("cuenta.claveProvisoria", CorreoCitt.Estado.INFORMATIVO,
                    Map.of(), Map.of(CatalogoCorreos.texto("datos.correoAcceso"), cuenta,
                            CatalogoCorreos.texto("datos.claveProvisoria"), clave),
                    "https://administracion.cittvalparaiso.cl/"));
        } catch (Exception e) {
            log.warn("No se pudo enviar la clave provisoria a {} ({})", destinatario, e.getClass().getSimpleName());
            throw new ReglaNegocioException("No se pudo enviar la clave provisoria. Intenta más tarde.",
                    org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    public void enviarPasswordRecuperacion(String destinatario, String codigo) {
        try {
            enviarCorreo(destinatario, CorreoCitt.desdeCatalogo("cuenta.recuperacion", CorreoCitt.Estado.INFORMATIVO,
                    Map.of(), Map.of(CatalogoCorreos.texto("datos.codigoRecuperacion"), codigo)));
            log.info("Correo de recuperación enviado exitosamente a {}", destinatario);
        } catch (Exception e) {
            log.error("Error al enviar recuperación a {}: {}", destinatario, e.getMessage());
            throw new ReglaNegocioException(
                    "Error: No se pudo enviar el correo de recuperación."
            );
        }
    }

    @Async
    public void enviarCorreoAtraso(String destinatario, LocalDate fecha, LocalTime horaFin) {
        try {
            enviarCorreo(destinatario, CorreoSolicitud.atrasada(fecha, horaFin));
            log.info("Notificación de atraso enviada con éxito a {}", destinatario);
        } catch (Exception e) {
            log.error("Fallo al despachar correo de atraso a {}: {}", destinatario, e.getMessage());
        }
    }
}
