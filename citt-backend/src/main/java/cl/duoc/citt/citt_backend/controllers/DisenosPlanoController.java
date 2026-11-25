package cl.duoc.citt.citt_backend.controllers;

import cl.duoc.citt.citt_backend.exception.ReglaNegocioException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.sql.Timestamp;
import java.util.*;
import java.io.ByteArrayInputStream;
import java.nio.ByteBuffer;
import javax.imageio.ImageIO;

@RestController
@RequestMapping("/api/plano-citt/disenos")
@PreAuthorize("hasAnyRole('COORDINADOR', 'DIRECTOR')")
@RequiredArgsConstructor
public class DisenosPlanoController {
    private final JdbcTemplate sql;
    private final ObjectMapper json;
    public record Tarjeta(String id, String nombre, String miniatura, Instant creado) {}
    public record Diseno(String id, String nombre, Map<String, PlanoCittController.Posicion> posiciones) {}
    public record Nuevo(String nombre, Map<String, PlanoCittController.Posicion> posiciones, String miniatura) {}
    public record Portada(String miniatura) {}

    @GetMapping @Transactional
    public ResponseEntity<List<Tarjeta>> listar() {
        inicializar();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(sql.query("""
            select id,nombre,case when miniatura is null then null else 'presente' end,creado from diseno_plano_citt
            order by case when id='predeterminado' then 0 else 1 end, creado desc
            """, (r,i)->new Tarjeta(r.getString(1),r.getString(2),r.getString(3)==null?null:"/plano-citt/disenos/"+r.getString(1)+"/portada",r.getTimestamp(4).toInstant())));
    }

    private void inicializar() {
        // Primera distribución publicada, conservada una sola vez como punto de restauración.
        sql.update("""
            insert into diseno_plano_citt (id,nombre,posiciones,creado)
            values ('predeterminado','Predeterminado',
              coalesce((select posiciones from distribucion_plano_citt where id=1),'{}'),now())
            on conflict (id) do nothing
            """);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Diseno> obtener(@PathVariable String id) {
        var encontrados=sql.query("select id,nombre,posiciones from diseno_plano_citt where id=?",(r,i)->{
            try { return new Diseno(r.getString(1),r.getString(2),json.readValue(r.getString(3),new TypeReference<Map<String,PlanoCittController.Posicion>>(){})); }
            catch(Exception e){throw new IllegalStateException("Diseño guardado inválido",e);}
        },id);
        if(encontrados.isEmpty())throw new ReglaNegocioException("Diseño no encontrado",HttpStatus.NOT_FOUND);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(encontrados.getFirst());
    }

    @PostMapping @Transactional
    public ResponseEntity<Tarjeta> crear(@RequestBody Nuevo nuevo) throws Exception {
        if(nuevo==null || nuevo.nombre()==null || nuevo.nombre().isBlank() || nuevo.nombre().strip().length()>80
                || "predeterminado".equalsIgnoreCase(nuevo.nombre().strip())
                || !PlanoCittController.distribucionValida(new PlanoCittController.Distribucion(0,nuevo.posiciones())))
            throw new ReglaNegocioException("Nombre o distribución de diseño inválidos");
        validarMiniatura(nuevo.miniatura());
        sql.execute("select pg_advisory_xact_lock(734927)");
        inicializar();
        if(sql.queryForObject("select count(*) from diseno_plano_citt",Long.class)>=30)
            throw new ReglaNegocioException("Puedes conservar hasta 30 diseños. Elimina uno antes de añadir otro.");
        if(sql.queryForObject("select count(*) from diseno_plano_citt where lower(nombre)=lower(?)",Long.class,nuevo.nombre().strip())>0)
            throw new ReglaNegocioException("Ya existe un diseño con ese nombre");
        String id=UUID.randomUUID().toString(); Instant ahora=Instant.now();
        sql.update("insert into diseno_plano_citt(id,nombre,posiciones,miniatura,creado) values (?,?,?,?,?)",
                id,nuevo.nombre().strip(),json.writeValueAsString(nuevo.posiciones()),nuevo.miniatura(),Timestamp.from(ahora));
        return ResponseEntity.status(HttpStatus.CREATED).body(new Tarjeta(id,nuevo.nombre().strip(),"/plano-citt/disenos/"+id+"/portada",ahora));
    }

    @GetMapping("/{id}/portada")
    public ResponseEntity<byte[]> imagen(@PathVariable String id) {
        var imagenes=sql.query("select miniatura from diseno_plano_citt where id=? and miniatura is not null",(r,i)->r.getString(1),id);
        if(imagenes.isEmpty())return ResponseEntity.notFound().build();
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG)
                .cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(30)).cachePrivate().immutable())
                .body(Base64.getDecoder().decode(imagenes.getFirst().substring(22)));
    }

    @PatchMapping("/{id}/portada")
    public ResponseEntity<Void> portada(@PathVariable String id,@RequestBody Portada portada) {
        validarMiniatura(portada.miniatura());
        sql.update("update diseno_plano_citt set miniatura=? where id=? and miniatura is null",portada.miniatura(),id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable String id) {
        if("predeterminado".equals(id))throw new ReglaNegocioException("El diseño predeterminado se conserva como respaldo");
        if(sql.update("delete from diseno_plano_citt where id=?",id)==0)throw new ReglaNegocioException("Diseño no encontrado",HttpStatus.NOT_FOUND);
        return ResponseEntity.noContent().build();
    }

    static void validarMiniatura(String valor) {
        try {
            if(valor==null || valor.length()>600000 || !valor.startsWith("data:image/png;base64,"))throw new IllegalArgumentException();
            byte[] png=Base64.getDecoder().decode(valor.substring(22));
            byte[] firma={(byte)137,80,78,71,13,10,26,10};
            if(png.length<24 || !Arrays.equals(firma,Arrays.copyOf(png,8)))throw new IllegalArgumentException();
            var datos=ByteBuffer.wrap(png);int ancho=datos.getInt(16),alto=datos.getInt(20);
            if(ancho<1 || ancho>800 || alto<1 || alto>600 || ImageIO.read(new ByteArrayInputStream(png))==null)throw new IllegalArgumentException();
        }catch(Exception e){throw new ReglaNegocioException("La portada debe ser una imagen PNG de hasta 800 × 600 píxeles");}
    }
}
