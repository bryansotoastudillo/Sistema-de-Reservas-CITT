package cl.duoc.citt.citt_backend.controllers;

import cl.duoc.citt.citt_backend.model.Usuario;
import cl.duoc.citt.citt_backend.repositories.RolRepository;
import cl.duoc.citt.citt_backend.repositories.UsuarioRepository;
import cl.duoc.citt.citt_backend.security.JwtUtilidades;
import cl.duoc.citt.citt_backend.services.EmailService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.dominios.correos-manuales=excepcion@example.test")
@AutoConfigureMockMvc
@Transactional
@EnabledIfEnvironmentVariable(named = "CITT_PRUEBA_POSTGRES_AISLADO", matches = "true")
class DominiosInstitucionalesPostgresTest {
    @Autowired MockMvc mvc;
    @Autowired UsuarioRepository usuarios;
    @Autowired RolRepository roles;
    @Autowired JwtUtilidades jwt;
    @Autowired PasswordEncoder claves;
    @MockitoBean EmailService correo;

    @Test
    void asignaElRolDeDominioAunqueSeEnvienRolesAdicionales() throws Exception {
        var coordinacion = user("coord").roles("COORDINADOR");
        mvc.perform(post("/api/auth/registro").with(coordinacion).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"personal@duoc.cl\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.roles[0]").value("ADMINISTRATIVO"));
        mvc.perform(post("/api/auth/registro").with(coordinacion).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"estudiante@duocuc.cl\",\"rolesNombres\":[\"AYUDANTE\"]}"))
                .andExpect(status().isOk());
        assertThat(usuarios.findByEmail("estudiante@duocuc.cl").orElseThrow().nombresRoles())
                .containsExactlyInAnyOrder("ALUMNO", "AYUDANTE");
        mvc.perform(get("/api/auth/dominios-registro").with(coordinacion))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.dominio == 'duoc.cl')].rol").value("ADMINISTRATIVO"));
    }

    @Test
    void autorregistroAsignaAlumnoDocenteYAdministrativo() throws Exception {
        mvc.perform(post("/api/auth/auto-registro").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"estudiante@duocuc.cl\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.roles[0]").value("ALUMNO"));
        mvc.perform(post("/api/auth/auto-registro").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"docente@profesor.duoc.cl\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.roles[0]").value("DOCENTE"));
        mvc.perform(post("/api/auth/auto-registro").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"personal@duoc.cl\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.roles[0]").value("ADMINISTRATIVO"));
        var cuenta = usuarios.findByEmail("personal@duoc.cl").orElseThrow();
        assertThat(cuenta.isDebeCambiarPassword()).isTrue();
        verify(correo).enviarPasswordProvisoria(eq("personal@duoc.cl"), anyString());
        mvc.perform(get("/api/usuarios").cookie(new Cookie("auth_token", jwt.generarToken(cuenta))))
                .andExpect(status().isForbidden());
    }

    @Test
    void administrativoConservaSuIdentidadYHeredaPermisosDeGestion() throws Exception {
        var cuenta = usuarios.save(Usuario.builder().email("personal@duoc.cl")
                .password(claves.encode("Prueba12345")).debeCambiarPassword(false)
                .roles(Set.of(roles.findByNombre("ADMINISTRATIVO").orElseThrow())).build());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"personal@duoc.cl\",\"password\":\"Prueba12345\"}"))
                .andExpect(status().isOk());
        var cookie = new Cookie("auth_token", jwt.generarToken(cuenta));
        mvc.perform(get("/api/auth/perfil").cookie(cookie)).andExpect(status().isOk())
                .andExpect(jsonPath("$.roles.length()").value(1))
                .andExpect(jsonPath("$.roles[0]").value("ADMINISTRATIVO"));
        mvc.perform(get("/api/plano-citt").cookie(cookie)).andExpect(status().isOk());
        mvc.perform(get("/api/usuarios").cookie(cookie)).andExpect(status().isOk());
        mvc.perform(patch("/api/usuarios/{id}/estado", cuenta.getId()).cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"habilitado\":false}"))
                .andExpect(status().isForbidden());
        assertThat(cuenta.tienePermisoDe("DOCENTE")).isTrue();
    }

    @Test
    void registroYLoginComparanElDominioCompleto() throws Exception {
        String externo = "cuenta@duoc.cl.example";
        usuarios.save(Usuario.builder().email(externo).password(claves.encode("Prueba12345")).build());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + externo + "\",\"password\":\"Prueba12345\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/registro").with(user("coord").roles("COORDINADOR"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"otra@duocuc.cl.example\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void unaExcepcionIndividualRequiereRolExplicitoYAltaManual() throws Exception {
        var coordinacion = user("coord").roles("COORDINADOR");
        var correo = "{\"email\":\"excepcion@example.test\"}";
        mvc.perform(post("/api/auth/auto-registro").contentType(MediaType.APPLICATION_JSON).content(correo))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/registro").with(coordinacion).contentType(MediaType.APPLICATION_JSON).content(correo))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/registro").with(coordinacion).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"excepcion@example.test\",\"rolesNombres\":[\"DOCENTE\"]}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.roles[0]").value("DOCENTE"));
    }
}
