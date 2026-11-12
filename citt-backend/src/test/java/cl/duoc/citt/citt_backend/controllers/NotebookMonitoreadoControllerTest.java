package cl.duoc.citt.citt_backend.controllers;

import cl.duoc.citt.citt_backend.model.Articulo;
import cl.duoc.citt.citt_backend.model.EstadoArticulo;
import cl.duoc.citt.citt_backend.model.NotebookMonitoreado;
import cl.duoc.citt.citt_backend.repositories.NotebookMonitoreadoRepository;
import cl.duoc.citt.citt_backend.security.JwtFiltroAutenticacion;
import cl.duoc.citt.citt_backend.security.JwtUtilidades;
import cl.duoc.citt.citt_backend.security.SecurityConfig;
import cl.duoc.citt.citt_backend.services.NotebookMonitoreadoService;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(NotebookMonitoreadoController.class)
@Import({SecurityConfig.class, JwtFiltroAutenticacion.class, NotebookMonitoreadoService.class})
class NotebookMonitoreadoControllerTest {
    private static final String REPORTES = "/api/notebooks/reportes";
    private static final String UBICACION = "/api/notebooks/ubicacion";
    private static final String TOKEN = "Bearer " + "a".repeat(43);
    @Autowired MockMvc mvc;
    @MockitoBean NotebookMonitoreadoRepository repositorio;
    @MockitoBean JwtUtilidades jwt;
    @MockitoBean UserDetailsService usuarios;
    @MockitoBean AuthenticationProvider proveedor;

    @Test
    void guardaReporteAutorizadoYConservaElMasReciente() throws Exception {
        var notebook = new NotebookMonitoreado();
        notebook.setArticulo(new Articulo());
        when(repositorio.findByHashToken(anyString())).thenReturn(Optional.of(notebook));
        Instant fecha = Instant.now().minusSeconds(30);
        mvc.perform(post(REPORTES).contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", TOKEN).content(reporte(fecha, 78)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.ok").value(true));
        assertThat(notebook.getObservado()).isEqualTo(fecha);
        assertThat(notebook.getReporte().at("/bateria/porcentaje").intValue()).isEqualTo(78);
        assertThat(notebook.getReporte().path("eventos_energia").get(0).path("tipo").asText())
                .isEqualTo("suspension");
        mvc.perform(post(REPORTES).contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", TOKEN).content(reporte(fecha.minusSeconds(60), 90)))
                .andExpect(status().isOk());
        assertThat(notebook.getReporte().at("/bateria/porcentaje").intValue()).isEqualTo(78);
        verifyNoInteractions(jwt);
    }

    @Test
    void rechazaCredencialDesconocida() throws Exception {
        mvc.perform(post(REPORTES).contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", TOKEN).content(reporte(Instant.now(), 78)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void validaBateria() throws Exception {
        var notebook = new NotebookMonitoreado();
        notebook.setArticulo(new Articulo());
        when(repositorio.findByHashToken(anyString())).thenReturn(Optional.of(notebook));
        mvc.perform(post(REPORTES).contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", TOKEN).content(reporte(Instant.now(), 101)))
                .andExpect(status().isBadRequest());
        assertThat(notebook.getReporte()).isNull();
    }

    @Test
    void ubicaSoloElPrestamoExternoVigente() throws Exception {
        var notebook = new NotebookMonitoreado();
        var articulo = new Articulo();
        articulo.setIdArticulo(30L);
        var estado = new EstadoArticulo();
        estado.setNombreEstado("PRESTADO");
        articulo.setEstadoArticulo(estado);
        notebook.setArticulo(articulo);
        var prestamo = mock(NotebookMonitoreadoRepository.PrestamoExterno.class);
        when(prestamo.getArticuloId()).thenReturn(30L);
        when(prestamo.getSolicitudId()).thenReturn(70L);
        when(repositorio.findByHashToken(anyString())).thenReturn(Optional.of(notebook));
        when(repositorio.buscarPrestamoExterno(30L)).thenReturn(Optional.of(70L));
        when(repositorio.listarConArticulo()).thenReturn(List.of(notebook));
        when(repositorio.listarPrestamosExternos()).thenReturn(List.of(prestamo));

        var fecha = Instant.now().minusSeconds(10);
        mvc.perform(post(REPORTES).header("Authorization", TOKEN).contentType(MediaType.APPLICATION_JSON)
                        .content(reporte(fecha, 78)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.prestamoExterno").value(70));
        mvc.perform(post(UBICACION).contentType(MediaType.APPLICATION_JSON).content(ubicacion(70, fecha, 30)))
                .andExpect(status().isUnauthorized());
        mvc.perform(post(UBICACION).header("Authorization", TOKEN).contentType(MediaType.APPLICATION_JSON)
                        .content(ubicacion(69, fecha, 30)))
                .andExpect(status().isConflict());
        mvc.perform(post(UBICACION).header("Authorization", TOKEN).contentType(MediaType.APPLICATION_JSON)
                        .content(ubicacion(70, fecha, 100)))
                .andExpect(status().isBadRequest());
        mvc.perform(post(UBICACION).header("Authorization", TOKEN).contentType(MediaType.APPLICATION_JSON)
                        .content(ubicacion(70, fecha, 30)))
                .andExpect(status().isNoContent());
        mvc.perform(post(REPORTES).header("Authorization", TOKEN).contentType(MediaType.APPLICATION_JSON)
                        .content(reporte(fecha.plusSeconds(1), 77)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/notebooks").with(user("direccion").roles("DIRECTOR")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].ubicacion.latitud").value(30.0))
                .andExpect(jsonPath("$[0].reporte.ubicacion").doesNotExist());

        when(repositorio.buscarPrestamoExterno(30L)).thenReturn(Optional.empty());
        when(repositorio.listarPrestamosExternos()).thenReturn(List.of());
        mvc.perform(get("/api/notebooks").with(user("direccion").roles("DIRECTOR")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].prestamoExterno").value(false))
                .andExpect(jsonPath("$[0].ubicacion").doesNotExist())
                .andExpect(jsonPath("$[0].reporte.ubicacion").doesNotExist());
        mvc.perform(post(UBICACION).header("Authorization", TOKEN).contentType(MediaType.APPLICATION_JSON)
                        .content(ubicacion(70, fecha.plusSeconds(2), 30)))
                .andExpect(status().isConflict());
        mvc.perform(post(REPORTES).header("Authorization", TOKEN).contentType(MediaType.APPLICATION_JSON)
                        .content(reporte(fecha.plusSeconds(3), 76)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.prestamoExterno").doesNotExist());
        assertThat(notebook.getReporte().has("ubicacion")).isFalse();
    }

    @Test
    void soloCoordinacionYDireccionPuedenConsultar() throws Exception {
        mvc.perform(get("/api/notebooks").with(user("alumno").roles("ALUMNO")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/notebooks").with(user("direccion").roles("DIRECTOR")))
                .andExpect(status().isOk());
    }

    @Test
    void vinculaArticuloYEntregaTokenSinGuardarTextoPlano() throws Exception {
        var articulo = new Articulo();
        articulo.setIdArticulo(10L);
        when(repositorio.bloquearArticulo(10L)).thenReturn(Optional.of(articulo));
        var respuesta = mvc.perform(post("/api/notebooks/10/credencial")
                        .with(user("coordinacion").roles("COORDINADOR"))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.identificador").value("CITT-10"))
                .andReturn().getResponse().getContentAsString();
        var guardado = org.mockito.ArgumentCaptor.forClass(NotebookMonitoreado.class);
        org.mockito.Mockito.verify(repositorio).save(guardado.capture());
        assertThat(guardado.getValue().getHashToken()).hasSize(64);
        assertThat(respuesta).doesNotContain(guardado.getValue().getHashToken());
    }

    private String reporte(Instant fecha, int bateria) {
        return """
                {"equipo":"CITT-LAP02","actualizado":"%s","estado":"encendido",
                "bateria":{"porcentaje":%d,"cargador_conectado":false},
                "programas":[{"nombre":"Editor"}],
                "eventos_energia":[{"tipo":"suspension","fecha":"%s"}]}
                """.formatted(fecha, bateria, fecha.minusSeconds(60));
    }

    private String ubicacion(int prestamo, Instant fecha, int latitud) {
        return """
                {"prestamoExterno":%d,"observada":"%s","latitud":%d,"longitud":15,"precisionMetros":30}
                """.formatted(prestamo, fecha, latitud);
    }
}
