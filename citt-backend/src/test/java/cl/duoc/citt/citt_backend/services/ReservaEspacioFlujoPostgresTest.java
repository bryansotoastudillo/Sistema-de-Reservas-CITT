package cl.duoc.citt.citt_backend.services;

import cl.duoc.citt.citt_backend.model.*;
import cl.duoc.citt.citt_backend.repositories.SolicitudRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.time.*;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@EnabledIfEnvironmentVariable(named = "CITT_PRUEBA_POSTGRES_AISLADO", matches = "true")
class ReservaEspacioFlujoPostgresTest {
    @Autowired TestEntityManager em;
    @Autowired SolicitudRepository solicitudes;
    private final LocalDate fecha = LocalDate.of(2030,1,15);

    Solicitud crear(String estado) {
        var usuario=em.persist(Usuario.builder().email("prueba@example.test").password("prueba").build());
        var operativo=em.persist(EstadoEspacio.builder().nombre("DISPONIBLE").build());
        var espacio=em.persist(Espacio.builder().nombre("Sala de prueba").capacidad(4).estado(operativo).build());
        var estadoSolicitud=em.persist(EstadoSolicitud.builder().nombre(estado).build());
        return em.persist(Solicitud.builder().usuario(usuario).espacio(espacio).estadoSolicitud(estadoSolicitud)
                .fecha(fecha).horaInicio(LocalTime.of(10,0)).horaFin(LocalTime.of(12,0)).exclusividad(false).build());
    }

    @Test void devolverArticulosAntesNoLiberaElTiempoReservadoDeSala() {
        var s=crear("FINALIZADA");s.setFechaDevolucionReal(fecha.atTime(10,30));em.flush();
        assertEquals(1,solicitudes.findOcupacionesActuales(fecha,LocalTime.of(11,0)).size());
        assertEquals(1,solicitudes.contarChoquesDeHorario(s.getEspacio().getId(),fecha,LocalTime.of(11,0),LocalTime.of(11,30)));
        assertEquals(1,solicitudes.contarChoquesRegularizacion(s.getEspacio().getId(),fecha,LocalTime.of(11,0),LocalTime.of(11,30),fecha.atTime(11,0)));
        assertEquals(1,solicitudes.findSolicitudesParaCalendario().size());
    }

    @ParameterizedTest @ValueSource(strings={"APROBADA","EN PROCESO","ATRASADO","FINALIZADA"})
    void fueraDelHorarioLaSalaQuedaLibreAunqueHayaArticulosPendientes(String estado) {
        crear(estado);em.flush();
        assertTrue(solicitudes.findOcupacionesActuales(fecha,LocalTime.of(9,59)).isEmpty());
        assertEquals(1,solicitudes.findOcupacionesActuales(fecha,LocalTime.of(10,0)).size());
        assertTrue(solicitudes.findOcupacionesActuales(fecha,LocalTime.of(12,0)).isEmpty());
        assertTrue(solicitudes.findOcupacionesActuales(fecha.plusDays(1),LocalTime.of(11,0)).isEmpty());
    }

    @Test void liberarLaSalaManualmenteSeRespetaYLaReservaQuedaEnCalendario() {
        var s=crear("FINALIZADA");s.setFechaLiberacionEspacio(fecha.atTime(10,30));em.flush();
        assertTrue(solicitudes.findOcupacionesActuales(fecha,LocalTime.of(11,0)).isEmpty());
        assertEquals(0,solicitudes.contarChoquesDeHorario(s.getEspacio().getId(),fecha,LocalTime.of(11,0),LocalTime.of(11,30)));
        assertEquals(1,solicitudes.findSolicitudesParaCalendario().size());
    }
}
