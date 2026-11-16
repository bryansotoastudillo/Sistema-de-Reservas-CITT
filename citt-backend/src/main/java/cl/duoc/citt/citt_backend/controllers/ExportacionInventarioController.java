package cl.duoc.citt.citt_backend.controllers;

import cl.duoc.citt.citt_backend.services.ExportacionInventario;
import cl.duoc.citt.citt_backend.services.ImportacionInventario;
import cl.duoc.citt.citt_backend.services.FichaActivoService;
import cl.duoc.citt.citt_backend.dto.FichaActivoDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('COORDINADOR', 'DIRECTOR')")
public class ExportacionInventarioController {
    private final ExportacionInventario inventario;
    private final ImportacionInventario importacion;
    private final FichaActivoService fichas;

    @PostMapping(value = "/api/articulos/importar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ImportacionInventario.Resultado importar(@RequestParam MultipartFile archivo) {
        return importacion.importar(archivo);
    }

    @GetMapping("/api/articulos/{id}/ficha-activo")
    public FichaActivoDTO obtenerFicha(@PathVariable long id) {
        return fichas.obtener(id);
    }

    @GetMapping(value = "/api/articulos/exportar", produces = "text/csv")
    public ResponseEntity<byte[]> exportar() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("Inventario CITT.csv").build().toString())
                .body(inventario.generar());
    }
}
