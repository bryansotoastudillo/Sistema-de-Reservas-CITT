package cl.duoc.citt.citt_backend.services;

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
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@RecordApplicationEvents
@Transactional
@EnabledIfEnvironmentVariable(named = "CITT_PRUEBA_POSTGRES_AISLADO", matches = "true")
class SolicitanteExternoPostgresTest {
    private static final String RUTA = "/api/solicitudes";
    private static final String ADMIN = "admin@duoc.cl";
    private static final String TERCERO = "persona@example.test";
    private static final String OTRO_DIRECTOR = "director@duoc.cl";

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate sql;
    @Autowired ObjectMapper json;
    @Autowired UsuarioRepository usuarios;
    @Autowired ApplicationEvents eventos;

    @Test
    void soloLaCuentaPrincipalPuedeCrearUnaReservaParaTerceros() throws Exception {
        usuarios.save(Usuario.builder().email(OTRO_DIRECTOR).password("prueba").build());
        Long espacio = sql.queryForObject("""
                insert into espacios (nombre, capacidad, estado_id)
                select 'Sala de solicitante externo', 4, id from estado_espacio where nombre = 'DISPONIBLE' returning id
                """, Long.class);
        String cuerpo = solicitud(Map.of("idEspacio", espacio, "correoSolicitante", TERCERO));
        mvc.perform(post(RUTA).with(user(OTRO_DIRECTOR).roles("DIRECTOR"))
                        .contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                .andExpect(status().isForbidden());
        mvc.perform(post(RUTA).with(user(ADMIN).roles("DIRECTOR"))
                        .contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.emailUsuario").value(TERCERO))
                .andExpect(jsonPath("$.emailCreador").value(ADMIN));
        assertThat(eventos.stream(NotificacionNuevaSolicitud.AvisoSolicitante.class)
                .map(e -> e.solicitud().getEmailUsuario())).containsExactly(TERCERO);
    }

    @Test
    void asignaSolicitanteDeArticuloYEnviaEstadoAQuienesCorresponde() throws Exception {
        Long categoria = sql.queryForObject("""
                insert into categoria (nombre_categoria, es_tecnologico)
                values ('Categoría de prueba externa', true) returning id_categoria
                """, Long.class);
        sql.update("""
                insert into articulo (nombre_articulo, marca, eliminado, id_categoria, id_estado_articulo)
                select 'Artículo externo', 'PRUEBA', false, ?, id_estado_articulo
                from estado_articulo where nombre_estado = 'DISPONIBLE'
                """, categoria);
        String cuerpo = solicitud(Map.of("destinoExterno", "Sala de prueba", "requerimientos",
                List.of(Map.of("idCategoria", categoria, "marca", "PRUEBA", "cantidad", 1))));
        var resultado = mvc.perform(post(RUTA).with(user(ADMIN).roles("DIRECTOR"))
                        .contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                .andExpect(status().isCreated()).andReturn();
        long id = json.readTree(resultado.getResponse().getContentAsString()).get("idSolicitud").asLong();
        String asignacion = json.writeValueAsString(Map.of("correo", TERCERO));
        mvc.perform(patch(RUTA + "/{id}/solicitante", id).with(user(OTRO_DIRECTOR).roles("DIRECTOR"))
                        .contentType(MediaType.APPLICATION_JSON).content(asignacion))
                .andExpect(status().isForbidden());
        for (int intento = 0; intento < 2; intento++) {
            mvc.perform(patch(RUTA + "/{id}/solicitante", id).with(user(ADMIN).roles("DIRECTOR"))
                            .contentType(MediaType.APPLICATION_JSON).content(asignacion))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.emailUsuario").value(TERCERO));
        }
        assertThat(eventos.stream(NotificacionNuevaSolicitud.AvisoSolicitante.class)).hasSize(1);
        Long aprobada = sql.queryForObject("select id_estado_solicitud from estado_solicitud where nombre_estado = 'APROBADA'", Long.class);
        mvc.perform(patch(RUTA + "/{id}/estado", id).with(user(ADMIN).roles("DIRECTOR"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("idEstadoSolicitud", aprobada))))
                .andExpect(status().isOk());
        assertThat(eventos.stream(EmailService.SolicitudAprobada.class)
                .flatMap(e -> e.destinatarios().stream())).containsExactly(ADMIN, TERCERO);
        eventos.clear();
        mvc.perform(patch(RUTA + "/{id}/solicitante", id).with(user(ADMIN).roles("DIRECTOR"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("correo", "corregido@example.test"))))
                .andExpect(status().isOk());
        assertThat(eventos.stream(EmailService.SolicitudAprobada.class)
                .flatMap(e -> e.destinatarios().stream())).containsExactly("corregido@example.test");
    }

    private String solicitud(Map<String, ?> datos) throws Exception {
        var cuerpo = new java.util.HashMap<String, Object>(datos);
        cuerpo.put("fecha", LocalDate.now().plusDays(3));
        cuerpo.put("horaInicio", "10:00");
        cuerpo.put("horaFin", "11:00");
        cuerpo.put("proposito", "Prueba de solicitud");
        return json.writeValueAsString(cuerpo);
    }
}
