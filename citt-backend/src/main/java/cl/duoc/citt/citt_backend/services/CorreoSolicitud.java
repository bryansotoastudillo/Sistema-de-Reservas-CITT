package cl.duoc.citt.citt_backend.services;

import cl.duoc.citt.citt_backend.dto.SolicitudResponseDTO;
import cl.duoc.citt.citt_backend.model.RecursoCowork;
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
import java.util.stream.Collectors;

final class CorreoSolicitud {

    private static final ZoneId ZONA_CITT = ZoneId.of("America/Santiago");
    private static final DateTimeFormatter FECHA = DateTimeFormatter.ofPattern("d 'de' MMMM 'de' uuuu", Locale.forLanguageTag("es-CL"));
    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter FECHA_CALENDARIO =
            DateTimeFormatter.ofPattern("uuuuMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC);

    private CorreoSolicitud() {}

    static CorreoCitt pendiente(SolicitudResponseDTO solicitud) {
        Map<String, String> datos = new LinkedHashMap<>();
        datos.put(etiqueta("solicitante"), solicitud.getEmailUsuario());
        datos.putAll(datosReserva(solicitud));
        return CorreoCitt.desdeCatalogo("solicitud.pendiente", Estado.PENDIENTE, variables(solicitud), datos);
    }

    static CorreoCitt recibida(SolicitudResponseDTO solicitud) {
        return CorreoCitt.desdeCatalogo("solicitud.recibida", Estado.PENDIENTE, variables(solicitud), datosReserva(solicitud));
    }

    static CorreoCitt aprobada(SolicitudResponseDTO solicitud) {
        boolean soloEspacio = solicitud.getNombreEspacio() != null
                && (solicitud.getNombresArticulos() == null || solicitud.getNombresArticulos().isEmpty());
        return CorreoCitt.desdeCatalogo(soloEspacio ? "solicitud.aprobadaEspacio" : "solicitud.aprobada", Estado.CONFIRMADA, variables(solicitud),
                datosReserva(solicitud), enlaceCalendario(solicitud));
    }

    static CorreoCitt rechazada(Long idSolicitud, String motivo) {
        Map<String, String> datos = new LinkedHashMap<>();
        datos.put(etiqueta("solicitud"), "#" + idSolicitud);
        datos.put(etiqueta("motivo"), motivo == null || motivo.isBlank() ? CatalogoCorreos.texto("motivoNoEspecificado") : motivo);
        return CorreoCitt.desdeCatalogo("solicitud.rechazada", Estado.RECHAZADA,
                Map.of("idSolicitud", idSolicitud.toString()), datos);
    }

    static CorreoCitt vencidaSinRetiro(Long idSolicitud, LocalTime horaFin) {
        Map<String, String> datos = new LinkedHashMap<>();
        datos.put(etiqueta("solicitud"), "#" + idSolicitud);
        datos.put(etiqueta("horaTermino"), horaFin.format(HORA));
        return CorreoCitt.desdeCatalogo("solicitud.vencidaSinRetiro", Estado.VENCIDA,
                Map.of("idSolicitud", idSolicitud.toString()), datos);
    }

    static CorreoCitt atrasada(LocalDate fecha, LocalTime horaFin) {
        Map<String, String> datos = new LinkedHashMap<>();
        datos.put(etiqueta("fecha"), fecha.format(FECHA));
        datos.put(etiqueta("horaLimite"), CatalogoCorreos.texto("horaLimite", Map.of("horaFin", horaFin.format(HORA))));
        return CorreoCitt.desdeCatalogo("solicitud.atrasada", Estado.ATRASADA, Map.of(), datos);
    }

    private static Map<String, String> datosReserva(SolicitudResponseDTO solicitud) {
        Map<String, String> datos = new LinkedHashMap<>();
        datos.put(etiqueta("solicitud"), "#" + solicitud.getIdSolicitud());
        datos.put(etiqueta("fecha"), solicitud.getFecha().format(FECHA));
        datos.put(etiqueta("horario"), CatalogoCorreos.texto("horario", Map.of("horaInicio", solicitud.getHoraInicio().format(HORA), "horaFin", solicitud.getHoraFin().format(HORA))));
        datos.put(etiqueta("espacio"), solicitud.getNombreEspacio());
        datos.put(etiqueta("articulos"), String.join(", ", solicitud.getNombresArticulos()));
        datos.put(etiqueta("destinoExterno"), solicitud.getDestinoExterno());
        if (solicitud.getRecursosCowork() != null && !solicitud.getRecursosCowork().isEmpty()) {
            datos.put(etiqueta("recursosCowork"), solicitud.getRecursosCowork().stream()
                    .map(RecursoCowork::etiqueta).collect(Collectors.joining(", ")));
        }
        return datos;
    }

    private static String enlaceCalendario(SolicitudResponseDTO solicitud) {
        String fechas = instante(solicitud, solicitud.getHoraInicio()) + "/" + instante(solicitud, solicitud.getHoraFin());
        String lugar = CatalogoCorreos.texto("calendario.lugar");
        if (solicitud.getNombreEspacio() != null && !solicitud.getNombreEspacio().isBlank()) {
            lugar += " · " + solicitud.getNombreEspacio();
        }
        String detalles = CatalogoCorreos.texto("calendario.detalles", Map.of("idSolicitud", solicitud.getIdSolicitud().toString(), "portal", CorreoCitt.PORTAL));
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
                        "titulo", CatalogoCorreos.texto("calendario.titulo", variables(solicitud)), "lugar", lugar, "detalles", detalles))
                .toUriString();
    }

    private static String instante(SolicitudResponseDTO solicitud, LocalTime hora) {
        return FECHA_CALENDARIO.format(solicitud.getFecha().atTime(hora).atZone(ZONA_CITT).toInstant());
    }

    private static Map<String, String> variables(SolicitudResponseDTO solicitud) {
        return Map.of("idSolicitud", solicitud.getIdSolicitud().toString());
    }

    private static String etiqueta(String id) { return CatalogoCorreos.texto("datos." + id); }
}
