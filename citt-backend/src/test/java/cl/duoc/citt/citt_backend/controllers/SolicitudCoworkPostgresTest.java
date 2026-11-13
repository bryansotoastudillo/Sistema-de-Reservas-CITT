package cl.duoc.citt.citt_backend.controllers;

import cl.duoc.citt.citt_backend.services.EmailService;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "CITT_PRUEBA_POSTGRES_AISLADO", matches = "true")
@Transactional
class SolicitudCoworkPostgresTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate sql;
    @Autowired EntityManager entidades;
    @MockitoBean EmailService correo;

    @Test
    void guardaOpcionesSoloParaCoworkYLasMuestraAlRevisar() throws Exception {
        String email = UUID.randomUUID() + "@example.test";
        sql.update("insert into usuarios (email, password, debe_cambiar_password) values (?, 'prueba', false)", email);
        Long cowork = crearEspacio("Área Cowork");
        Long otro = crearEspacio("Cubículo de prueba");
        String recursos = "[\"MICROFONO\",\"TRANSMITIR_PANTALLA\",\"MICROFONO\"]";
        mvc.perform(post("/api/solicitudes").with(user(email).roles("ALUMNO"))
                        .contentType(MediaType.APPLICATION_JSON).content(solicitud(otro, recursos)))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/solicitudes").with(user(email).roles("ALUMNO"))
                        .contentType(MediaType.APPLICATION_JSON).content(solicitud(cowork, recursos)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.recursosCowork[0]").value("MICROFONO"))
                .andExpect(jsonPath("$.recursosCowork[1]").value("TRANSMITIR_PANTALLA"))
                .andExpect(jsonPath("$.recursosCowork.length()").value(2));
        entidades.flush();
        entidades.clear();
        mvc.perform(get("/api/solicitudes").with(user("coordinacion").roles("COORDINADOR")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.emailUsuario == '" + email + "')].recursosCowork[0]").value("MICROFONO"));
        mvc.perform(post("/api/solicitudes").with(user(email).roles("ALUMNO"))
                        .contentType(MediaType.APPLICATION_JSON).content(solicitud(otro, "[]")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.recursosCowork.length()").value(0));
    }

    private Long crearEspacio(String nombre) {
        return sql.queryForObject("insert into espacios (nombre, capacidad) values (?, 10) returning id", Long.class, nombre);
    }

    private String solicitud(Long espacio, String recursos) {
        return """
                {"fecha":"%s","horaInicio":"10:00","horaFin":"11:00","proposito":"Prueba audiovisual",
                 "idEspacio":%d,"recursosCowork":%s}
                """.formatted(LocalDate.now().plusDays(3), espacio, recursos);
    }
}
