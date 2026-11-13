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
        RECORDATORIO("Próxima devolución", "#805000", "#fff4da"),
        INFORMATIVO("Información de cuenta", "#424242", "#f1f0ed");

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
                <table width="100%%" cellspacing="0" cellpadding="0"
                       style="border-collapse:collapse;border:1px solid #e3e1db;font-size:14px">
                  <tbody>%s</tbody>
                </table>
                """.formatted(filas);

        String html = """
                <!doctype html>
                <html lang="es-CL">
                <head>
                  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
                  <title>%s</title>
                  <style>
                    @media screen and (max-width: 480px) {
                      .margen-citt { padding-left:20px !important; padding-right:20px !important; }
                      .titulo-citt { font-size:27px !important; }
                    }
                  </style>
                </head>
                <body style="margin:0;padding:0;background:#f4f3ef;color:#252525;font-family:Arial,Helvetica,sans-serif">
                  <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all">%s</div>
                  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" bgcolor="#f4f3ef">
                    <tr><td align="center" style="padding:24px 10px">
                      <!--[if mso]><table role="presentation" width="600" cellspacing="0" cellpadding="0"><tr><td><![endif]-->
                      <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" bgcolor="#ffffff"
                             style="max-width:600px;border:1px solid #e3e1db">
                        <tr><td class="margen-citt" style="padding:20px 32px;border-top:5px solid #ffb81c">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td valign="middle" style="padding-right:15px;font-size:23px;line-height:28px;font-weight:bold;white-space:nowrap;color:#252525">Duoc UC</td>
                              <td valign="middle" style="border-left:1px solid #d8d5cd;padding-left:15px;font-size:13px;line-height:18px;color:#46443f">
                                <strong>CITT</strong><br>Sede Valparaíso
                              </td>
                            </tr>
                          </table>
                        </td></tr>
                        <tr><td class="margen-citt" bgcolor="#262626" style="padding:26px 32px;color:#ffffff">
                          <p style="margin:0 0 8px;color:#ffd16a;font-size:12px;font-weight:bold;letter-spacing:1px">SISTEMA DE RESERVAS CITT</p>
                          <h1 class="titulo-citt" style="margin:0;font-size:32px;line-height:1.18;font-weight:bold;color:#ffffff">%s</h1>
                        </td></tr>
                        <tr><td class="margen-citt" style="padding:24px 32px 28px">
                          <p style="margin:0 0 16px"><span style="display:inline-block;padding:5px 9px;font-size:13px;font-weight:bold;color:%s;background:%s">%s</span></p>
                          <p style="margin:0 0 18px;font-size:16px;line-height:1.55;color:#33322f">%s</p>
                          %s
                          <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:22px">
                            <tr><td bgcolor="#ffb81c" style="border-radius:4px;mso-padding-alt:13px 18px">
                              <a href="%s" style="display:inline-block;padding:13px 18px;mso-padding-alt:0;font-size:15px;line-height:19px;font-weight:bold;color:#242424;text-decoration:none">%s</a>
                            </td></tr>
                          </table>
                        </td></tr>
                        <tr><td class="margen-citt" bgcolor="#f8f7f4" style="border-top:1px solid #e3e1db;padding:18px 32px;font-size:13px;line-height:1.55;color:#514e48">
                          <strong>Equipo CITT · Duoc UC Valparaíso</strong><br>
                          Mensaje automático del <a href="%s" style="color:#35332f;text-decoration:underline">Sistema de Reservas CITT</a>.
                        </td></tr>
                      </table>
                      <!--[if mso]></td></tr></table><![endif]-->
                    </td></tr>
                  </table>
                </body></html>
                """.formatted(escapar(asunto), escapar(mensaje), escapar(titulo), estado.color, estado.fondo,
                estado.texto, escapar(mensaje), detalles, escapar(enlace), escapar(boton), PORTAL);
        return new CorreoCitt(asunto, html);
    }

    private static String fila(String etiqueta, String valor) {
        return """
                <tr>
                  <th scope="row" align="left" valign="top" bgcolor="#f8f7f4" width="34%%"
                      style="border-bottom:1px solid #e3e1db;padding:10px 12px;line-height:1.4;color:#46443f">%s</th>
                  <td valign="top" style="border-bottom:1px solid #e3e1db;padding:10px 12px;line-height:1.4;overflow-wrap:anywhere">%s</td>
                </tr>
                """.formatted(escapar(etiqueta), escapar(valor).replace("\r\n", "\n").replace("\n", "<br>"));
    }

    private static String escapar(String texto) {
        return HtmlUtils.htmlEscape(texto, StandardCharsets.UTF_8.name());
    }
}
