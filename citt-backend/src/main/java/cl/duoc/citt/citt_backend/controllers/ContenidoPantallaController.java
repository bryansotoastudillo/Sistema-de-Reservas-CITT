package cl.duoc.citt.citt_backend.controllers;

import cl.duoc.citt.citt_backend.services.ContenidoPantalla;
import cl.duoc.citt.citt_backend.services.ContenidoPantalla.Catalogo;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/contenido-pantalla")
@PreAuthorize("hasAnyRole('COORDINADOR', 'DIRECTOR')")
@RequiredArgsConstructor
public class ContenidoPantallaController {
    private final ContenidoPantalla contenido;

    public record Movimiento(@Min(-1) @Max(1) int desplazamiento) {}

    @GetMapping
    public ResponseEntity<Catalogo> listar() throws IOException {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(contenido.listar());
    }

    @GetMapping("/archivos/{archivo}")
    public ResponseEntity<FileSystemResource> imagen(@PathVariable String archivo) throws IOException {
        var ruta = contenido.verArchivo(archivo);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .contentType(archivo.endsWith(".png") ? MediaType.IMAGE_PNG : MediaType.IMAGE_JPEG)
                .body(new FileSystemResource(ruta));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Catalogo agregar(@RequestParam("archivo") MultipartFile archivo) throws IOException {
        return contenido.agregar(archivo);
    }

    @PutMapping(path = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Catalogo reemplazar(@PathVariable UUID id, @RequestParam("archivo") MultipartFile archivo) throws IOException {
        return contenido.reemplazar(id, archivo);
    }

    @PatchMapping("/{id}/orden")
    public Catalogo mover(@PathVariable UUID id, @RequestBody @Valid Movimiento movimiento) throws IOException {
        return contenido.mover(id, movimiento.desplazamiento());
    }

    @DeleteMapping("/{id}")
    public Catalogo eliminar(@PathVariable UUID id) throws IOException {
        return contenido.eliminar(id);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> error(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).body(Map.of("mensaje", error.getReason()));
    }
}
