package cl.duoc.citt.citt_backend.controllers;

import cl.duoc.citt.citt_backend.model.Categoria;
import cl.duoc.citt.citt_backend.model.RequerimientoArticulo;
import cl.duoc.citt.citt_backend.model.Solicitud;
import cl.duoc.citt.citt_backend.model.Usuario;
import cl.duoc.citt.citt_backend.repositories.CategoriaRepository;
import cl.duoc.citt.citt_backend.repositories.EspacioRepository;
import cl.duoc.citt.citt_backend.repositories.EstadoSolicitudRepository;
import cl.duoc.citt.citt_backend.repositories.SolicitudRepository;
import cl.duoc.citt.citt_backend.repositories.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@EnabledIfEnvironmentVariable(named = "CITT_PRUEBA_POSTGRES_AISLADO", matches = "true")
class EstadoManualEspacioPostgresTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate sql;
    @Autowired EspacioRepository espacios;
    @Autowired SolicitudRepository solicitudes;
    @Autowired EstadoSolicitudRepository estadosSolicitud;
    @Autowired UsuarioRepository usuarios;
    @Autowired CategoriaRepository categorias;

    @Test
    void limitaPermisosYMuestraOcupacionManualEnVisorHastaQueExpira() throws Exception {
        long espacio = espacio("Prueba estado manual");
        cambio(espacio, "ALUMNO", "{\"estado\":\"OCUPADO\",\"minutos\":30}").andExpect(status().isForbidden());
        cambio(espacio, "COORDINADOR", "{\"estado\":\"OCUPADO\",\"minutos\":30}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.enUsoAhora").value(true));
        mvc.perform(get("/api/plano-citt/visor")).andExpect(status().isOk())
                .andExpect(jsonPath("$.espacios[?(@.id == " + espacio + ")].enUsoAhora").value(true));

        var sala = espacios.findById(espacio).orElseThrow();
        sala.setOcupadoManualmenteHasta(ahora().minusMinutes(1));
        espacios.saveAndFlush(sala);
        mvc.perform(get("/api/plano-citt/visor")).andExpect(status().isOk())
                .andExpect(jsonPath("$.espacios[?(@.id == " + espacio + ")].enUsoAhora").value(false));

        cambio(espacio, "DIRECTOR", "{\"estado\":\"FUERA_DE_SERVICIO\"}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("MANTENCION"));
    }

    @Test
    void liberaUnaReservaVigenteSinTocarLasFuturas() throws Exception {
        long espacio = espacio("Prueba reserva vigente");
        Usuario usuario = usuario();
        LocalDateTime ahora = ahora();
        Solicitud vigente = reserva(espacio, usuario, "EN PROCESO", ahora.minusHours(1), false);
        Solicitud futura = reserva(espacio, usuario, "APROBADA", ahora.plusDays(1), false);
        cambio(espacio, "COORDINADOR", "{\"estado\":\"LIBRE\"}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.enUsoAhora").value(false));
        assertThat(vigente.getEstadoSolicitud().getNombre()).isEqualTo("FINALIZADA");
        assertThat(vigente.getFechaDevolucionReal()).isNotNull();
        assertThat(futura.getFechaLiberacionEspacio()).isNull();
        assertThat(futura.getEstadoSolicitud().getNombre()).isEqualTo("APROBADA");
    }

    @Test
    void liberaElEspacioDeUnaSolicitudMixtaYConservaElFlujoDeArticulos() throws Exception {
        long espacio = espacio("Prueba reserva mixta");
        Solicitud mixta = reserva(espacio, usuario(), "EN PROCESO", ahora().minusMinutes(5), false);
        Categoria categoria = categorias.save(new Categoria(null, "Prueba estado manual", false, true));
        mixta.getRequerimientos().add(RequerimientoArticulo.builder()
                .solicitud(mixta).categoria(categoria).marca("Prueba").cantidad(1).build());
        solicitudes.saveAndFlush(mixta);
        cambio(espacio, "DIRECTOR", "{\"estado\":\"LIBRE\"}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.enUsoAhora").value(false));
        assertThat(mixta.getFechaLiberacionEspacio()).isNotNull();
        assertThat(mixta.getEstadoSolicitud().getNombre()).isEqualTo("EN PROCESO");
        assertThat(mixta.getFechaDevolucionReal()).isNull();
        assertThat(solicitudes.findSolicitudesParaCalendario()).doesNotContain(mixta);
    }

    @Test
    void protegeUnaReservaFuturaDeUnaOcupacionManualSolapada() throws Exception {
        long espacio = espacio("Prueba reserva siguiente");
        reserva(espacio, usuario(), "APROBADA", ahora().plusMinutes(10), false);
        cambio(espacio, "COORDINADOR", "{\"estado\":\"OCUPADO\",\"minutos\":30}").andExpect(status().isConflict());
        assertThat(espacios.findById(espacio).orElseThrow().getOcupadoManualmenteHasta()).isNull();
    }

    @Test
    void obligaALiberarUnaExclusividadDesdeSuEspacioPrincipal() throws Exception {
        long principal = espacio("Prueba principal exclusivo");
        long secundario = espacio("Prueba secundario exclusivo");
        Solicitud exclusiva = reserva(principal, usuario(), "EN PROCESO", ahora().minusMinutes(5), true);
        cambio(secundario, "DIRECTOR", "{\"estado\":\"LIBRE\"}").andExpect(status().isConflict());
        assertThat(exclusiva.getFechaLiberacionEspacio()).isNull();
    }

    private ResultActions cambio(long espacio, String rol, String cuerpo) throws Exception {
        return mvc.perform(patch("/api/espacios/{id}/estado", espacio).with(user("prueba").roles(rol))
                .contentType(MediaType.APPLICATION_JSON).content(cuerpo));
    }

    private long espacio(String nombre) {
        return sql.queryForObject("""
                insert into espacios (nombre, capacidad, estado_id)
                select ?, 4, id from estado_espacio where nombre = 'DISPONIBLE' returning id
                """, Long.class, nombre);
    }

    private Usuario usuario() {
        return usuarios.save(Usuario.builder().email("ocupacion-prueba@example.test").password("solo-prueba").build());
    }

    private Solicitud reserva(long espacio, Usuario usuario, String estado, LocalDateTime inicio, boolean exclusiva) {
        return solicitudes.saveAndFlush(Solicitud.builder().espacio(espacios.getReferenceById(espacio))
                .usuario(usuario).fecha(inicio.toLocalDate()).horaInicio(inicio.toLocalTime())
                .horaFin(inicio.plusMinutes(30).toLocalTime()).cantidadIntegrantes(1).exclusividad(exclusiva)
                .estadoSolicitud(estadosSolicitud.findByNombreIgnoreCase(estado).orElseThrow()).build());
    }

    private LocalDateTime ahora() {
        return LocalDateTime.now(ZoneId.of("America/Santiago"));
    }
}
