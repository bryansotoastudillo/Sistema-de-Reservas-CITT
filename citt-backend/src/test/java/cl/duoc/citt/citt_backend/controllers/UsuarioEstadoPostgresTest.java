package cl.duoc.citt.citt_backend.controllers;

import cl.duoc.citt.citt_backend.model.Usuario;
import cl.duoc.citt.citt_backend.repositories.UsuarioRepository;
import cl.duoc.citt.citt_backend.security.JwtUtilidades;
import cl.duoc.citt.citt_backend.services.RefreshTokenService;
import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@EnabledIfEnvironmentVariable(named = "CITT_PRUEBA_POSTGRES_AISLADO", matches = "true")
class UsuarioEstadoPostgresTest {
    @Autowired MockMvc mvc;
    @Autowired UsuarioRepository usuarios;
    @Autowired JwtUtilidades jwt;
    @Autowired RefreshTokenService sesiones;
    @Autowired PasswordEncoder claves;

    @Test
    void soloDirectorCambiaEstadoYLasSesionesAnterioresQuedanRevocadas() throws Exception {
        var cuenta = usuarios.save(Usuario.builder().email(UUID.randomUUID() + "@duocuc.cl")
                .password(claves.encode("Prueba12345")).debeCambiarPassword(false).build());
        var token = new Cookie("auth_token", jwt.generarToken(cuenta));
        var renovacion = new Cookie("refresh_token", sesiones.crearRefreshToken(cuenta.getId()).getToken());
        String ruta = "/api/usuarios/" + cuenta.getId() + "/estado";
        String deshabilitar = "{\"habilitado\":false}";
        mvc.perform(get("/api/usuarios/mi-perfil").cookie(token)).andExpect(status().isOk());
        mvc.perform(patch(ruta).with(user("coord@duoc.cl").roles("COORDINADOR"))
                .contentType(MediaType.APPLICATION_JSON).content(deshabilitar)).andExpect(status().isForbidden());
        mvc.perform(patch(ruta).with(user(cuenta.getEmail()).roles("DIRECTOR"))
                .contentType(MediaType.APPLICATION_JSON).content(deshabilitar)).andExpect(status().isBadRequest());
        mvc.perform(patch(ruta).with(user("direccion@duoc.cl").roles("DIRECTOR"))
                .contentType(MediaType.APPLICATION_JSON).content(deshabilitar))
                .andExpect(status().isOk()).andExpect(jsonPath("$.habilitado").value(false));
        mvc.perform(get("/api/usuarios/mi-perfil").cookie(token)).andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/refrescar-token").cookie(renovacion)).andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + cuenta.getEmail() + "\",\"password\":\"Prueba12345\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(patch(ruta).with(user("direccion@duoc.cl").roles("DIRECTOR"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"habilitado\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.habilitado").value(true));
        mvc.perform(get("/api/usuarios/mi-perfil").cookie(token)).andExpect(status().isForbidden());
        mvc.perform(get("/api/usuarios/mi-perfil").cookie(new Cookie("auth_token", jwt.generarToken(cuenta))))
                .andExpect(status().isOk());
    }
}
