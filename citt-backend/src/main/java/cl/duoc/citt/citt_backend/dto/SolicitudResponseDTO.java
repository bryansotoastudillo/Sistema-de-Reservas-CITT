package cl.duoc.citt.citt_backend.dto;

import cl.duoc.citt.citt_backend.model.RecursoCowork;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Data
@Builder
public class SolicitudResponseDTO {
    private Long idSolicitud;
    private LocalDate fecha;
    private LocalTime horaInicio;
    private LocalTime horaFin;
    private String proposito;
    private String estado;
    private Integer cantidadIntegrantes;
    private Boolean exclusividad;

    // Datos de relaciones (simplificados para el response)
    private String emailUsuario;
    private String nombreEspacio; // Será null si es solo artículo
    private List<String> nombresArticulos; // Nombres o Marcas de los artículos
    private List<RequerimientoDTO> requerimientos;
    private List<ArticuloAsignadoDTO> articulosAsignados;

    // Feature 2: Timestamp real de devolución
    private java.time.LocalDateTime fechaDevolucionReal;

    // Feature 4: Rastreo de daños por solicitud
    private Boolean espacioDanadoEnDevolucion;
    private String comentarioDanoEspacio;
    private String idsArticulosDanados;

    // Motivo de rechazo (para historial de rechazadas)
    private String motivoRechazo;

    // Autogestión de solicitudes
    private String registroAutogestion;

    // Uso externo
    private String destinoExterno;
    private List<RecursoCowork> recursosCowork;
}
