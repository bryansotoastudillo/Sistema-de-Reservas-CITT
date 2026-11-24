package cl.duoc.citt.citt_backend.services;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/** Textos de correo cargados y validados una vez al iniciar el backend. */
@Component
final class CatalogoCorreos {
    private static final Pattern VARIABLE = Pattern.compile("\\{([a-zA-Z][a-zA-Z0-9]*)}");
    private static final Set<String> IDS = Set.of("solicitud.pendiente", "solicitud.recibida",
            "solicitud.aprobada", "solicitud.aprobadaEspacio", "solicitud.rechazada", "solicitud.vencidaSinRetiro", "solicitud.atrasada",
            "cuenta.creada", "cuenta.claveProvisoria", "cuenta.recuperacion");
    private static final Set<String> TEXTOS = Set.of("remitente", "marca", "centro", "sede", "encabezado",
            "equipo", "piePrefijo", "pieSistema", "pieSufijo", "datos.solicitante", "datos.solicitud",
            "datos.motivo", "datos.fecha", "datos.horaTermino", "datos.horaLimite", "datos.horario",
            "datos.espacio", "datos.articulos", "datos.destinoExterno", "datos.recursosCowork",
            "datos.claveProvisoria", "datos.correoAcceso", "datos.codigoRecuperacion", "motivoNoEspecificado",
            "horario", "horaLimite", "calendario.titulo", "calendario.lugar", "calendario.detalles");
    private static final Datos DATOS = cargar();

    record Mensaje(String descripcion, String asunto, String titulo, String mensaje, String etiqueta, String boton) {}
    record Datos(Map<String, String> textos, Map<String, Mensaje> correos) {}

    static String texto(String id) { return texto(id, Map.of()); }

    static String texto(String id, Map<String, String> variables) {
        String valor = DATOS.textos().get(id);
        if (valor == null) throw new IllegalArgumentException("Texto de correo desconocido: " + id);
        return sustituir(valor, variables);
    }

    static Mensaje mensaje(String id, Map<String, String> variables) {
        Mensaje m = DATOS.correos().get(id);
        if (m == null) throw new IllegalArgumentException("ID de correo desconocido: " + id);
        return new Mensaje(m.descripcion(), sustituir(m.asunto(), variables), sustituir(m.titulo(), variables),
                sustituir(m.mensaje(), variables), sustituir(m.etiqueta(), variables), sustituir(m.boton(), variables));
    }

    static String etiqueta(String id) { return DATOS.correos().get(id).etiqueta(); }

    static String sustituir(String texto, Map<String, String> variables) {
        // Una sola pasada: el contenido de un dato nunca se interpreta como otro marcador.
        return VARIABLE.matcher(texto).replaceAll(coincidencia -> {
            String clave = coincidencia.group(1);
            String valor = variables.get(clave);
            if (valor == null) throw new IllegalArgumentException("Falta la variable de correo: " + clave);
            return java.util.regex.Matcher.quoteReplacement(valor);
        });
    }

    private static Datos cargar() {
        try (InputStream entrada = CatalogoCorreos.class.getResourceAsStream("/correos/mensajes.json")) {
            return leer(entrada);
        } catch (IOException | IllegalArgumentException e) {
            throw new IllegalStateException("No se pudo cargar correos/mensajes.json", e);
        }
    }

    static Datos leer(InputStream entrada) throws IOException {
        if (entrada == null) throw new IllegalArgumentException("Falta el catálogo de correos");
        var mapper = new ObjectMapper().enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION);
        Datos datos = mapper.readValue(entrada, Datos.class);
        if (datos == null || datos.textos() == null || datos.correos() == null
                || !datos.textos().keySet().containsAll(TEXTOS) || !datos.correos().keySet().containsAll(IDS)) {
            throw new IllegalArgumentException("El catálogo no contiene todos los IDs y textos requeridos");
        }
        for (var texto : datos.textos().entrySet()) requerido(texto.getValue(), texto.getKey());
        for (var texto : datos.textos().entrySet()) {
            Set<String> permitidas = switch (texto.getKey()) {
                case "horario" -> Set.of("horaInicio", "horaFin");
                case "horaLimite" -> Set.of("horaFin");
                case "calendario.titulo" -> Set.of("idSolicitud");
                case "calendario.detalles" -> Set.of("idSolicitud", "portal");
                default -> Set.of();
            };
            validarVariables(texto.getValue(), permitidas);
        }
        for (var entradaCorreo : datos.correos().entrySet()) {
            Mensaje m = entradaCorreo.getValue();
            if (m == null) throw new IllegalArgumentException("Correo vacío: " + entradaCorreo.getKey());
            requerido(m.descripcion(), "descripcion"); requerido(m.asunto(), "asunto");
            requerido(m.titulo(), "titulo"); requerido(m.mensaje(), "mensaje");
            requerido(m.etiqueta(), "etiqueta"); requerido(m.boton(), "boton");
            if (m.asunto().contains("\r") || m.asunto().contains("\n")) {
                throw new IllegalArgumentException("El asunto de un correo no puede tener saltos de línea");
            }
            Set<String> permitidas = entradaCorreo.getKey().startsWith("solicitud.") && !entradaCorreo.getKey().equals("solicitud.atrasada")
                    ? Set.of("idSolicitud") : Set.of();
            for (String campo : new String[]{m.asunto(), m.titulo(), m.mensaje(), m.etiqueta(), m.boton()}) {
                validarVariables(campo, permitidas);
            }
        }
        return new Datos(Map.copyOf(datos.textos()), Map.copyOf(datos.correos()));
    }

    private static void requerido(String texto, String campo) {
        if (texto == null || texto.isBlank()) throw new IllegalArgumentException("Texto de correo vacío: " + campo);
    }

    private static void validarVariables(String texto, Set<String> permitidas) {
        VARIABLE.matcher(texto).results().forEach(v -> {
            if (!permitidas.contains(v.group(1))) throw new IllegalArgumentException("Variable de correo no admitida: " + v.group(1));
        });
    }
}
