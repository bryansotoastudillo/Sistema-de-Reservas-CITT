package cl.duoc.citt.citt_backend.dto;

import cl.duoc.citt.citt_backend.model.RecursoCowork;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Data
public class SolicitudRequestDTO {

    @Schema(type = "string", format = "date", example = "2026-05-13", description = "Fecha de la reserva")
    @NotNull(message = "La fecha es obligatoria")
    @FutureOrPresent(message = "La fecha debe ser hoy o en el futuro")
    private LocalDate fecha;

    @Schema(type = "string", format = "time", example = "10:30:00", description = "Hora de inicio en formato HH:mm:ss")
    @NotNull(message = "La hora de inicio es obligatoria")
    private LocalTime horaInicio;

    @Schema(type = "string", format = "time", example = "12:30:00", description = "Hora de fin en formato HH:mm:ss")
    @NotNull(message = "La hora de fin es obligatoria")
    private LocalTime horaFin;

    @Schema(example = "desarrollo citt")
    @NotBlank(message = "Debe ingresar el propósito o motivo de la reserva")
    private String proposito;

    @Schema(example = "1")
    private Long idEspacio;

    @Schema(example = "2")
    private Integer cantidadIntegrantes;

    @Schema(example = "false")
    private Boolean exclusividad = false;

    @Schema(description = "Lista de artículos solicitados por categoría y marca")
    private List<RequerimientoDTO> requerimientos;

    @Schema(description = "Destino externo al cual se llevarán los artículos fuera del CITT. Obligatorio si no se selecciona un espacio.")
    private String destinoExterno;

    @Schema(description = "Recursos audiovisuales opcionales para el cowork")
    private List<@NotNull RecursoCowork> recursosCowork;
}
