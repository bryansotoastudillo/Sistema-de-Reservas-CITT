package cl.duoc.citt.citt_backend.controllers;

import java.nio.charset.StandardCharsets;
import java.io.ByteArrayOutputStream;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
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
    void actualizaDesdeCsvXlsxYEdicionManual() throws Exception {
        var rol = user("direccion").roles("DIRECTOR");
        Long categoria = sql.queryForObject("""
                insert into categoria (nombre_categoria, es_tecnologico) values ('Prueba importación', true)
                returning id_categoria
                """, Long.class);
        Long estado = sql.queryForObject("select id_estado_articulo from estado_articulo where nombre_estado='DISPONIBLE'", Long.class);
        Long id = sql.queryForObject("""
                insert into articulo (nombre_articulo, codigo_duoc, marca, eliminado, id_categoria, id_estado_articulo)
                values ('Activo CSV', 'CITT-TEST-1', 'GENERICO', false, ?, ?) returning id_articulo
                """, Long.class, categoria, estado);
        var csv = new MockMultipartFile("archivo", "Inventario CITT.csv", "text/csv", """
                ID;Código Duoc;Artículo;Ubicación registrada (Excel)
                %s;CITT-TEST-1;Activo CSV;Bodega
                """.formatted(id).getBytes(StandardCharsets.UTF_8));
        mvc.perform(multipart("/api/articulos/importar").file(csv).with(user("alumno").roles("ALUMNO")))
                .andExpect(status().isForbidden());
        mvc.perform(multipart("/api/articulos/importar").file(csv).with(rol))
                .andExpect(status().isOk()).andExpect(jsonPath("$.actualizados").value(1));
        var libro = new ByteArrayOutputStream();
        try (var excel = new XSSFWorkbook()) {
            var hoja = excel.createSheet("CITT");
            var cabecera = hoja.createRow(0);
            cabecera.createCell(0).setCellValue("N° ACTIVO");
            cabecera.createCell(1).setCellValue("NOMBRE ACTIVO FIJO");
            cabecera.createCell(2).setCellValue("CANTIDAD");
            cabecera.createCell(3).setCellValue("CONFIRMAR UBICACIÓN");
            var fila = hoja.createRow(1);
            fila.createCell(0).setCellValue("CITT-TEST-1");
            fila.createCell(1).setCellValue("Activo XLSX");
            fila.createCell(2).setCellValue(2);
            fila.createCell(3).setCellValue("Sala 2");
            excel.write(libro);
        }
        mvc.perform(multipart("/api/articulos/importar").file(new MockMultipartFile("archivo", "activos.xlsx",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", libro.toByteArray())).with(rol))
                .andExpect(status().isOk()).andExpect(jsonPath("$.actualizados").value(1));
        String ficha = "/api/articulos/" + id + "/ficha-activo";
        mvc.perform(get(ficha).with(rol)).andExpect(status().isOk())
                .andExpect(jsonPath("$.cantidad").value(2))
                .andExpect(jsonPath("$.ubicacionRegistrada").value("Bodega"))
                .andExpect(jsonPath("$.confirmarUbicacion").value("Sala 2"));
        mvc.perform(put("/api/articulos/" + id).with(rol).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                        {"nombreArticulo":"Activo manual","idCategoria":%s,"idEstadoArticulo":%s,
                         "fichaActivo":{"cantidad":2,"ubicacionRegistrada":"Bodega","confirmarUbicacion":"Sala 3"}}
                        """.formatted(categoria, estado)))
                .andExpect(status().isOk());
        var exportado = mvc.perform(get("/api/articulos/exportar").with(rol)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(new String(exportado, StandardCharsets.UTF_8)).contains("ACTIVO MANUAL", "Sala 3");
    }

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
