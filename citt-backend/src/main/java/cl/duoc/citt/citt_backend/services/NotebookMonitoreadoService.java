package cl.duoc.citt.citt_backend.services;

import cl.duoc.citt.citt_backend.model.NotebookMonitoreado;
import cl.duoc.citt.citt_backend.repositories.NotebookMonitoreadoRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class NotebookMonitoreadoService {
    private static final SecureRandom ALEATORIO = new SecureRandom();
    private static final Set<String> ESTADOS = Set.of("encendido", "suspendido", "apagado", "desconocido");
    private static final Set<String> EVENTOS = Set.of("inicio", "apagado", "suspension", "reanudacion");
    private final NotebookMonitoreadoRepository repositorio;

    public record Credencial(String identificador, String clave, String ruta_reportes) {}
    public record Ubicacion(double latitud, double longitud, double precisionMetros, Instant observada) {}
    public record Equipo(Long idArticulo, String articulo, String codigoDuoc, String numeroSerie,
                         String estadoInventario, Instant recibido, Instant observado, JsonNode reporte,
                         boolean prestamoExterno, Ubicacion ubicacion) {}

    @Transactional
    public Credencial emitirCredencial(Long articuloId, boolean renovar) {
        var articulo = repositorio.bloquearArticulo(articuloId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Artículo no encontrado"));
        var existente = repositorio.findByArticuloIdArticulo(articuloId);
        if (existente.isPresent() && !renovar) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El notebook ya tiene credencial");
        }
        var notebook = existente.orElseGet(NotebookMonitoreado::new);
        byte[] bytes = new byte[32];
        ALEATORIO.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        notebook.setArticulo(articulo);
        notebook.setHashToken(hash(token));
        repositorio.save(notebook);
        return new Credencial("CITT-" + articuloId, token, "/api/notebooks/reportes");
    }

    @Transactional(readOnly = true)
    public List<Equipo> listar() {
        var prestamos = repositorio.listarPrestamosExternos().stream()
                .collect(Collectors.toMap(NotebookMonitoreadoRepository.PrestamoExterno::getArticuloId,
                        NotebookMonitoreadoRepository.PrestamoExterno::getSolicitudId));
        return repositorio.listarConArticulo().stream().map(n -> {
            var a = n.getArticulo();
            Long prestamo = prestamos.get(a.getIdArticulo());
            JsonNode reporte = n.getReporte();
            Ubicacion ubicacion = null;
            if (reporte instanceof ObjectNode objeto) {
                ObjectNode publico = objeto.deepCopy();
                JsonNode lectura = publico.remove("ubicacion");
                if (ubicacionDelPrestamo(lectura, prestamo)) {
                    ubicacion = new Ubicacion(lectura.path("latitud").doubleValue(),
                            lectura.path("longitud").doubleValue(), lectura.path("precisionMetros").doubleValue(),
                            Instant.parse(lectura.path("observada").asText()));
                }
                reporte = publico;
            }
            return new Equipo(a.getIdArticulo(), a.getNombreArticulo(), a.getCodigoDuoc(), a.getNumeroSerie(),
                    a.getEstadoArticulo().getNombreEstado(), n.getRecibido(), n.getObservado(), reporte,
                    prestamo != null, ubicacion);
        }).toList();
    }

    @Transactional
    public Long guardar(String autorizacion, JsonNode datos) {
        var notebook = autenticar(autorizacion);
        ObjectNode reporte = validar(datos);
        Instant observado = OffsetDateTime.parse(reporte.get("actualizado").textValue()).toInstant();
        Instant recibido = Instant.now();
        if (observado.isAfter(recibido.plusSeconds(300))) throw invalido("Revisa la hora del notebook");
        Long prestamo = repositorio.buscarPrestamoExterno(notebook.getArticulo().getIdArticulo()).orElse(null);
        if (notebook.getObservado() != null && !observado.isAfter(notebook.getObservado())) return null;
        JsonNode ubicacionAnterior = notebook.getReporte() == null ? null : notebook.getReporte().path("ubicacion");
        if (ubicacionDelPrestamo(ubicacionAnterior, prestamo)) reporte.set("ubicacion", ubicacionAnterior);
        notebook.setReporte(reporte);
        notebook.setObservado(observado);
        notebook.setRecibido(recibido);
        return observado.isBefore(recibido.minusSeconds(120)) ? null : prestamo;
    }

    @Transactional
    public void guardarUbicacion(String autorizacion, JsonNode datos) {
        var notebook = autenticar(autorizacion);
        Long prestamo = repositorio.buscarPrestamoExterno(notebook.getArticulo().getIdArticulo()).orElse(null);
        JsonNode solicitud = datos.path("prestamoExterno");
        if (prestamo == null || !solicitud.isIntegralNumber() || !solicitud.canConvertToLong()
                || !Objects.equals(prestamo, solicitud.longValue()) || !(notebook.getReporte() instanceof ObjectNode reporte)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El préstamo externo no está activo");
        }
        Instant observada;
        try {
            observada = OffsetDateTime.parse(texto(datos.path("observada"), 60, "Fecha de ubicación")).toInstant();
        } catch (DateTimeParseException e) {
            throw invalido("La fecha de ubicación debe incluir zona horaria");
        }
        Instant ahora = Instant.now();
        if (observada.isBefore(ahora.minusSeconds(120)) || observada.isAfter(ahora.plusSeconds(30))) {
            throw invalido("Lectura de ubicación fuera de plazo");
        }
        double latitud = coordenada(datos.path("latitud"), -90, 90);
        double longitud = coordenada(datos.path("longitud"), -180, 180);
        double precision = coordenada(datos.path("precisionMetros"), 1, 100_000);
        JsonNode anterior = reporte.path("ubicacion");
        if (ubicacionDelPrestamo(anterior, prestamo)
                && !observada.isAfter(Instant.parse(anterior.path("observada").asText()))) return;
        ObjectNode actualizado = reporte.deepCopy();
        actualizado.putObject("ubicacion").put("prestamoExterno", prestamo)
                .put("latitud", latitud).put("longitud", longitud).put("precisionMetros", precision)
                .put("observada", observada.toString());
        notebook.setReporte(actualizado);
    }

    private NotebookMonitoreado autenticar(String autorizacion) {
        if (autorizacion == null || !autorizacion.matches("Bearer [A-Za-z0-9_-]{43}")) throw sinCredencial();
        var notebook = repositorio.findByHashToken(hash(autorizacion.substring(7)))
                .orElseThrow(NotebookMonitoreadoService::sinCredencial);
        if (notebook.getArticulo() == null || notebook.getArticulo().isEliminado()) throw sinCredencial();
        return notebook;
    }

    private static boolean ubicacionDelPrestamo(JsonNode ubicacion, Long prestamo) {
        return prestamo != null && ubicacion != null && ubicacion.path("prestamoExterno").asLong() == prestamo;
    }

    private static double coordenada(JsonNode valor, double minimo, double maximo) {
        double numero = valor.asDouble(Double.NaN);
        if (!valor.isNumber() || !Double.isFinite(numero) || numero < minimo || numero > maximo) {
            throw invalido("Datos de ubicación inválidos");
        }
        return numero;
    }

    private ObjectNode validar(JsonNode datos) {
        if (datos == null || !datos.isObject()) throw invalido("Se esperaba un reporte JSON");
        ObjectNode reporte = JsonNodeFactory.instance.objectNode();
        reporte.put("equipo", texto(datos.path("equipo"), 200, "Nombre del equipo"));
        String actualizado = texto(datos.path("actualizado"), 60, "Fecha de lectura");
        try {
            OffsetDateTime.parse(actualizado);
        } catch (DateTimeParseException e) {
            throw invalido("La fecha de lectura debe incluir zona horaria");
        }
        reporte.put("actualizado", actualizado);
        JsonNode estado = datos.path("estado");
        String energia = estado.isMissingNode() ? "encendido" : texto(estado, 30, "Estado de energía");
        if (!ESTADOS.contains(energia)) throw invalido("Estado de energía inválido");
        reporte.put("estado", energia);
        JsonNode eventos = datos.path("eventos_energia");
        if (eventos.isArray() && eventos.size() <= 12) {
            var historial = reporte.putArray("eventos_energia");
            for (JsonNode evento : eventos) {
                String tipo = evento.path("tipo").asText();
                JsonNode fecha = evento.path("fecha");
                if (EVENTOS.contains(tipo) && fechaValida(fecha)) {
                    historial.addObject().put("tipo", tipo).set("fecha", fecha);
                }
            }
        }
        JsonNode bateria = datos.path("bateria");
        JsonNode porcentaje = bateria.path("porcentaje");
        JsonNode cargador = bateria.path("cargador_conectado");
        if (!(porcentaje.isNull() || (porcentaje.isNumber() && porcentaje.doubleValue() >= 0
                && porcentaje.doubleValue() <= 100))) throw invalido("Porcentaje de batería inválido");
        if (!(cargador.isNull() || cargador.isBoolean())) throw invalido("Estado del cargador inválido");
        ObjectNode energiaBateria = reporte.putObject("bateria");
        energiaBateria.set("porcentaje", porcentaje);
        energiaBateria.set("cargador_conectado", cargador);
        JsonNode programas = datos.path("programas");
        if (!programas.isArray() || programas.size() > 10_000) throw invalido("Inventario inválido");
        var inventario = reporte.putArray("programas");
        for (JsonNode programa : programas) {
            var entrada = inventario.addObject();
            entrada.put("nombre", texto(programa.path("nombre"), 500, "Nombre del programa"));
            for (String campo : List.of("version", "editor", "ambito")) {
                JsonNode valor = programa.path(campo);
                if (valor.isTextual() && valor.textValue().length() <= 500) entrada.set(campo, valor);
            }
        }
        JsonNode uso = datos.path("uso_programas");
        if (uso.isArray() && uso.size() <= programas.size()) {
            var ejecuciones = reporte.putArray("uso_programas");
            for (JsonNode programa : uso) {
                JsonNode nombre = programa.path("nombre");
                JsonNode ultima = programa.path("ultima_ejecucion");
                if (!nombre.isTextual() || nombre.textValue().length() > 500 || !fechaValida(ultima)) continue;
                var entrada = ejecuciones.addObject();
                entrada.set("nombre", nombre);
                entrada.set("ultima_ejecucion", ultima);
            }
        }
        return reporte;
    }

    private static boolean fechaValida(JsonNode valor) {
        if (!valor.isTextual() || valor.textValue().length() > 60) return false;
        try {
            OffsetDateTime.parse(valor.textValue());
            return true;
        } catch (DateTimeParseException e) {
            return false;
        }
    }

    private static String texto(JsonNode valor, int maximo, String campo) {
        if (!valor.isTextual() || valor.textValue().isBlank() || valor.textValue().length() > maximo) {
            throw invalido(campo + " inválido");
        }
        return valor.textValue();
    }

    private static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible", e);
        }
    }

    private static ResponseStatusException sinCredencial() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credencial de notebook inválida");
    }

    private static ResponseStatusException invalido(String mensaje) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, mensaje);
    }
}
