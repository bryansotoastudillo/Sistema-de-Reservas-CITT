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
    void recibeReportesYUbicacionSoloDuranteUnPrestamoExterno() throws Exception {
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
        Long solicitud = sql.queryForObject("""
                insert into solicitud (fecha, hora_inicio, hora_fin, exclusividad, destino_externo,
                                       id_estado_solicitud, id_usuario)
                values (current_date, '09:00', '10:00', false, 'Lugar de prueba',
                        (select id_estado_solicitud from estado_solicitud where nombre_estado = 'EN PROCESO'),
                        (select min(id) from usuarios))
                returning id_solicitud
                """, Long.class);
        sql.update("insert into solicitud_articulo (id_solicitud, id_articulo) values (?, ?)", solicitud, articuloId);

        mvc.perform(post("/api/notebooks/reportes").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"equipo":"CITT-LAP02","actualizado":"%s","estado":"encendido",
                                "bateria":{"porcentaje":78,"cargador_conectado":false},
                                "programas":[{"nombre":"Editor"}]}
                                """.formatted(Instant.now())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.prestamoExterno").value(solicitud.intValue()));
        String bateria = sql.queryForObject(
                "select reporte -> 'bateria' ->> 'porcentaje' from notebook_monitoreado where id_articulo = ?",
                String.class, articuloId);
        assertThat(bateria).isEqualTo("78");
        mvc.perform(post("/api/notebooks/ubicacion").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"prestamoExterno":%d,"observada":"%s","latitud":30,"longitud":15,"precisionMetros":20}
                                """.formatted(solicitud, Instant.now())))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/notebooks").with(user("direccion").roles("DIRECTOR")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.idArticulo == " + articuloId + ")].estadoInventario").value("PRESTADO"))
                .andExpect(jsonPath("$[?(@.idArticulo == " + articuloId + ")].reporte.equipo").value("CITT-LAP02"))
                .andExpect(jsonPath("$[?(@.idArticulo == " + articuloId + ")].ubicacion.latitud").value(30.0));

        sql.update("""
                update solicitud set id_estado_solicitud =
                  (select id_estado_solicitud from estado_solicitud where nombre_estado = 'FINALIZADA')
                where id_solicitud = ?
                """, solicitud);
        mvc.perform(get("/api/notebooks").with(user("direccion").roles("DIRECTOR")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.idArticulo == " + articuloId + ")].prestamoExterno").value(false))
                .andExpect(jsonPath("$[?(@.idArticulo == " + articuloId + ")].reporte.ubicacion").doesNotExist());
    }
}
