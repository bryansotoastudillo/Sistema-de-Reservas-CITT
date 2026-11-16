package cl.duoc.citt.citt_backend.services;

import cl.duoc.citt.citt_backend.dto.FichaActivoDTO;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class FichaActivoService {
    private final JdbcTemplate sql;

    public FichaActivoDTO obtener(long id) {
        return sql.query("""
                select cantidad, numero_serie, adquisicion, monto_activo, ubicacion_registrada,
                       confirmar_ubicacion, posee_etiqueta_duoc, observacion
                from articulo_ficha_activos_fijos where id_articulo = ?
                """, (rs, fila) -> new FichaActivoDTO(rs.getObject(1, Integer.class), rs.getString(2),
                rs.getObject(3, LocalDate.class), rs.getObject(4, Long.class), rs.getString(5),
                rs.getString(6), rs.getString(7), rs.getString(8)), id).stream().findFirst()
                .orElseGet(() -> new FichaActivoDTO(null, null, null, null, null, null, null, null));
    }

    public void guardar(long id, FichaActivoDTO f) {
        sql.update("""
                insert into articulo_ficha_activos_fijos (id_articulo, cantidad, numero_serie, adquisicion,
                        monto_activo, ubicacion_registrada, confirmar_ubicacion, posee_etiqueta_duoc, observacion)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                on conflict (id_articulo) do update set cantidad=excluded.cantidad, numero_serie=excluded.numero_serie,
                    adquisicion=excluded.adquisicion, monto_activo=excluded.monto_activo,
                    ubicacion_registrada=excluded.ubicacion_registrada, confirmar_ubicacion=excluded.confirmar_ubicacion,
                    posee_etiqueta_duoc=excluded.posee_etiqueta_duoc, observacion=excluded.observacion
                """, id, f.cantidad(), f.numeroSerie(), f.adquisicion(), f.montoActivo(), f.ubicacionRegistrada(),
                f.confirmarUbicacion(), f.poseeEtiquetaDuoc(), f.observacion());
    }
}
