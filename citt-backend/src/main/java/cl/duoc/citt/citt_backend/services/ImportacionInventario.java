package cl.duoc.citt.citt_backend.services;

import cl.duoc.citt.citt_backend.dto.FichaActivoDTO;
import cl.duoc.citt.citt_backend.exception.ReglaNegocioException;
import jakarta.validation.Validator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class ImportacionInventario {
    public record Resultado(int creados, int actualizados, int sinCambios) {}
    private final JdbcTemplate sql;
    private final FichaActivoService fichas;
    private final Validator validator;

    @Transactional
    public Resultado importar(MultipartFile archivo) {
        var filas = LecturaInventario.leer(archivo);
        sql.queryForList("select pg_advisory_xact_lock(321537187)");
        var categorias = catalogo(sql.queryForList("""
                select id_categoria as id, nombre_categoria as nombre from categoria where not eliminado
                """));
        var estados = catalogo(sql.queryForList("select id_estado_articulo as id, nombre_estado as nombre from estado_articulo"));
        var existentes = sql.queryForList("""
                select a.*, e.nombre_estado, f.numero_serie as serie_excel, f.ubicacion_registrada as ubicacion_excel
                from articulo a join estado_articulo e using (id_estado_articulo)
                left join articulo_ficha_activos_fijos f using (id_articulo)
                order by a.id_articulo for update of a
                """);
        var vistos = new HashSet<Long>();
        var altas = new HashSet<String>();
        int creados = 0;
        int actualizados = 0;
        int sinCambios = 0;
        for (var fila : filas) {
            try {
                var datos = fila.datos();
                var anterior = localizar(datos, existentes);
                String nombre = texto(datos, "articulo", anterior, "nombre_articulo");
                if (nombre == null) throw error("falta el nombre del artículo.");
                if (anterior == null) {
                    String codigo = texto(datos, "codigo", null, "");
                    if (codigo != null && !codigo.matches("\\S{1,13}")) throw error("el Código Duoc admite hasta 13 caracteres sin espacios.");
                    String clave = codigo != null ? "codigo:" + codigo.toLowerCase(Locale.ROOT)
                            : "nombre:" + nombre + "|" + datos.get("serieExcel") + "|" + datos.get("ubicacion");
                    if (!altas.add(clave)) throw error("el archivo repite un artículo nuevo.");
                    Long id = sql.queryForObject("""
                            insert into articulo (nombre_articulo, codigo_duoc, marca, eliminado, id_categoria, id_estado_articulo)
                            values (?, ?, 'GENERICO', false, ?, ?) returning id_articulo
                            """, Long.class, nombre, codigo, idCategoria(datos, nombre, null, categorias), estados.get("disponible"));
                    var nueva = sql.queryForMap("select * from articulo where id_articulo = ?", id);
                    actualizar(datos, nueva, nombre, categorias, estados);
                    creados++;
                } else {
                    long id = ((Number) anterior.get("id_articulo")).longValue();
                    if (!vistos.add(id)) throw error("el archivo repite el artículo con ID " + id + ".");
                    if (actualizar(datos, anterior, nombre, categorias, estados)) actualizados++;
                    else sinCambios++;
                }
            } catch (ReglaNegocioException e) {
                throw error("Fila " + fila.numero() + ": " + e.getMessage());
            } catch (ArithmeticException | NumberFormatException | DateTimeParseException e) {
                throw error("Fila " + fila.numero() + ": revisa la fecha o los campos numéricos.");
            }
        }
        return new Resultado(creados, actualizados, sinCambios);
    }

    private boolean actualizar(Map<String, String> datos, Map<String, Object> anterior, String nombre,
                                Map<String, Long> categorias, Map<String, Long> estados) {
        long id = ((Number) anterior.get("id_articulo")).longValue();
        var cambios = new LinkedHashMap<String, Object>();
        cambios.put("nombre_articulo", nombre);
        cambios.put("id_categoria", idCategoria(datos, nombre, anterior, categorias));
        var estado = texto(datos, "estado", null, "");
        if (estado != null) {
            var idEstado = estados.get(LecturaInventario.clave(estado));
            if (idEstado == null) throw error("estado desconocido: " + estado + ".");
            var anteriorEstado = anterior.get("id_estado_articulo");
            if (!idEstado.equals(anteriorEstado) && (idEstado.equals(estados.get("prestado"))
                    || Objects.equals(anteriorEstado, estados.get("prestado")))) {
                throw error("el estado Prestado se cambia desde el flujo de préstamos.");
            }
            cambios.put("id_estado_articulo", idEstado);
        }
        if (datos.containsKey("marca")) cambios.put("marca", Objects.requireNonNullElse(texto(datos, "marca", null, ""), "GENERICO"));
        for (String campo : List.of("etiqueta", "comentarios", "sfai", "colliers")) {
            if (datos.containsKey(campo)) cambios.put(campo, texto(datos, campo, null, ""));
        }
        if (datos.containsKey("serie")) cambios.put("numero_serie", texto(datos, "serie", null, ""));
        if (datos.containsKey("compra")) cambios.put("fecha_compra", fecha(datos.get("compra")));
        if (datos.containsKey("valor")) {
            var valor = numero(datos.get("valor"));
            if (valor != null && (valor.signum() < 0 || !Double.isFinite(valor.doubleValue()))) throw error("valor inválido.");
            cambios.put("valor", valor == null ? null : valor.doubleValue());
        }
        var estadoFinal = cambios.getOrDefault("id_estado_articulo", anterior.get("id_estado_articulo"));
        if ((estadoFinal.equals(estados.get("danado")) || estadoFinal.equals(estados.get("mantencion")))
                && cambios.getOrDefault("comentarios", anterior.get("comentarios")) == null
                && (cambios.containsKey("comentarios") || !estadoFinal.equals(anterior.get("id_estado_articulo")))) {
            throw error("los estados Dañado y Mantención requieren un comentario.");
        }
        cambios.entrySet().removeIf(e -> {
            Object valorAnterior = anterior.get(e.getKey());
            return Objects.equals(e.getValue(), valorAnterior instanceof java.sql.Date fecha ? fecha.toLocalDate() : valorAnterior);
        });
        if (!cambios.isEmpty()) {
            var argumentos = new ArrayList<>(cambios.values());
            argumentos.add(id);
            var columnas = cambios.keySet().stream().map(c -> c + " = ?").toList();
            sql.update("update articulo set " + String.join(", ", columnas) + " where id_articulo = ?", argumentos.toArray());
        }
        var fichaAnterior = fichas.obtener(id);
        var ficha = ficha(datos, fichaAnterior);
        var errores = validator.validate(ficha);
        if (!errores.isEmpty()) throw error("dato de ficha inválido: " + errores.iterator().next().getPropertyPath() + ".");
        if (!ficha.equals(fichaAnterior)) fichas.guardar(id, ficha);
        return !cambios.isEmpty() || !ficha.equals(fichaAnterior);
    }

    private static Map<String, Object> localizar(Map<String, String> fila, List<Map<String, Object>> existentes) {
        String id = texto(fila, "id", null, "");
        String codigo = texto(fila, "codigo", null, "");
        if (id != null) {
            long numero = Long.parseLong(id);
            var articulo = existentes.stream().filter(a -> ((Number) a.get("id_articulo")).longValue() == numero)
                    .findFirst().orElseThrow(() -> error("el ID " + id + " no existe."));
            if (fila.containsKey("codigo") && !Objects.equals(codigo, articulo.get("codigo_duoc"))) {
                throw error("el Código Duoc no coincide con ese ID. Usa el código registrado.");
            }
            return articulo;
        }
        if (codigo != null) {
            return existentes.stream().filter(a -> codigo.equalsIgnoreCase((String) a.get("codigo_duoc")))
                    .findFirst().orElse(null);
        }
        String nombre = texto(fila, "articulo", null, "");
        if (nombre == null) throw error("falta el nombre del artículo.");
        var candidatos = existentes.stream().filter(a -> a.get("codigo_duoc") == null)
                .filter(a -> nombre.equalsIgnoreCase((String) a.get("nombre_articulo"))).toList();
        if (candidatos.size() <= 1) return candidatos.isEmpty() ? null : candidatos.getFirst();
        var serie = texto(fila, "serieExcel", null, "");
        var ubicacion = texto(fila, "ubicacion", null, "");
        var detalle = candidatos.stream().filter(a -> serie != null ? serie.equals(a.get("serie_excel"))
                : ubicacion != null && ubicacion.equals(a.get("ubicacion_excel"))).toList();
        if (detalle.size() != 1) throw error("hay varios artículos con ese nombre. Usa el CSV exportado con sus IDs.");
        return detalle.getFirst();
    }

    private static FichaActivoDTO ficha(Map<String, String> d, FichaActivoDTO f) {
        var cantidad = d.containsKey("cantidad") ? numero(d.get("cantidad")) : null;
        var monto = d.containsKey("monto") ? numero(d.get("monto")) : null;
        return new FichaActivoDTO(d.containsKey("cantidad") ? (cantidad == null ? null : cantidad.intValueExact()) : f.cantidad(),
                campo(d, "serieExcel", f.numeroSerie()),
                d.containsKey("adquisicion") ? fecha(d.get("adquisicion")) : f.adquisicion(),
                d.containsKey("monto") ? (monto == null ? null : monto.longValueExact()) : f.montoActivo(),
                campo(d, "ubicacion", f.ubicacionRegistrada()), campo(d, "confirmacion", f.confirmarUbicacion()),
                campo(d, "etiquetaExcel", f.poseeEtiquetaDuoc()), campo(d, "observacion", f.observacion()));
    }

    private static String campo(Map<String, String> d, String campo, String previo) {
        return d.containsKey(campo) ? texto(d, campo, null, "") : previo;
    }

    private static String texto(Map<String, String> d, String campo, Map<String, Object> previo, String columna) {
        if (!d.containsKey(campo)) return previo == null ? null : (String) previo.get(columna);
        String texto = d.get(campo).strip();
        int max = campo.equals("observacion") ? 5000 : 255;
        if (texto.length() > max) throw error("campo demasiado largo: " + campo + ".");
        return texto.isEmpty() ? null : texto;
    }

    private static Long idCategoria(Map<String, String> d, String nombre, Map<String, Object> previo, Map<String, Long> categorias) {
        String categoria = texto(d, "categoria", null, "");
        if (categoria == null && previo != null) return ((Number) previo.get("id_categoria")).longValue();
        if (categoria == null) {
            var n = LecturaInventario.clave(nombre);
            if (n.matches(".*\\b(notebook|macbook|mbpr)\\b.*")) categoria = "notebook";
            else if (n.matches(".*\\b(robot|mindstorms)\\b.*")) categoria = "robot";
            else if (n.matches(".*\\b(impresora 3d|bamboo labs a1|creality k1)\\b.*")) categoria = "impresora 3d";
            else if (n.matches(".*\\b(televisor|monitor|tv)\\b.*")) categoria = "monitor o tv";
            else categoria = "otros";
            if (!categorias.containsKey(categoria)) categoria = "otros";
        }
        Long id = categorias.get(LecturaInventario.clave(categoria));
        if (id == null) throw error("categoría no disponible: " + categoria + ".");
        return id;
    }

    private static Map<String, Long> catalogo(List<Map<String, Object>> datos) {
        var mapa = new HashMap<String, Long>();
        for (var fila : datos) mapa.put(LecturaInventario.clave((String) fila.get("nombre")), ((Number) fila.get("id")).longValue());
        return mapa;
    }

    private static BigDecimal numero(String valor) {
        if (valor.isBlank()) return null;
        String limpio = valor.strip();
        if (limpio.contains(",")) limpio = limpio.replace(".", "").replace(',', '.');
        return new BigDecimal(limpio);
    }

    private static LocalDate fecha(String valor) {
        if (valor.isBlank()) return null;
        try { return LocalDate.parse(valor.strip()); }
        catch (DateTimeParseException e) {
            return LocalDate.parse(valor.strip(), DateTimeFormatter.ofPattern("d/M/uuuu").withResolverStyle(java.time.format.ResolverStyle.STRICT));
        }
    }

    private static ReglaNegocioException error(String mensaje) {
        return new ReglaNegocioException(mensaje);
    }
}
