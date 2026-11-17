package cl.duoc.citt.citt_backend.security;

import cl.duoc.citt.citt_backend.exception.ReglaNegocioException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class DominiosInstitucionales {
    public record Regla(String dominio, String rol, boolean permiteAutorregistro) {}

    private final Map<String, Regla> reglas = new LinkedHashMap<>();
    private final Set<String> correosManuales;

    public DominiosInstitucionales(
            @Value("${app.dominios.alumno}") String alumnos,
            @Value("${app.dominios.docente}") String docentes,
            @Value("${app.dominios.administrativo}") String administrativos,
            @Value("${app.dominios.correos-manuales}") String excepciones) {
        agregar(alumnos, "ALUMNO", true);
        agregar(docentes, "DOCENTE", true);
        agregar(administrativos, "ADMINISTRATIVO", true);
        correosManuales = Arrays.stream(excepciones.split(","))
                .map(String::strip).filter(correo -> !correo.isEmpty())
                .map(correo -> correo.toLowerCase(Locale.ROOT)).collect(Collectors.toUnmodifiableSet());
    }

    private void agregar(String dominios, String rol, boolean permiteAutorregistro) {
        for (String entrada : dominios.split(",")) {
            String dominio = entrada.strip().toLowerCase(Locale.ROOT);
            if (dominio.isEmpty()) continue;
            if (dominio.startsWith("@")) dominio = dominio.substring(1);
            if (!dominio.matches("[a-z0-9-]+(?:\\.[a-z0-9-]+)+")) {
                throw new IllegalArgumentException("Dominio institucional inválido: " + dominio);
            }
            if (reglas.putIfAbsent(dominio, new Regla(dominio, rol, permiteAutorregistro)) != null) {
                throw new IllegalArgumentException("Dominio institucional repetido: " + dominio);
            }
        }
    }

    public List<Regla> listar() {
        return List.copyOf(reglas.values());
    }

    public Regla exigirDominio(String email) {
        String correo = email == null ? "" : email.strip();
        int separador = correo.lastIndexOf('@');
        if (separador <= 0) {
            throw new ReglaNegocioException("Formato de correo inválido.");
        }
        String dominio = correo.substring(separador + 1).toLowerCase(Locale.ROOT);
        Regla regla = reglas.get(dominio);
        if (regla == null && correosManuales.contains(correo.toLowerCase(Locale.ROOT))) {
            return new Regla(dominio, null, false);
        }
        if (regla == null) throw new ReglaNegocioException("Solo se permiten correos de la institución.");
        return regla;
    }
}
