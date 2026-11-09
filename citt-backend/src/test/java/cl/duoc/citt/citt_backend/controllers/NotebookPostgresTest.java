package cl.duoc.citt.citt_backend.controllers;

import cl.duoc.citt.citt_backend.model.Articulo;
import cl.duoc.citt.citt_backend.model.Categoria;
import cl.duoc.citt.citt_backend.repositories.ArticuloRepository;
import cl.duoc.citt.citt_backend.repositories.CategoriaRepository;
import cl.duoc.citt.citt_backend.repositories.EstadoArticuloRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "CITT_PRUEBA_POSTGRES_AISLADO", matches = "true")
class NotebookPostgresTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate sql;
    @Autowired ArticuloRepository articulos;
    @Autowired CategoriaRepository categorias;
    @Autowired EstadoArticuloRepository estados;

    @Test
    void vinculaArticuloRecibeReporteYLeeElJsonDePostgres() throws Exception {
        var categoria = new Categoria();
        categoria.setNombreCategoria("Prueba notebooks " + UUID.randomUUID());
        categoria = categorias.save(categoria);
        var articulo = new Articulo();
        articulo.setNombreArticulo("Note Dell de prueba");
        articulo.setMarca("Dell");
        articulo.setCategoria(categoria);
        articulo.setEstadoArticulo(estados.findAll().stream()
                .filter(estado -> "PRESTADO".equals(estado.getNombreEstado())).findFirst().orElseThrow());
        Long articuloId = articulos.save(articulo).getIdArticulo();

        String credencial = mvc.perform(post("/api/notebooks/{articuloId}/credencial", articuloId)
                        .with(user("coordinacion").roles("COORDINADOR"))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String token = json.readTree(credencial).path("clave").asText();

        mvc.perform(post("/api/notebooks/reportes").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"equipo":"CITT-LAP02","actualizado":"%s","estado":"encendido",
                                "bateria":{"porcentaje":78,"cargador_conectado":false},
                                "programas":[{"nombre":"Editor"}]}
                                """.formatted(Instant.now())))
                .andExpect(status().isOk());
        String bateria = sql.queryForObject(
                "select reporte -> 'bateria' ->> 'porcentaje' from notebook_monitoreado where id_articulo = ?",
                String.class, articuloId);
        assertThat(bateria).isEqualTo("78");
        mvc.perform(get("/api/notebooks").with(user("direccion").roles("DIRECTOR")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.idArticulo == " + articuloId + ")].estadoInventario").value("PRESTADO"))
                .andExpect(jsonPath("$[?(@.idArticulo == " + articuloId + ")].reporte.equipo").value("CITT-LAP02"));
    }
}
