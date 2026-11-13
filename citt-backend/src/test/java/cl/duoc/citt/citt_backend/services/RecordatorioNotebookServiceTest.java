package cl.duoc.citt.citt_backend.services;

import cl.duoc.citt.citt_backend.model.EstadoSolicitud;
import cl.duoc.citt.citt_backend.model.Solicitud;
import cl.duoc.citt.citt_backend.model.Usuario;
import cl.duoc.citt.citt_backend.repositories.NotebookMonitoreadoRepository;
import cl.duoc.citt.citt_backend.repositories.SolicitudRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.support.TransactionTemplate;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class RecordatorioNotebookServiceTest {
    private final SolicitudRepository solicitudes = mock(SolicitudRepository.class);
    private final NotebookMonitoreadoRepository notebooks = mock(NotebookMonitoreadoRepository.class);
    private final EmailService correo = mock(EmailService.class);
    private final RecordatorioNotebookService servicio =
            new RecordatorioNotebookService(solicitudes, notebooks, correo, mock(TransactionTemplate.class));
    private final LocalDateTime vence = LocalDateTime.of(2026, 11, 13, 16, 0);
    private final String solicitante = "prueba@example.test";

    @Test
    void enviaUnSoloCorreoDentroDeLaVentana() throws Exception {
        var solicitud = solicitud("EN PROCESO");
        when(solicitudes.bloquearPorId(12L)).thenReturn(Optional.of(solicitud));
        when(notebooks.nombresPrestados(12L)).thenReturn(List.of("CITT-LAP02", "CITT-LAP04"));
        servicio.enviar(12L, vence.minusMinutes(31));
        servicio.enviar(12L, vence);
        verifyNoInteractions(correo);

        servicio.enviar(12L, vence.minusMinutes(30));
        servicio.enviar(12L, vence.minusMinutes(25));
        var mensaje = ArgumentCaptor.forClass(CorreoCitt.class);
        verify(correo).enviarCorreo(eq(solicitante), mensaje.capture());
        assertThat(mensaje.getValue().html()).contains("CITT-LAP02", "CITT-LAP04", "16:00", "Duoc UC");
        assertThat(solicitud.getRecordatorioNotebookEnviado()).isNotNull();
    }

    @Test
    void reintentaUnFalloYOmiteUnPrestamoDevuelto() throws Exception {
        var solicitud = solicitud("EN PROCESO");
        when(solicitudes.bloquearPorId(12L)).thenReturn(Optional.of(solicitud));
        when(notebooks.nombresPrestados(12L)).thenReturn(List.of("CITT-LAP02"));
        doThrow(new IllegalStateException()).doNothing().when(correo).enviarCorreo(eq(solicitante), any());
        servicio.enviar(12L, vence.minusMinutes(25));
        assertThat(solicitud.getRecordatorioNotebookEnviado()).isNull();
        servicio.enviar(12L, vence.minusMinutes(20));
        assertThat(solicitud.getRecordatorioNotebookEnviado()).isNotNull();

        when(solicitudes.bloquearPorId(12L)).thenReturn(Optional.of(solicitud("FINALIZADA")));
        servicio.enviar(12L, vence.minusMinutes(15));
        verify(correo, times(2)).enviarCorreo(eq(solicitante), any());
    }

    private Solicitud solicitud(String estado) {
        return Solicitud.builder().idSolicitud(12L).fecha(vence.toLocalDate()).horaFin(vence.toLocalTime())
                .estadoSolicitud(EstadoSolicitud.builder().nombre(estado).build())
                .usuario(Usuario.builder().email(solicitante).build()).build();
    }
}
