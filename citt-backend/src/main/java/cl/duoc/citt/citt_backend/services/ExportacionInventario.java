package cl.duoc.citt.citt_backend.services;

import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ExportacionInventario {
    private static final String[] CABECERA = {
            "ID", "Código Duoc", "Artículo", "Categoría", "Estado", "Dado de baja", "Marca",
            "Número de serie", "Fecha de compra", "Valor", "Etiqueta", "Comentarios", "SFAI", "Colliers",
            "Cantidad (Excel)", "N° serie (Excel)", "Adquisición (Excel)", "Monto activo (Excel)",
            "Ubicación registrada (Excel)", "Confirmar ubicación (Excel)", "Posee etiqueta Duoc (Excel)", "Observación (Excel)"
    };
    private final JdbcTemplate sql;

    public byte[] generar() {
        var csv = new StringBuilder("\uFEFF");
        escribirFila(csv, (Object[]) CABECERA);
        sql.query("""
                select a.id_articulo, a.codigo_duoc, a.nombre_articulo, c.nombre_categoria, e.nombre_estado,
                       case when a.eliminado then 'Sí' else 'No' end, a.marca, a.numero_serie, a.fecha_compra,
                       a.valor, a.etiqueta, a.comentarios, a.sfai, a.colliers,
                       f.cantidad, f.numero_serie, f.adquisicion, f.monto_activo, f.ubicacion_registrada,
                       f.confirmar_ubicacion, f.posee_etiqueta_duoc, f.observacion
                from articulo a
                join categoria c on c.id_categoria = a.id_categoria
                join estado_articulo e on e.id_estado_articulo = a.id_estado_articulo
                left join articulo_ficha_activos_fijos f on f.id_articulo = a.id_articulo
                order by a.nombre_articulo, a.id_articulo
                """, (RowCallbackHandler) fila -> escribirArticulo(csv, fila));
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    private static void escribirArticulo(StringBuilder csv, ResultSet fila) throws java.sql.SQLException {
        var valores = new Object[CABECERA.length];
        for (int i = 0; i < valores.length; i++) valores[i] = fila.getObject(i + 1);
        escribirFila(csv, valores);
    }

    private static void escribirFila(StringBuilder csv, Object... valores) {
        for (int i = 0; i < valores.length; i++) {
            if (i > 0) csv.append(';');
            if (valores[i] == null) continue;
            String texto = valores[i].toString();
            if (valores[i] instanceof Double || valores[i] instanceof java.math.BigDecimal) {
                texto = texto.replace('.', ',');
            }
            if (valores[i] instanceof String && texto.stripLeading().matches("(?s)^[=+@-].*")) {
                texto = "'" + texto;
            }
            csv.append('"').append(texto.replace("\"", "\"\"")).append('"');
        }
        csv.append("\r\n");
    }
}
