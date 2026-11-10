package cl.duoc.citt.citt_backend.services;

import cl.duoc.citt.citt_backend.dto.SolicitudResponseDTO;
import org.springframework.web.util.HtmlUtils;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Map;

record CorreoSolicitud(String asunto, String html) {

    private static final String PORTAL = "https://cittvalparaiso.cl";
    private static final ZoneId ZONA_CITT = ZoneId.of("America/Santiago");
    private static final DateTimeFormatter FECHA = DateTimeFormatter.ofPattern("d 'de' MMMM 'de' uuuu", Locale.forLanguageTag("es-CL"));
    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter FECHA_CALENDARIO =
            DateTimeFormatter.ofPattern("uuuuMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC);

    static CorreoSolicitud pendiente(SolicitudResponseDTO solicitud) {
        return new CorreoSolicitud(
                "Nueva solicitud #" + solicitud.getIdSolicitud() + " pendiente de revisión - CITT",
                plantilla(solicitud, "Pendiente de revisión", "#805000", "#fff4da",
                        "Nueva solicitud de reserva",
                        "Se registró una nueva solicitud de espacio o artículos. Ingresa al sistema para revisarla.",
                        fila("Solicitante", solicitud.getEmailUsuario()), "Revisar en Reservas CITT", PORTAL));
    }

    static CorreoSolicitud aprobada(SolicitudResponseDTO solicitud) {
        String instrucciones = "Tu solicitud fue aprobada. Preséntate a la hora indicada para usar el espacio o retirar los artículos en el mesón del CITT.";
        return new CorreoSolicitud(
                "Reserva #" + solicitud.getIdSolicitud() + " confirmada - CITT Duoc UC",
                plantilla(solicitud, "Confirmada", "#176042", "#e7f4ed", "Tu reserva está confirmada",
                        instrucciones, "", "Agregar a Google Calendar", enlaceCalendario(solicitud)));
    }

    private static String plantilla(SolicitudResponseDTO solicitud, String estado, String colorEstado,
                                   String fondoEstado, String titulo, String mensaje, String filasAdicionales,
                                   String boton, String enlace) {
        String filas = filasAdicionales
                + fila("Fecha", solicitud.getFecha().format(FECHA))
                + fila("Horario", solicitud.getHoraInicio().format(HORA) + " a " + solicitud.getHoraFin().format(HORA) + " (Chile continental)")
                + fila("Espacio", solicitud.getNombreEspacio())
                + fila("Artículos", String.join(", ", solicitud.getNombresArticulos()))
                + fila("Destino externo", solicitud.getDestinoExterno());

        return """
                <!doctype html>
                <html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
                <body style="margin:0;background:#edf2f7;color:#17273d;font-family:Arial,sans-serif">
                  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background:#edf2f7">
                    <tr><td align="center" style="padding:24px 12px">
                      <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #dbe3ed">
                        <tr><td style="background:#102c4c;border-bottom:4px solid #ffbe39;padding:22px 24px;color:#ffffff">
                          <div style="font-size:22px;font-weight:bold">CITT <span style="font-weight:normal">Duoc UC</span></div>
                          <div style="margin-top:6px;font-size:13px;color:#dce8f6">Valparaíso · Sistema de Reservas</div>
                        </td></tr>
                        <tr><td style="padding:26px 24px">
                          <span style="display:inline-block;padding:6px 10px;border-radius:4px;font-size:13px;font-weight:bold;color:%s;background:%s">%s</span>
                          <h1 style="margin:14px 0 8px;font-size:24px;line-height:1.2">%s</h1>
                          <p style="margin:0 0 14px;color:#465971;font-size:14px">Solicitud #%d</p>
                          <p style="margin:0 0 18px;font-size:15px;line-height:1.55">%s</p>
                          <table width="100%%" cellspacing="0" cellpadding="0" style="background:#f3f6fa;font-size:14px">%s</table>
                          <p style="margin:24px 0 0"><a href="%s" style="display:inline-block;background:#123e6b;color:#ffffff;padding:12px 18px;border-radius:4px;text-decoration:none;font-weight:bold;font-size:14px">%s</a></p>
                        </td></tr>
                        <tr><td style="border-top:1px solid #dbe3ed;padding:18px 24px;font-size:13px;color:#465971">
                          Equipo CITT · Duoc UC Valparaíso<br>
                          <a href="%s" style="color:#123e6b">Sistema de Reservas CITT</a>
                        </td></tr>
                      </table>
                    </td></tr>
                  </table>
                </body></html>
                """.formatted(colorEstado, fondoEstado, estado, titulo, solicitud.getIdSolicitud(), mensaje,
                filas, HtmlUtils.htmlEscape(enlace), boton, PORTAL);
    }

    private static String fila(String etiqueta, String valor) {
        if (valor == null || valor.isBlank()) {
            return "";
        }
        return """
                <tr><th scope="row" align="left" valign="top" style="width:105px;padding:9px 8px 9px 12px">%s</th>
                <td valign="top" style="padding:9px 12px 9px 0;overflow-wrap:anywhere">%s</td></tr>
                """.formatted(etiqueta, HtmlUtils.htmlEscape(valor));
    }

    private static String enlaceCalendario(SolicitudResponseDTO solicitud) {
        String fechas = instante(solicitud, solicitud.getHoraInicio()) + "/" + instante(solicitud, solicitud.getHoraFin());
        String lugar = "CITT Duoc UC Valparaíso";
        if (solicitud.getNombreEspacio() != null && !solicitud.getNombreEspacio().isBlank()) {
            lugar += " · " + solicitud.getNombreEspacio();
        }
        String detalles = "Solicitud #" + solicitud.getIdSolicitud() + " confirmada en Reservas CITT.\n" + PORTAL;
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
