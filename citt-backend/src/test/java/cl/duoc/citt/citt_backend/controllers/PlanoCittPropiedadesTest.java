package cl.duoc.citt.citt_backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.jupiter.api.Assertions.*;

class PlanoCittPropiedadesTest {
    private final ObjectMapper json = new ObjectMapper();

    @Test
    void admiteDistribucionesAnterioresYConservaPropiedades() throws Exception {
        var anterior = json.readValue("{\"x\":3,\"y\":4,\"giro\":15}", PlanoCittController.Posicion.class);
        assertNull(anterior.tipo());
        assertTrue(valida("CW-mesa-1", anterior));
        var mueble = new PlanoCittController.Posicion(5d, 6d, 90d, true, "redonda", "#123abc", 100d, 100d, 76d);
        assertTrue(valida("extra-12345678-1234-1234-1234-123456789abc", mueble));
        assertEquals(mueble, json.readValue(json.writeValueAsString(mueble), PlanoCittController.Posicion.class));
        assertTrue(valida("MR", new PlanoCittController.Posicion(0d, 0d, 0d, true, null, null, null, null, null)));
    }

    @Test
    void rechazaPropiedadesInvalidas() {
        assertFalse(valida("CW-mesa-1", new PlanoCittController.Posicion(0d, 0d, 0d, null, null, "red", null, null, null)));
        assertFalse(valida("CW-mesa-1", new PlanoCittController.Posicion(0d, 0d, 0d, null, null, null, -1d, null, null)));
        assertFalse(valida("MR", new PlanoCittController.Posicion(0d, 0d, 0d, null, null, "#123456", null, null, null)));
        assertFalse(valida("extra-12345678-1234-1234-1234-123456789abc", new PlanoCittController.Posicion(0d, 0d, 0d)));
    }

    private boolean valida(String clave, PlanoCittController.Posicion posicion) {
        return Boolean.TRUE.equals(ReflectionTestUtils.invokeMethod(PlanoCittController.class, "posicionValida", clave, posicion));
    }

    @Test void sillaCoworkSeGuardaYSeRecuperaParaElVisor() throws Exception {
        var silla = new PlanoCittController.Posicion(20d, 30d, 15d, false, "sillaCowork", "#ef9347", 50d, 50d, 100d);
        assertTrue(valida("extra-12345678-1234-1234-1234-123456789abc", silla));
        assertEquals(silla, json.readValue(json.writeValueAsString(silla), PlanoCittController.Posicion.class));
        assertFalse(valida("extra-12345678-1234-1234-1234-123456789abc",
                new PlanoCittController.Posicion(0d, 0d, 0d, false, "tipoDesconocido", "#123456", 50d, 50d, 100d)));
    }
}
