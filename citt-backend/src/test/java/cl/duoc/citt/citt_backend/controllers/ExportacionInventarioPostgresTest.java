package cl.duoc.citt.citt_backend.controllers;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@EnabledIfEnvironmentVariable(named = "CITT_PRUEBA_POSTGRES_AISLADO", matches = "true")
class ExportacionInventarioPostgresTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate sql;

    @Test
    void descargaDatosVigentesYDeOrigenSoloParaRolesDeInventario() throws Exception {
        Long categoria = sql.queryForObject("""
                insert into categoria (nombre_categoria, es_tecnologico) values ('Exportación de prueba', true)
                returning id_categoria
                """, Long.class);
        Long articulo = sql.queryForObject("""
                insert into articulo (nombre_articulo, marca, eliminado, id_categoria, id_estado_articulo, comentarios)
                values ('Pizarra de prueba', 'GENERICO', true, ?,
                    (select id_estado_articulo from estado_articulo where nombre_estado='DISPONIBLE'), '=1+1')
                returning id_articulo
                """, Long.class, categoria);
        sql.update("""
                insert into articulo_ficha_activos_fijos (id_articulo, cantidad, observacion)
                values (?, 3, 'Revisar "etiqueta"; al recibir')
                """, articulo);

        String ruta = "/api/articulos/exportar";
        mvc.perform(get(ruta).with(user("alumno").roles("ALUMNO"))).andExpect(status().isForbidden());
        byte[] bytes = mvc.perform(get(ruta).with(user("coordinacion").roles("COORDINADOR")))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"Inventario CITT.csv\""))
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(new String(bytes, StandardCharsets.UTF_8))
                .startsWith("\uFEFF\"ID\";\"Código Duoc\";\"Artículo\"")
                .contains("\"Cantidad (Excel)\"", "\"Pizarra de prueba\";\"Exportación de prueba\";\"DISPONIBLE\";\"Sí\"",
                        "\"'=1+1\"", "\"Revisar \"\"etiqueta\"\"; al recibir\"");
    }
}
