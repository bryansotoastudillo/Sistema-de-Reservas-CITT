package cl.duoc.citt.citt_backend.services;

import cl.duoc.citt.citt_backend.dto.SolicitudResponseDTO;
import cl.duoc.citt.citt_backend.repositories.UsuarioRepository;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.mail.MailSendException;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificacionNuevaSolicitudTest {

    @ParameterizedTest
    @CsvSource({
            "Sala <A>, ,",
            ", 2x Notebook, Taller <B>",
            "Sala <A>, 2x Notebook,"
    })
    void avisaAlSiguienteResponsableAunqueFalleElPrimerEnvio(
            String espacio, String articulo, String destinoExterno) throws Exception {
        UsuarioRepository usuarios = mock(UsuarioRepository.class);
        EmailService correo = mock(EmailService.class);
        when(usuarios.findEmailsDeCoordinadoresYDirectores())
                .thenReturn(List.of("coordinador@example.com", "director@example.com"));
        doThrow(new MailSendException("Fallo simulado"))
                .when(correo).enviarCorreo(eq("coordinador@example.com"), any(CorreoCitt.class));

        SolicitudResponseDTO solicitud = SolicitudResponseDTO.builder()
                .idSolicitud(12L)
                .emailUsuario("solicitante@example.com")
                .fecha(LocalDate.of(2026, 11, 12))
                .horaInicio(LocalTime.of(10, 0))
                .horaFin(LocalTime.of(11, 0))
                .nombreEspacio(espacio)
                .nombresArticulos(articulo == null ? List.of() : List.of(articulo))
                .destinoExterno(destinoExterno)
                .build();
        new NotificacionNuevaSolicitud(usuarios, correo)
                .notificar(new NotificacionNuevaSolicitud.SolicitudCreada(solicitud));

        verify(correo).enviarCorreo(eq("coordinador@example.com"), any(CorreoCitt.class));
        verify(correo).enviarCorreo(eq("director@example.com"), argThat(enviado -> {
            String html = enviado.html();
            return enviado.asunto().equals("Nueva solicitud #12 pendiente de revisión - CITT")
                    && html.contains("solicitante@example.com")
                    && html.contains("10:00 a 11:00")
                    && html.contains("Sala &lt;A&gt;") == (espacio != null)
                    && html.contains("2x Notebook") == (articulo != null)
                    && html.contains("Taller &lt;B&gt;") == (destinoExterno != null)
                    && html.contains("Revisar en Reservas CITT")
                    && !html.contains("calendar.google.com");
        }));
    }
}
