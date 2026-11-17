package cl.duoc.citt.citt_backend.controllers;

import cl.duoc.citt.citt_backend.exception.ReglaNegocioException;
import cl.duoc.citt.citt_backend.model.Usuario;
import cl.duoc.citt.citt_backend.repositories.RolRepository;
import cl.duoc.citt.citt_backend.repositories.UsuarioRepository;
import cl.duoc.citt.citt_backend.services.EmailService;
import cl.duoc.citt.citt_backend.services.RefreshTokenService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "CITT_PRUEBA_POSTGRES_AISLADO", matches = "true")
class ClaveProvisoriaPostgresTest {
    private static final String RUTA = "/api/usuarios/{id}/clave-provisoria";
    private static final String ALTERNO = "titular@example.test";

    @Autowired MockMvc mvc;
    @Autowired UsuarioRepository usuarios;
    @Autowired RolRepository roles;
    @Autowired PasswordEncoder claves;
    @Autowired RefreshTokenService sesiones;
    @MockitoBean EmailService email;

    @Test
    void exigeAlAdministradorYEnviaUnaClaveValidaAlAlternativoConfirmado() throws Exception {
        Usuario anterior = crearCuenta();
        try {
            String datos = "{\"correoAlternativo\":\"" + ALTERNO + "\",\"titularConfirmado\":true}";
            mvc.perform(post(RUTA, anterior.getId()).with(user("otro@duoc.cl").roles("DIRECTOR"))
                    .contentType(MediaType.APPLICATION_JSON).content(datos)).andExpect(status().isForbidden());
            mvc.perform(post(RUTA, anterior.getId()).with(user("admin@duoc.cl").roles("DIRECTOR"))
                    .contentType(MediaType.APPLICATION_JSON).content(datos.replace("true", "false")))
                    .andExpect(status().isBadRequest());
            verifyNoInteractions(email);
            mvc.perform(post(RUTA, anterior.getId()).with(user("admin@duoc.cl").roles("DIRECTOR"))
                    .contentType(MediaType.APPLICATION_JSON).content(datos))
                    .andExpect(status().isNoContent());
            var clave = ArgumentCaptor.forClass(String.class);
            verify(email).enviarNuevaClaveProvisoria(eq(ALTERNO), eq(anterior.getEmail()), clave.capture());
            Usuario actual = usuarios.findById(anterior.getId()).orElseThrow();
            assertThat(claves.matches(clave.getValue(), actual.getPassword())).isTrue();
            assertThat(actual.getPassword()).isNotEqualTo(anterior.getPassword());
            assertThat(actual.isDebeCambiarPassword()).isTrue();
            assertThat(actual.getVersionAcceso()).isEqualTo(anterior.getVersionAcceso() + 1);
            mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"" + actual.getEmail() + "\",\"password\":\"" + clave.getValue() + "\"}"))
                    .andExpect(status().isOk());
        } finally {
            sesiones.eliminarPorUsuario(anterior.getId());
            usuarios.deleteById(anterior.getId());
        }
    }

    @Test
    void mantieneLaClaveAnteriorCuandoElEnvioFalla() throws Exception {
        Usuario anterior = crearCuenta();
        try {
            doThrow(new ReglaNegocioException("No enviado", HttpStatus.SERVICE_UNAVAILABLE))
                    .when(email).enviarNuevaClaveProvisoria(eq(anterior.getEmail()), eq(anterior.getEmail()), anyString());
            mvc.perform(post(RUTA, anterior.getId()).with(user("admin@duoc.cl").roles("DIRECTOR"))
                            .contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().isServiceUnavailable());
            Usuario actual = usuarios.findById(anterior.getId()).orElseThrow();
            assertThat(actual.getPassword()).isEqualTo(anterior.getPassword());
            assertThat(actual.getVersionAcceso()).isEqualTo(anterior.getVersionAcceso());
            assertThat(actual.isDebeCambiarPassword()).isFalse();
        } finally {
            usuarios.deleteById(anterior.getId());
        }
    }

    private Usuario crearCuenta() {
        return usuarios.saveAndFlush(Usuario.builder().email("prueba-" + UUID.randomUUID() + "@duoc.cl")
                .password(claves.encode("ClaveOriginal"))
                .roles(Set.of(roles.findByNombre("ADMINISTRATIVO").orElseThrow()))
                .debeCambiarPassword(false).build());
    }
}
