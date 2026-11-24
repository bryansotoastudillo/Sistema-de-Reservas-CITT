package cl.duoc.citt.citt_backend.services;

import cl.duoc.citt.citt_backend.dto.SolicitudResponseDTO;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CatalogoCorreosTest {
    @ParameterizedTest
    @ValueSource(strings = {"solicitud.pendiente", "solicitud.recibida", "solicitud.aprobada", "solicitud.rechazada",
            "solicitud.vencidaSinRetiro", "solicitud.atrasada", "cuenta.creada", "cuenta.claveProvisoria", "cuenta.recuperacion"})
    void todosLosTiposSeResuelvenSinMarcadoresPendientes(String id) {
        var mensaje = CatalogoCorreos.mensaje(id, Map.of("idSolicitud", "42"));
        assertFalse(mensaje.asunto().contains("{idSolicitud}"));
        var correo = CorreoCitt.desdeCatalogo(id, CorreoCitt.Estado.INFORMATIVO,
                Map.of("idSolicitud", "42"), Map.of("Dato", "<script>{idSolicitud}</script>"));
        assertTrue(correo.html().contains(mensaje.titulo()));
        assertTrue(correo.html().contains(mensaje.etiqueta()));
        assertTrue(correo.html().contains(mensaje.boton()));
        assertTrue(correo.html().contains("&lt;script&gt;{idSolicitud}&lt;/script&gt;"));
        assertFalse(correo.html().contains("<script>"));
    }

    @Test void confirmacionConservaDatosYGoogleCalendar() {
        var solicitud = SolicitudResponseDTO.builder().idSolicitud(42L).fecha(LocalDate.of(2026, 11, 24))
                .horaInicio(LocalTime.of(10, 0)).horaFin(LocalTime.of(11, 0))
                .nombreEspacio("Sala <A>").nombresArticulos(List.of("Notebook")).build();
        var correo = CorreoSolicitud.aprobada(solicitud);
        assertEquals("Reserva #42 confirmada - CITT Duoc UC", correo.asunto());
        assertTrue(correo.html().contains("calendar.google.com/calendar/r/eventedit"));
        assertTrue(correo.html().contains("20261124T130000Z"));
        assertTrue(correo.html().contains("Sala &lt;A&gt;"));
        assertTrue(correo.html().contains("10:00 a 11:00 (Chile continental)"));
    }

    @Test void datosInsertadosNoSeVuelvenAInterpretar() {
        assertEquals("Valor $1 {otro}", CatalogoCorreos.sustituir("Valor {dato}", Map.of("dato", "$1 {otro}")));
        assertThrows(IllegalArgumentException.class, () -> CatalogoCorreos.mensaje("solicitud.aprobada", Map.of()));
        assertThrows(IllegalArgumentException.class, () -> CatalogoCorreos.mensaje("no.existe", Map.of()));
    }

    @ParameterizedTest
    @ValueSource(strings = {"idFaltante", "campoVacio", "variableInvalida", "saltoEnAsunto", "textoFaltante"})
    void fallaAntesDeEnviarSiElCatalogoEsInvalido(String caso) throws Exception {
        var mapper = new ObjectMapper();
        var json = mapper.readTree(getClass().getResourceAsStream("/correos/mensajes.json"));
        var correos = (com.fasterxml.jackson.databind.node.ObjectNode) json.get("correos");
        var mensaje = (com.fasterxml.jackson.databind.node.ObjectNode) correos.get("cuenta.creada");
        switch (caso) {
            case "idFaltante" -> correos.remove("cuenta.creada");
            case "campoVacio" -> mensaje.put("titulo", " ");
            case "variableInvalida" -> mensaje.put("mensaje", "Clave {variableDesconocida}");
            case "saltoEnAsunto" -> mensaje.put("asunto", "Asunto\nOtro");
            case "textoFaltante" -> ((com.fasterxml.jackson.databind.node.ObjectNode) json.get("textos")).remove("marca");
        }
        assertThrows(IllegalArgumentException.class,
                () -> CatalogoCorreos.leer(new ByteArrayInputStream(mapper.writeValueAsBytes(json))));
    }

    @Test void rechazaIdsDuplicadosEnElJson() {
        String json = "{\"textos\":{},\"textos\":{},\"correos\":{}}";
        assertThrows(java.io.IOException.class,
                () -> CatalogoCorreos.leer(new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8))));
    }
}
