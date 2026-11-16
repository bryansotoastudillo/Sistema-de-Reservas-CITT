package cl.duoc.citt.citt_backend.controllers;

import cl.duoc.citt.citt_backend.model.Usuario;
import cl.duoc.citt.citt_backend.repositories.UsuarioRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Map;

import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mockStatic;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@EnabledIfEnvironmentVariable(named = "CITT_PRUEBA_POSTGRES_AISLADO", matches = "true")
class RegularizarReservaPostgresTest {
    private static final ZoneId ZONA = ZoneId.of("America/Santiago");
    private static final String RUTA = "/api/solicitudes/regularizacion";
    private static final String CORREO = "regularizacion@example.test";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate sql;
    @Autowired UsuarioRepository usuarios;

    @Test
    void ayudanteRegistraUnUsoEnCursoYSeReflejaEnElPlano() throws Exception {
        long sala = prepararSala();
        LocalDate dia = LocalDate.of(2026, 11, 16);
        LocalDateTime ahora = dia.atTime(14, 0);
        try (var tiempo = mockStatic(LocalDateTime.class, CALLS_REAL_METHODS)) {
            tiempo.when(() -> LocalDateTime.now(ZONA)).thenReturn(ahora);
            mvc.perform(post(RUTA).with(user(CORREO).roles("AYUDANTE")).contentType(MediaType.APPLICATION_JSON)
                            .content(solicitud(sala, dia, "13:30", "14:30")))
                    .andExpect(status().isCreated()).andExpect(jsonPath("$.estado").value("APROBADA"))
                    .andExpect(jsonPath("$.reservaRegularizada").value(true));
            mvc.perform(get("/api/plano-citt/visor"))
                    .andExpect(jsonPath("$.espacios[?(@.id == " + sala + ")].enUsoAhora").value(true));
            LocalDateTime vencida = horaPosterior(dia);
            tiempo.when(() -> LocalDateTime.now(ZONA)).thenReturn(vencida);
            mvc.perform(get("/api/plano-citt/visor"))
                    .andExpect(jsonPath("$.espacios[?(@.id == " + sala + ")].enUsoAhora").value(false));
        }
    }

    @Test
    void directorRegistraUnUsoPasadoEnCalendarioYBloqueaDuplicados() throws Exception {
        long sala = prepararSala();
        LocalDate ayer = LocalDate.now(ZONA).minusDays(1);
        String datos = solicitud(sala, ayer, "12:00", "13:00");
        var direccion = user(CORREO).roles("DIRECTOR");
        String respuesta = mvc.perform(post(RUTA).with(direccion).contentType(MediaType.APPLICATION_JSON).content(datos))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.estado").value("FINALIZADA"))
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(respuesta).get("idSolicitud").asLong();
        mvc.perform(get("/api/solicitudes/calendario").with(direccion))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.idSolicitud == " + id + ")]").isNotEmpty());
        mvc.perform(post(RUTA).with(direccion).contentType(MediaType.APPLICATION_JSON).content(datos))
                .andExpect(status().isConflict());
    }

    @Test
    void laReservaNormalRechazaElPasadoYElAlumnoNoPuedeRegularizar() throws Exception {
        long sala = prepararSala();
        String datos = solicitud(sala, LocalDate.now(ZONA).minusDays(2), "12:00", "13:00");
        mvc.perform(post(RUTA).with(user(CORREO).roles("ALUMNO")).contentType(MediaType.APPLICATION_JSON).content(datos))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/solicitudes").with(user(CORREO).roles("COORDINADOR"))
                        .contentType(MediaType.APPLICATION_JSON).content(datos)).andExpect(status().isBadRequest());
    }

    @Test
    void coordinacionUsaLaReservaNormalParaUnHorarioQueTodaviaNoEmpieza() throws Exception {
        long sala = prepararSala();
        String datos = solicitud(sala, LocalDate.now(ZONA).plusDays(2), "12:00", "13:00");
        mvc.perform(post(RUTA).with(user(CORREO).roles("COORDINADOR")).contentType(MediaType.APPLICATION_JSON).content(datos))
                .andExpect(status().isBadRequest());
    }

    private long prepararSala() {
        usuarios.save(Usuario.builder().email(CORREO).password("solo-prueba").build());
        return sql.queryForObject("""
                insert into espacios (nombre, capacidad, estado_id)
                select 'Prueba sala regularizada', 4, id from estado_espacio where nombre = 'DISPONIBLE' returning id
                """, Long.class);
    }

    private String solicitud(long sala, LocalDate dia, String inicio, String fin) throws Exception {
        return json.writeValueAsString(Map.of("idEspacio", sala, "fecha", dia.toString(),
                "horaInicio", inicio, "horaFin", fin, "cantidadIntegrantes", 2, "proposito", "Uso de prueba"));
    }

    private LocalDateTime horaPosterior(LocalDate dia) {
        return dia.atTime(15, 0);
    }
}
