package cl.duoc.citt.citt_backend.services;

import org.springframework.web.util.HtmlUtils;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.stream.Collectors;

record CorreoCitt(String asunto, String html) {

    static final String PORTAL = "https://cittvalparaiso.cl";

    enum Estado {
        PENDIENTE("Pendiente de revisión", "#805000", "#fff4da"),
        CONFIRMADA("Confirmada", "#176042", "#e7f4ed"),
        RECHAZADA("Rechazada", "#922b28", "#fcebea"),
        ATRASADA("Devolución pendiente", "#805000", "#fff4da"),
        INFORMATIVO("Información CITT", "#123e6b", "#e7f1fc");

        private final String texto;
        private final String color;
        private final String fondo;

        Estado(String texto, String color, String fondo) {
            this.texto = texto;
            this.color = color;
            this.fondo = fondo;
        }
    }

    static CorreoCitt crear(String asunto, Estado estado, String titulo, String mensaje,
                            Map<String, String> datos, String boton) {
        return crear(asunto, estado, titulo, mensaje, datos, boton, PORTAL);
    }

    static CorreoCitt crear(String asunto, Estado estado, String titulo, String mensaje,
                            Map<String, String> datos, String boton, String enlace) {
        String filas = datos.entrySet().stream()
                .filter(dato -> dato.getValue() != null && !dato.getValue().isBlank())
                .map(dato -> fila(dato.getKey(), dato.getValue()))
                .collect(Collectors.joining());
        String detalles = filas.isEmpty() ? "" : """
                <table width="100%%" cellspacing="0" cellpadding="0" style="background:#f3f6fa;font-size:14px">%s</table>
                """.formatted(filas);

        String html = """
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
                          <p style="margin:0 0 18px;font-size:15px;line-height:1.55">%s</p>
                          %s
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
                """.formatted(estado.color, estado.fondo, estado.texto, escapar(titulo),
                escapar(mensaje), detalles, escapar(enlace), escapar(boton), PORTAL);
        return new CorreoCitt(asunto, html);
    }

    private static String fila(String etiqueta, String valor) {
        return """
                <tr><th scope="row" align="left" valign="top" style="width:105px;padding:9px 8px 9px 12px">%s</th>
                <td valign="top" style="padding:9px 12px 9px 0;overflow-wrap:anywhere">%s</td></tr>
                """.formatted(escapar(etiqueta), escapar(valor).replace("\r\n", "\n").replace("\n", "<br>"));
    }

    private static String escapar(String texto) {
        return HtmlUtils.htmlEscape(texto, StandardCharsets.UTF_8.name());
    }
}
