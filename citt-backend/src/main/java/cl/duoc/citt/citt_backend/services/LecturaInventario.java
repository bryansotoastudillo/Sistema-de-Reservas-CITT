package cl.duoc.citt.citt_backend.services;

import cl.duoc.citt.citt_backend.exception.ReglaNegocioException;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.*;
import java.text.Normalizer;
import java.util.*;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.openxml4j.util.ZipSecureFile;
import org.springframework.web.multipart.MultipartFile;

final class LecturaInventario {
    record Fila(int numero, Map<String, String> datos) {}
    private static final int MAX_FILAS = 2_000;

    static {
        ZipSecureFile.setMaxEntrySize(8 * 1024 * 1024);
        ZipSecureFile.setMaxFileCount(150);
    }

    private LecturaInventario() {}

    static List<Fila> leer(MultipartFile archivo) {
        if (archivo.isEmpty() || archivo.getSize() > 1_048_576) {
            throw new ReglaNegocioException("Selecciona un CSV o XLSX de hasta 1 MB.");
        }
        String nombre = Objects.toString(archivo.getOriginalFilename(), "").toLowerCase(Locale.ROOT);
        try {
            List<Fila> filas;
            if (nombre.endsWith(".csv")) filas = csv(archivo.getBytes());
            else if (nombre.endsWith(".xlsx")) filas = excel(archivo);
            else throw new ReglaNegocioException("El archivo debe ser CSV o XLSX.");
            if (filas.isEmpty()) throw new ReglaNegocioException("El archivo no contiene filas de inventario.");
            return filas;
        } catch (IOException | IllegalArgumentException | java.io.UncheckedIOException | org.apache.poi.ooxml.POIXMLException e) {
            throw new ReglaNegocioException("No se pudo leer el archivo. Revisa que sea un CSV o XLSX válido.");
        }
    }

    private static List<Fila> csv(byte[] bytes) throws IOException {
        String texto;
        try {
            texto = StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes)).toString();
        } catch (CharacterCodingException e) {
            texto = new String(bytes, Charset.forName("windows-1252"));
        }
        texto = texto.replaceFirst("^\uFEFF", "");
        var filas = new ArrayList<Fila>();
        for (char separador : new char[] {';', ',', '\t'}) {
            try (CSVParser parser = CSVParser.parse(texto, CSVFormat.DEFAULT.builder().setDelimiter(separador).get())) {
                var registros = parser.iterator();
                if (!registros.hasNext()) break;
                var encabezado = registros.next();
                var columnas = columnas(encabezado.toList());
                if (!esInventario(columnas)) continue;
                while (registros.hasNext()) {
                    var registro = registros.next();
                    if (registro.size() != encabezado.size()) {
                        throw new ReglaNegocioException("Fila " + registro.getRecordNumber() + ": número de columnas incorrecto.");
                    }
                    agregar(filas, (int) registro.getRecordNumber(), columnas, registro::get);
                }
                return filas;
            } catch (java.io.UncheckedIOException e) {
                if (separador == '\t') throw e;
                if (!filas.isEmpty()) throw e;
            }
        }
        throw encabezadoInvalido();
    }

    private static List<Fila> excel(MultipartFile archivo) throws IOException {
        try (var entrada = archivo.getInputStream(); var libro = new XSSFWorkbook(entrada)) {
            Sheet hoja = libro.getSheet("CITT");
            if (hoja == null && libro.getNumberOfSheets() > 0) hoja = libro.getSheetAt(0);
            if (hoja == null) throw encabezadoInvalido();
            var formato = new DataFormatter(Locale.forLanguageTag("es-CL"));
            formato.setUseCachedValuesForFormulaCells(true);
            var filas = new ArrayList<Fila>();
            Map<Integer, String> columnas = null;
            for (Row fila : hoja) {
                if (columnas == null) {
                    if (fila.getRowNum() > 20) break;
                    var nombres = new ArrayList<String>();
                    for (int i = 0; i < Math.min(fila.getLastCellNum(), 100); i++) {
                        nombres.add(formato.formatCellValue(fila.getCell(i)));
                    }
                    var propuesta = columnas(nombres);
                    if (esInventario(propuesta)) columnas = propuesta;
                } else {
                    var campos = columnas;
                    agregar(filas, fila.getRowNum() + 1, campos, i -> celda(fila.getCell(i), formato, campos.get(i)));
                }
            }
            if (columnas == null) throw encabezadoInvalido();
            return filas;
        }
    }

    private static String celda(Cell celda, DataFormatter formato, String campo) {
        if (celda == null) return "";
        CellType tipo = celda.getCellType() == CellType.FORMULA ? celda.getCachedFormulaResultType() : celda.getCellType();
        if (tipo == CellType.NUMERIC) {
            if (DateUtil.isCellDateFormatted(celda)) return celda.getLocalDateTimeCellValue().toLocalDate().toString();
            if (Set.of("valor", "monto", "cantidad", "id").contains(campo)
                    || (campo.equals("codigo") && !formato.formatCellValue(celda).matches("\\d+"))) {
                return java.math.BigDecimal.valueOf(celda.getNumericCellValue()).stripTrailingZeros().toPlainString();
            }
        }
        return formato.formatCellValue(celda);
    }

    private static void agregar(List<Fila> filas, int numero, Map<Integer, String> columnas,
                                java.util.function.IntFunction<String> valor) {
        var datos = new LinkedHashMap<String, String>();
        columnas.forEach((indice, nombre) -> datos.put(nombre, limpiar(valor.apply(indice))));
        if (datos.values().stream().allMatch(String::isBlank)) return;
        if (filas.size() >= MAX_FILAS) throw new ReglaNegocioException("El archivo admite hasta 2.000 filas.");
        filas.add(new Fila(numero, datos));
    }

    private static String limpiar(String dato) {
        if (dato.startsWith("'") && dato.substring(1).stripLeading().matches("(?s)^[=+@-].*")) return dato.substring(1);
        return dato;
    }

    private static boolean esInventario(Map<Integer, String> columnas) {
        return columnas.containsValue("articulo") && (columnas.containsValue("codigo") || columnas.containsValue("id"));
    }

    private static ReglaNegocioException encabezadoInvalido() {
        return new ReglaNegocioException("Se necesitan las columnas Artículo y Código Duoc o ID. También puedes usar N° ACTIVO y NOMBRE ACTIVO FIJO.");
    }

    static String clave(String texto) {
        return Normalizer.normalize(texto.strip(), Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    private static Map<Integer, String> columnas(List<String> nombres) {
        var columnas = new LinkedHashMap<Integer, String>();
        for (int i = 0; i < nombres.size(); i++) {
            String campo = switch (clave(nombres.get(i))) {
                case "id" -> "id";
                case "codigo duoc", "n° activo", "nº activo" -> "codigo";
                case "articulo", "nombre activo fijo" -> "articulo";
                case "categoria" -> "categoria";
                case "estado" -> "estado";
                case "marca", "valor", "etiqueta", "comentarios", "sfai", "colliers" -> clave(nombres.get(i));
                case "numero de serie" -> "serie";
                case "fecha de compra" -> "compra";
                case "cantidad (excel)", "cantidad" -> "cantidad";
                case "n° serie (excel)", "n° serie", "nº serie" -> "serieExcel";
                case "adquisicion (excel)", "adquisicion" -> "adquisicion";
                case "monto activo (excel)", "monto activo" -> "monto";
                case "ubicacion registrada (excel)", "ubicacion registrada" -> "ubicacion";
                case "confirmar ubicacion (excel)", "confirmar ubicacion" -> "confirmacion";
                case "posee etiqueta duoc (excel)", "posee etiqueta duoc" -> "etiquetaExcel";
                case "observacion (excel)", "observacion" -> "observacion";
                default -> null;
            };
            if (campo != null) {
                if (columnas.containsValue(campo)) throw new ReglaNegocioException("Columna repetida: " + nombres.get(i));
                columnas.put(i, campo);
            }
        }
        return columnas;
    }
}
