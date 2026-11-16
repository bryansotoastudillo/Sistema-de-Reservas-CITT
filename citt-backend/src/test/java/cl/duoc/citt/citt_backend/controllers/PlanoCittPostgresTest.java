package cl.duoc.citt.citt_backend.controllers;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@EnabledIfEnvironmentVariable(named = "CITT_PRUEBA_POSTGRES_AISLADO", matches = "true")
class PlanoCittPostgresTest {
    private static final String RUTA = "/api/plano-citt";
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate sql;

    @Test
    void visorPublicoSoloEntregaDistribucionYOcupacion() throws Exception {
        sql.update("delete from distribucion_plano_citt where id = 1");
        sql.update("insert into distribucion_plano_citt values (1, ?, 2)", "{\"P1\":{\"x\":5,\"y\":10,\"giro\":15}}");
        long espacio = sql.queryForObject("""
                insert into espacios (nombre, comentarios, capacidad, estado_id)
                select 'Espacio prueba visor', 'Comentario del personal', 4, e.id
                from estado_espacio e where nombre = 'DISPONIBLE' returning id
                """, Long.class);
        mvc.perform(get(RUTA + "/visor").header("Origin", "https://pantalla.example.test"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "*"))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.revision").value(2))
                .andExpect(jsonPath("$.posiciones.P1.giro").value(15))
                .andExpect(jsonPath("$.consultadoEn").exists())
                .andExpect(jsonPath("$.espacios[?(@.id == " + espacio + ")].enUsoAhora").value(false))
                .andExpect(jsonPath("$.espacios[?(@.id == " + espacio + ")].comentarios").doesNotExist());
        mvc.perform(get(RUTA)).andExpect(status().isForbidden());
        mvc.perform(put(RUTA + "/visor").header("Origin", "https://pantalla.example.test")
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void guardaDistribucionCompartidaYProtegeCambiosConcurrentes() throws Exception {
        sql.update("delete from distribucion_plano_citt where id = 1");
        var coordinacion = user("coordinacion").roles("COORDINADOR");
        String cambios = """
                {"revision":0,"posiciones":{"MR":{"x":12,"y":7},"P2":{"x":-9,"y":17,"giro":15}}}
                """;
        mvc.perform(put(RUTA).with(user("alumno").roles("ALUMNO"))
                        .contentType(MediaType.APPLICATION_JSON).content(cambios))
                .andExpect(status().isForbidden());
        mvc.perform(get(RUTA).with(coordinacion))
                .andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(0));
        mvc.perform(put(RUTA).with(coordinacion).contentType(MediaType.APPLICATION_JSON).content(cambios))
                .andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(1));
        mvc.perform(put(RUTA).with(coordinacion).contentType(MediaType.APPLICATION_JSON).content(cambios))
                .andExpect(status().isConflict());
        mvc.perform(put(RUTA).with(coordinacion).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"revision\":1,\"posiciones\":{\"P4\":{\"x\":0,\"y\":0}}}"))
                .andExpect(status().isBadRequest());
        mvc.perform(get(RUTA).with(user("direccion").roles("DIRECTOR")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posiciones.MR.x").value(12))
                .andExpect(jsonPath("$.posiciones.P2.y").value(17))
                .andExpect(jsonPath("$.posiciones.P2.giro").value(15));
    }
}
