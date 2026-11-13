package cl.duoc.citt.citt_backend.model;

import java.text.Normalizer;
import java.util.Locale;

public enum RecursoCowork {
    MICROFONO("Micrófono"),
    AUDIO_PARLANTES("Audio de los parlantes"),
    TRANSMITIR_PANTALLA("Transmitir en la pantalla"),
    MICROFONO_DIADEMA("Micrófono de diadema");

    private final String etiqueta;

    RecursoCowork(String etiqueta) {
        this.etiqueta = etiqueta;
    }

    public String etiqueta() {
        return etiqueta;
    }

    public static boolean correspondeA(Espacio espacio) {
        if (espacio == null || espacio.getNombre() == null) return false;
        String nombre = Normalizer.normalize(espacio.getNombre(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
        return switch (nombre) {
            case "cowork", "area cowork", "espacio cowork" -> true;
            default -> false;
        };
    }
}
