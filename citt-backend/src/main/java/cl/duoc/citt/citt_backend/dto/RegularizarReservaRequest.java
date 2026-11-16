package cl.duoc.citt.citt_backend.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalTime;

public record RegularizarReservaRequest(
        @NotNull @Positive Long idEspacio,
        @NotNull LocalDate fecha,
        @NotNull LocalTime horaInicio,
        @NotNull LocalTime horaFin,
        @NotNull @Min(1) Integer cantidadIntegrantes,
        @NotBlank @Size(max = 500) String proposito
) {}
