package cl.duoc.citt.citt_backend.controllers;

import cl.duoc.citt.citt_backend.exception.ReglaNegocioException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/plano-citt")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('COORDINADOR', 'DIRECTOR')")
public class PlanoCittController {
    private static final Set<String> CLAVES = Set.of("1", "2", "3", "4", "5", "CI", "ST", "MR", "CW", "P1", "P2", "P3");
    private final JdbcTemplate sql;
    private final ObjectMapper json;

    public record Posicion(Double x, Double y, Double giro) {}
    public record Distribucion(long revision, Map<String, Posicion> posiciones) {}

    @GetMapping
    public ResponseEntity<Distribucion> obtener() {
        var datos = sql.query("select revision, posiciones from distribucion_plano_citt where id = 1",
                (fila, indice) -> new Distribucion(fila.getLong("revision"), leer(fila.getString("posiciones"))));
        return respuesta(datos.isEmpty() ? new Distribucion(0, Map.of()) : datos.getFirst());
    }

    @PutMapping
    public ResponseEntity<Distribucion> guardar(@RequestBody Distribucion distribucion) throws JsonProcessingException {
        var posiciones = distribucion.posiciones();
        if (distribucion.revision() < 0 || distribucion.revision() == Long.MAX_VALUE || posiciones == null
                || !CLAVES.containsAll(posiciones.keySet()) || posiciones.values().stream().anyMatch(
                        p -> p == null || !valida(p.x(), 786) || !valida(p.y(), 484)
                                || (p.giro() != null && (!Double.isFinite(p.giro()) || p.giro() < 0 || p.giro() >= 360)))) {
            throw new ReglaNegocioException("Distribución del plano inválida");
        }
        long revision = distribucion.revision();
        String contenido = json.writeValueAsString(posiciones);
        int actualizado = revision == 0
                ? sql.update("insert into distribucion_plano_citt (id, posiciones, revision) values (1, ?, 1) on conflict do nothing", contenido)
                : sql.update("update distribucion_plano_citt set posiciones = ?, revision = revision + 1 where id = 1 and revision = ?", contenido, revision);
        if (actualizado == 0) {
            throw new ReglaNegocioException("El plano se actualizó en otra sesión", HttpStatus.CONFLICT);
        }
        return respuesta(new Distribucion(revision + 1, posiciones));
    }

    private Map<String, Posicion> leer(String contenido) {
        try {
            return json.readValue(contenido, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Distribución guardada inválida", e);
        }
    }

    private static boolean valida(Double valor, int maximo) {
        return valor != null && Double.isFinite(valor) && Math.abs(valor) <= maximo;
    }

    private static ResponseEntity<Distribucion> respuesta(Distribucion distribucion) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(distribucion);
    }
}
