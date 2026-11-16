package cl.duoc.citt.citt_backend.dto;

import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record FichaActivoDTO(
        @PositiveOrZero Integer cantidad,
        @Size(max = 255) String numeroSerie,
        LocalDate adquisicion,
        @PositiveOrZero Long montoActivo,
        @Size(max = 255) String ubicacionRegistrada,
        @Size(max = 255) String confirmarUbicacion,
        @Size(max = 255) String poseeEtiquetaDuoc,
        @Size(max = 5000) String observacion) {}
