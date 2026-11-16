package cl.duoc.citt.citt_backend.controllers;

import cl.duoc.citt.citt_backend.services.ExportacionInventario;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class ExportacionInventarioController {
    private final ExportacionInventario inventario;

    @GetMapping(value = "/api/articulos/exportar", produces = "text/csv")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'DIRECTOR')")
    public ResponseEntity<byte[]> exportar() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("Inventario CITT.csv").build().toString())
                .body(inventario.generar());
    }
}
