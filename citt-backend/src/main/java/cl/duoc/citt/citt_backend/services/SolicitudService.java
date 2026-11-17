package cl.duoc.citt.citt_backend.services;

import cl.duoc.citt.citt_backend.dto.ActualizarEstadoSolicitudRequestDTO;
import cl.duoc.citt.citt_backend.dto.SolicitudRequestDTO;
import cl.duoc.citt.citt_backend.dto.SolicitudResponseDTO;
import cl.duoc.citt.citt_backend.dto.RegularizarReservaRequest;

import java.util.List;

public interface SolicitudService {
    SolicitudResponseDTO crearSolicitud(SolicitudRequestDTO dto, String emailUsuario);
    SolicitudResponseDTO asignarSolicitante(Long idSolicitud, String correo, String emailUsuario);
    SolicitudResponseDTO regularizarReserva(RegularizarReservaRequest dto, String emailUsuario);
    List<SolicitudResponseDTO> obtenerMisSolicitudes(String emailUsuario);
    List<SolicitudResponseDTO> obtenerTodas();
    SolicitudResponseDTO cambiarEstado(Long idSolicitud, ActualizarEstadoSolicitudRequestDTO dto, String emailAdmin);
    SolicitudResponseDTO entregarArticulos(Long idSolicitud, List<Long> idsArticulosEntregados, String emailAdmin);
    SolicitudResponseDTO devolverArticulos(Long idSolicitud, cl.duoc.citt.citt_backend.dto.DevolucionRequestDTO dto, String emailAdmin);
    List<cl.duoc.citt.citt_backend.dto.CalendarioEventoDTO> obtenerEventosCalendario(String emailUsuario);
}
