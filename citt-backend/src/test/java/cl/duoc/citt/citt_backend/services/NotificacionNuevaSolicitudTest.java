package cl.duoc.citt.citt_backend.services;

import cl.duoc.citt.citt_backend.dto.SolicitudResponseDTO;
import cl.duoc.citt.citt_backend.repositories.UsuarioRepository;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.mail.MailSendException;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.anyString;
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
                .when(correo).enviarCorreoHtml(eq("coordinador@example.com"), anyString(), anyString());

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

        verify(correo).enviarCorreoHtml(eq("coordinador@example.com"), anyString(), anyString());
        verify(correo).enviarCorreoHtml(eq("director@example.com"),
                eq("Nueva solicitud #12 pendiente de revisión - CITT"),
                argThat(cuerpo -> cuerpo.contains("solicitante@example.com")
                        && cuerpo.contains("10:00 a 11:00")
                        && cuerpo.contains("Sala &lt;A&gt;") == (espacio != null)
                        && cuerpo.contains("2x Notebook") == (articulo != null)
                        && cuerpo.contains("Taller &lt;B&gt;") == (destinoExterno != null)
                        && cuerpo.contains("Revisar en Reservas CITT")
                        && !cuerpo.contains("calendar.google.com")));
    }
}
