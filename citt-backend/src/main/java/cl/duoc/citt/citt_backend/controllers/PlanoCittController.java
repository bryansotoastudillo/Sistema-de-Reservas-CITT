package cl.duoc.citt.citt_backend.controllers;

import cl.duoc.citt.citt_backend.exception.ReglaNegocioException;
import cl.duoc.citt.citt_backend.services.EspacioService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.Set;
import java.util.List;
import java.util.regex.Pattern;
import java.time.Instant;
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
public class PlanoCittController {
    private static final Set<String> CLAVES = Set.of("1", "2", "3", "4", "5", "CI", "ST", "MR", "CW", "P1", "P2", "P3");
    private static final Pattern CLAVE_MUEBLE =
            Pattern.compile("MR-(mesa-1|silla-[1-6])|CW-(mesa-[1-9]|silla-([1-9]|1[0-2]))");
    // Las coordenadas del mueble son relativas a su zona, que también puede girar.
    private static final int LIMITE_LOCAL = (int) Math.ceil(Math.hypot(786, 484));
    private final JdbcTemplate sql;
    private final ObjectMapper json;
    private final EspacioService espacios;

    public record Posicion(Double x, Double y, Double giro) {}
    public record Distribucion(long revision, Map<String, Posicion> posiciones) {}
    public record EspacioVisor(Long id, String nombre, String estado, Boolean enUsoAhora, String clavePlano) {}
    public record VistaPlano(long revision, Map<String, Posicion> posiciones, List<EspacioVisor> espacios,
                             Instant consultadoEn) {}

    @GetMapping("/visor")
    public ResponseEntity<VistaPlano> visor() {
        var distribucion = leerDistribucion();
        var ocupacion = espacios.listar(null).stream()
                .map(e -> new EspacioVisor(e.getId(), e.getNombre(), e.getEstado(), e.getEnUsoAhora(), e.getClavePlano()))
                .toList();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(new VistaPlano(distribucion.revision(), distribucion.posiciones(), ocupacion, Instant.now()));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('COORDINADOR', 'DIRECTOR')")
    public ResponseEntity<Distribucion> obtener() {
        return respuesta(leerDistribucion());
    }

    private Distribucion leerDistribucion() {
        var datos = sql.query("select revision, posiciones from distribucion_plano_citt where id = 1",
                (fila, indice) -> new Distribucion(fila.getLong("revision"), leer(fila.getString("posiciones"))));
        return datos.isEmpty() ? new Distribucion(0, Map.of()) : datos.getFirst();
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('COORDINADOR', 'DIRECTOR')")
    public ResponseEntity<Distribucion> guardar(@RequestBody Distribucion distribucion) throws JsonProcessingException {
        var posiciones = distribucion.posiciones();
        if (distribucion.revision() < 0 || distribucion.revision() == Long.MAX_VALUE || posiciones == null
                || posiciones.entrySet().stream().anyMatch(entrada -> !posicionValida(entrada.getKey(), entrada.getValue()))) {
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

    private static boolean posicionValida(String clave, Posicion posicion) {
        if (posicion == null) return false;
        boolean mueble = CLAVE_MUEBLE.matcher(clave).matches();
        return (mueble || CLAVES.contains(clave))
                && valida(posicion.x(), mueble ? LIMITE_LOCAL : 786)
                && valida(posicion.y(), mueble ? LIMITE_LOCAL : 484)
                && (posicion.giro() == null || Double.isFinite(posicion.giro())
                        && posicion.giro() >= 0 && posicion.giro() < 360);
    }

    private static ResponseEntity<Distribucion> respuesta(Distribucion distribucion) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(distribucion);
    }
}
