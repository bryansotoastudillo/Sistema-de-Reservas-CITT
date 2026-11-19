package cl.duoc.citt.citt_backend.services;

import org.junit.jupiter.api.Test;

import java.time.LocalTime;

import static org.junit.jupiter.api.Assertions.*;

class CorreoSolicitudVencidaTest {
    @Test
    void vencimientoSinRetiroUsaElMensajeAprobado() {
        var correo = CorreoSolicitud.vencidaSinRetiro(23L, LocalTime.of(18, 15));

        assertEquals("Venció el plazo de tu solicitud #23 · CITT Duoc UC", correo.asunto());
        assertTrue(correo.html().contains("Finalizó el horario de tu solicitud"));
        assertTrue(correo.html().contains("Plazo vencido"));
        assertTrue(correo.html().contains("no se registró el retiro de los recursos"));
        assertTrue(correo.html().contains("Si utilizaste los recursos, contacta al equipo CITT para regularizar el registro."));
        assertTrue(correo.html().contains("Si aún los necesitas, puedes realizar una nueva solicitud."));
        assertTrue(correo.html().contains("Hora de término"));
        assertTrue(correo.html().contains("18:15"));
        assertFalse(correo.html().toLowerCase().contains("rechazad"));
    }

    @Test
    void rechazoConMotivoConservaSuMensaje() {
        var correo = CorreoSolicitud.rechazada(24L, "Equipamiento en mantención");

        assertTrue(correo.asunto().contains("rechazada"));
        assertTrue(correo.html().contains("Tu solicitud fue rechazada"));
        assertTrue(correo.html().contains("Equipamiento en mantención"));
        assertFalse(correo.html().contains("Plazo vencido"));
    }
}
