package cl.duoc.citt.citt_backend.services;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
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
    @Test void gmailSinUsuarioNoEnvia() {
        ReflectionTestUtils.setField(service, "provider", "gmail");
        assertThrows(IllegalStateException.class, () -> service.enviarCorreo("to@example.com", "Prueba", "Hola"));
        verifyNoInteractions(sender);
    }
}
