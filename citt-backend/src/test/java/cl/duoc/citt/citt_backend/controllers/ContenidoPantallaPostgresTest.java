package cl.duoc.citt.citt_backend.controllers;

import cl.duoc.citt.citt_backend.model.Usuario;
import cl.duoc.citt.citt_backend.repositories.RolRepository;
import cl.duoc.citt.citt_backend.repositories.UsuarioRepository;
import cl.duoc.citt.citt_backend.security.JwtUtilidades;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "CITT_PRUEBA_POSTGRES_AISLADO", matches = "true")
class ContenidoPantallaPostgresTest {
    private static final String RUTA = "/api/contenido-pantalla";
    @TempDir static Path archivos;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JwtUtilidades jwt;
    @Autowired UsuarioRepository usuarios;
    @Autowired RolRepository roles;

    @DynamicPropertySource
    static void directorio(DynamicPropertyRegistry registro) {
        registro.add("CITT_PANTALLA_DIR", () -> archivos.toString());
    }

    @Test
    @Transactional
    void publicaReemplazaOrdenaYRetiraImagenesConPermisos() throws Exception {
        var coordinacion = user("coordinacion").roles("COORDINADOR");
        var direccion = user("direccion").roles("DIRECTOR");
        mvc.perform(multipart(RUTA).file(imagen("Rechazada.png")).with(user("alumno").roles("ALUMNO")))
                .andExpect(status().isForbidden());
        mvc.perform(get(RUTA)).andExpect(status().isForbidden());
        mvc.perform(multipart(RUTA).file(new MockMultipartFile("archivo", "falsa.png", "image/png", new byte[]{1, 2}))
                .with(coordinacion)).andExpect(status().isBadRequest());

        String primero = mvc.perform(multipart(RUTA).file(imagen("Primera.png")).with(coordinacion))
                .andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(1))
                .andReturn().getResponse().getContentAsString();
        var original = json.readTree(primero).get("imagenes").get(0);
        String id = original.get("id").asText();
        String archivoOriginal = original.get("archivo").asText();
        assertThat(Files.readAllBytes(archivos.resolve(archivoOriginal))).isEqualTo(imagen("x").getBytes());
        String vistaPrevia = RUTA + "/archivos/" + archivoOriginal;
        Usuario usuario = usuarios.save(Usuario.builder().email("prueba-pantalla@example.test")
                .password("solo-prueba").debeCambiarPassword(false)
                .roles(Set.of(roles.findByNombre("DIRECTOR").orElseThrow())).build());
        mvc.perform(get(vistaPrevia)).andExpect(status().isForbidden());
        mvc.perform(get(vistaPrevia).cookie(new Cookie("auth_token", jwt.generarToken(usuario))))
                .andExpect(status().isOk()).andExpect(content().contentType("image/png"));

        mvc.perform(multipart(RUTA).file(imagen("Segunda.png")).with(direccion))
                .andExpect(status().isOk()).andExpect(jsonPath("$.imagenes.length()").value(2));
        mvc.perform(patch(RUTA + "/{id}/orden", id).contentType("application/json")
                        .content("{\"desplazamiento\":1}").with(coordinacion))
                .andExpect(status().isOk()).andExpect(jsonPath("$.imagenes[0].nombre").value("Segunda.png"));
        String reemplazo = mvc.perform(multipart(org.springframework.http.HttpMethod.PUT, RUTA + "/{id}", id)
                        .file(imagen("Reemplazo.png")).with(direccion))
                .andExpect(status().isOk()).andExpect(jsonPath("$.imagenes[1].id").value(id))
                .andExpect(jsonPath("$.imagenes[1].nombre").value("Reemplazo.png"))
                .andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(reemplazo).get("imagenes").get(1).get("archivo").asText()).isNotEqualTo(archivoOriginal);
        assertThat(archivos.resolve(archivoOriginal)).exists();

        mvc.perform(delete(RUTA + "/{id}", id).with(coordinacion))
                .andExpect(status().isOk()).andExpect(jsonPath("$.imagenes.length()").value(1))
                .andExpect(jsonPath("$.revision").value(5));
        assertThat(json.readTree(archivos.resolve("catalogo.json").toFile()).get("imagenes").get(0).get("nombre").asText())
                .isEqualTo("Segunda.png");
    }

    private MockMultipartFile imagen(String nombre) throws IOException {
        var salida = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(16, 9, BufferedImage.TYPE_INT_RGB), "png", salida);
        return new MockMultipartFile("archivo", nombre, "image/png", salida.toByteArray());
    }
}
