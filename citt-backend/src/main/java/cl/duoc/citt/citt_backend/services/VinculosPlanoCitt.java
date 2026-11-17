package cl.duoc.citt.citt_backend.services;

import cl.duoc.citt.citt_backend.model.Espacio;
import cl.duoc.citt.citt_backend.repositories.EspacioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class VinculosPlanoCitt implements CommandLineRunner {
    private final EspacioRepository espacios;

    @Override
    @Transactional
    public void run(String... args) {
        Map<String, List<Espacio>> candidatos = espacios.findAll().stream()
                .filter(espacio -> espacio.getClavePlano() == null && clavePorNombre(espacio.getNombre()) != null)
                .collect(Collectors.groupingBy(espacio -> clavePorNombre(espacio.getNombre())));
        candidatos.forEach((clave, coincidencias) -> {
            if (coincidencias.size() == 1 && !espacios.existsByClavePlano(clave)) {
                coincidencias.getFirst().setClavePlano(clave);
            }
        });
    }

    public String claveDisponible(String nombre) {
        String clave = clavePorNombre(nombre);
        return clave != null && !espacios.existsByClavePlano(clave) ? clave : null;
    }

    private static String clavePorNombre(String nombre) {
        if (nombre == null) return null;
        String normalizado = Normalizer.normalize(nombre, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "").strip().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
        return switch (normalizado) {
            case "cubiculo 1" -> "1";
            case "cubiculo 2" -> "2";
            case "cubiculo 3" -> "3";
            case "cubiculo 4" -> "4";
            case "cubiculo 5" -> "5";
            case "cabina", "cabina individual" -> "CI";
            case "sala streaming" -> "ST";
            case "mesa de reunion", "mesa de reuniones", "sala reuniones", "sala reunion",
                    "sala de reunion", "sala de reuniones", "mesa reunion", "mesa reuniones" -> "MR";
            case "area cowork", "espacio cowork" -> "CW";
            default -> null;
        };
    }
}
