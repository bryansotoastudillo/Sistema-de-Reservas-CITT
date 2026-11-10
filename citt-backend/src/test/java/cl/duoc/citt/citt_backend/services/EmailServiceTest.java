package cl.duoc.citt.citt_backend.services;

import cl.duoc.citt.citt_backend.dto.SolicitudResponseDTO;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Properties;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class EmailServiceTest {
    JavaMailSender sender;
    EmailService service;
    @BeforeEach void setup() {
        sender = mock(JavaMailSender.class);
        service = new EmailService(sender);
    }
    @Test void brevoEsPredeterminado() throws Exception {
        ReflectionTestUtils.setField(service, "apiKey", "test-key");
        ReflectionTestUtils.setField(service, "remitente", "sender@example.com");
        var server = MockRestServiceServer.bindTo((RestTemplate) ReflectionTestUtils.getField(service, "restTemplate")).build();
        server.expect(requestTo("https://api.brevo.com/v3/smtp/email"))
            .andExpect(header("api-key", "test-key"))
            .andExpect(jsonPath("$.to[0].email").value("to@example.com"))
            .andExpect(jsonPath("$.htmlContent").value("Hola<br>CITT"))
            .andRespond(withSuccess());
        service.enviarCorreo("to@example.com", "Prueba", "Hola\nCITT");
        server.verify();
        verifyNoInteractions(sender);
    }
    @Test void gmailEnviaHtmlConRemitenteConfigurado() throws Exception {
        ReflectionTestUtils.setField(service, "provider", "gmail");
        ReflectionTestUtils.setField(service, "gmailUsername", "sender@example.com");
        var message = new MimeMessage(Session.getInstance(new Properties()));
        when(sender.createMimeMessage()).thenReturn(message);
        service.enviarCorreo("to@example.com", "Prueba", "Hola\nCITT");
        verify(sender).send(message);
        assertEquals("Prueba", message.getSubject());
        assertEquals("to@example.com", message.getAllRecipients()[0].toString());
        assertTrue(message.getFrom()[0].toString().contains("sender@example.com"));
        assertEquals("Hola<br>CITT", message.getContent());
    }
    @Test void proveedorInvalidoNoEnvia() {
        ReflectionTestUtils.setField(service, "provider", "otro");
        assertThrows(IllegalArgumentException.class, () -> service.enviarCorreo("to@example.com", "Prueba", "Hola"));
        verifyNoInteractions(sender);
    }

    @ParameterizedTest
    @CsvSource({
            "2026-01-15, 20260115T130000Z%2F20260115T143000Z",
            "2026-07-15, 20260715T140000Z%2F20260715T153000Z"
    })
    void aprobacionIncluyeCalendarioConHoraDeChile(LocalDate fecha, String fechasUtc) throws Exception {
        ReflectionTestUtils.setField(service, "provider", "gmail");
        ReflectionTestUtils.setField(service, "gmailUsername", "sender@example.com");
        var message = new MimeMessage(Session.getInstance(new Properties()));
        when(sender.createMimeMessage()).thenReturn(message);
        var solicitud = SolicitudResponseDTO.builder()
                .idSolicitud(42L)
                .emailUsuario("to@example.com")
                .fecha(fecha)
                .horaInicio(LocalTime.of(10, 0))
                .horaFin(LocalTime.of(11, 30))
                .nombreEspacio("Sala <A> & B")
                .nombresArticulos(List.of("2x Notebook"))
                .build();

        service.enviarCorreoAprobacion(new EmailService.SolicitudAprobada(solicitud));

        verify(sender).send(message);
        assertEquals("Reserva #42 confirmada - CITT Duoc UC", message.getSubject());
        String html = (String) message.getContent();
        assertTrue(html.contains("<table role=\"presentation\""));
        assertTrue(html.contains("Sala &lt;A&gt; &amp; B"));
        assertTrue(html.contains("2x Notebook"));
        assertTrue(html.contains("Agregar a Google Calendar"));
        assertTrue(html.contains("https://calendar.google.com/calendar/r/eventedit?action=TEMPLATE&amp;dates=" + fechasUtc));
        assertTrue(html.contains("&amp;stz=America%2FSantiago&amp;etz=America%2FSantiago"));
        assertTrue(html.contains("Sala%20%3CA%3E%20%26%20B"));
        assertFalse(html.contains("to@example.com"));
    }
    @Test void gmailSinUsuarioNoEnvia() {
        ReflectionTestUtils.setField(service, "provider", "gmail");
        assertThrows(IllegalStateException.class, () -> service.enviarCorreo("to@example.com", "Prueba", "Hola"));
        verifyNoInteractions(sender);
    }
}
