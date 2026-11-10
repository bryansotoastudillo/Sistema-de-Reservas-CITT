package cl.duoc.citt.citt_backend.services;

import cl.duoc.citt.citt_backend.dto.SolicitudResponseDTO;
import cl.duoc.citt.citt_backend.services.CorreoCitt.Estado;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

final class CorreoSolicitud {

    private static final ZoneId ZONA_CITT = ZoneId.of("America/Santiago");
    private static final DateTimeFormatter FECHA = DateTimeFormatter.ofPattern("d 'de' MMMM 'de' uuuu", Locale.forLanguageTag("es-CL"));
    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter FECHA_CALENDARIO =
            DateTimeFormatter.ofPattern("uuuuMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC);

    private CorreoSolicitud() {}

    static CorreoCitt pendiente(SolicitudResponseDTO solicitud) {
        Map<String, String> datos = new LinkedHashMap<>();
        datos.put("Solicitante", solicitud.getEmailUsuario());
        datos.putAll(datosReserva(solicitud));
        return CorreoCitt.crear("Nueva solicitud #" + solicitud.getIdSolicitud() + " pendiente de revisión - CITT",
                Estado.PENDIENTE, "Nueva solicitud de reserva",
                "Se registró una nueva solicitud de espacio o artículos. Ingresa al sistema para revisarla.",
                datos, "Revisar en Reservas CITT");
    }

    static CorreoCitt aprobada(SolicitudResponseDTO solicitud) {
        return CorreoCitt.crear("Reserva #" + solicitud.getIdSolicitud() + " confirmada - CITT Duoc UC",
                Estado.CONFIRMADA, "Tu reserva está confirmada",
                "Preséntate a la hora indicada para usar el espacio o retirar los artículos en el mesón del CITT.",
                datosReserva(solicitud), "Agregar a Google Calendar", enlaceCalendario(solicitud));
    }

    static CorreoCitt rechazada(Long idSolicitud, String motivo) {
        Map<String, String> datos = new LinkedHashMap<>();
        datos.put("Solicitud", "#" + idSolicitud);
        datos.put("Motivo", motivo == null || motivo.isBlank() ? "No se especificó un motivo." : motivo);
        return CorreoCitt.crear("Solicitud #" + idSolicitud + " rechazada - CITT Duoc UC",
                Estado.RECHAZADA, "Tu solicitud fue rechazada",
                "Si tienes dudas sobre esta decisión, contacta al equipo o acércate al CITT.",
                datos, "Abrir Reservas CITT");
    }

    static CorreoCitt atrasada(LocalDate fecha, LocalTime horaFin) {
        Map<String, String> datos = new LinkedHashMap<>();
        datos.put("Fecha", fecha.format(FECHA));
        datos.put("Hora límite", horaFin.format(HORA) + " (Chile continental)");
        return CorreoCitt.crear("Aviso de devolución pendiente - CITT Duoc UC",
                Estado.ATRASADA, "Se superó el horario de devolución",
                "Acércate al CITT lo antes posible para devolver los recursos de tu reserva.",
                datos, "Abrir Reservas CITT");
    }

    private static Map<String, String> datosReserva(SolicitudResponseDTO solicitud) {
        Map<String, String> datos = new LinkedHashMap<>();
        datos.put("Solicitud", "#" + solicitud.getIdSolicitud());
        datos.put("Fecha", solicitud.getFecha().format(FECHA));
        datos.put("Horario", solicitud.getHoraInicio().format(HORA) + " a " + solicitud.getHoraFin().format(HORA) + " (Chile continental)");
        datos.put("Espacio", solicitud.getNombreEspacio());
        datos.put("Artículos", String.join(", ", solicitud.getNombresArticulos()));
        datos.put("Destino externo", solicitud.getDestinoExterno());
        return datos;
    }

    private static String enlaceCalendario(SolicitudResponseDTO solicitud) {
        String fechas = instante(solicitud, solicitud.getHoraInicio()) + "/" + instante(solicitud, solicitud.getHoraFin());
        String lugar = "CITT Duoc UC Valparaíso";
        if (solicitud.getNombreEspacio() != null && !solicitud.getNombreEspacio().isBlank()) {
            lugar += " · " + solicitud.getNombreEspacio();
        }
        String detalles = "Solicitud #" + solicitud.getIdSolicitud() + " confirmada en Reservas CITT.\n" + CorreoCitt.PORTAL;
        return UriComponentsBuilder.fromUriString("https://calendar.google.com/calendar/r/eventedit")
                .queryParam("action", "TEMPLATE")
                .queryParam("dates", "{fechas}")
                .queryParam("stz", "{zona}")
                .queryParam("etz", "{zona}")
                .queryParam("text", "{titulo}")
                .queryParam("location", "{lugar}")
                .queryParam("details", "{detalles}")
                .encode()
                .buildAndExpand(Map.of("fechas", fechas, "zona", ZONA_CITT.getId(),
                        "titulo", "Reserva CITT #" + solicitud.getIdSolicitud(), "lugar", lugar, "detalles", detalles))
                .toUriString();
    }

    private static String instante(SolicitudResponseDTO solicitud, LocalTime hora) {
        return FECHA_CALENDARIO.format(solicitud.getFecha().atTime(hora).atZone(ZONA_CITT).toInstant());
    }
}
