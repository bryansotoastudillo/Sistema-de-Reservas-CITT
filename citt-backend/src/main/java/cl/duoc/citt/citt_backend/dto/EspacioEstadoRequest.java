package cl.duoc.citt.citt_backend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record EspacioEstadoRequest(
        @NotNull Estado estado,
        @Min(5) @Max(720) Integer minutos
) {
    public enum Estado {
        LIBRE, OCUPADO, FUERA_DE_SERVICIO, DANADO
    }
}
