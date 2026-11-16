package cl.duoc.citt.citt_backend.services;

import cl.duoc.citt.citt_backend.model.Rol;
import cl.duoc.citt.citt_backend.model.Usuario;
import cl.duoc.citt.citt_backend.repositories.RolRepository;
import cl.duoc.citt.citt_backend.repositories.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final RolRepository rolRepository;
    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        // Crear roles si no existen
        List.of("COORDINADOR", "DIRECTOR", "DOCENTE", "AYUDANTE", "ALUMNO", "ADMINISTRATIVO").forEach(nombre -> {
            if (rolRepository.findByNombre(nombre).isEmpty()) {
                rolRepository.save(Rol.builder().nombre(nombre).build());
            }
        });

        // Crear usuario inicial (Director + Coordinador)
        if (usuarioRepository.findByEmail("admin@duoc.cl").isEmpty()) {
            Rol rolDirector = rolRepository.findByNombre("DIRECTOR")
                    .orElseThrow(() -> new RuntimeException("Error: Rol DIRECTOR no encontrado"));
            Rol rolCoordinador = rolRepository.findByNombre("COORDINADOR")
                    .orElseThrow(() -> new RuntimeException("Error: Rol COORDINADOR no encontrado"));

            Usuario admin = Usuario.builder()
                    .email("admin@duoc.cl")
                    .password(passwordEncoder.encode(
                            System.getenv("ADMIN_PASSWORD") != null
                                    ? System.getenv("ADMIN_PASSWORD")
                                    : "admin123"
                    ))
                    .roles(Set.of(rolDirector, rolCoordinador))
                    .debeCambiarPassword(false)
                    .build();
            usuarioRepository.save(admin);
            System.out.println(">>> Usuario inicial MULTI-ROL creado: admin@duoc.cl");
        }
    }
}
