package cl.duoc.citt.citt_backend.controllers;

import cl.duoc.citt.citt_backend.dto.EspacioRequestDTO;
import cl.duoc.citt.citt_backend.dto.EspacioResponseDTO;
import cl.duoc.citt.citt_backend.dto.EspacioUpdateDTO;
import cl.duoc.citt.citt_backend.dto.EspacioEstadoRequest;
import cl.duoc.citt.citt_backend.services.EspacioService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/espacios")
@RequiredArgsConstructor
public class EspacioController {

    private final EspacioService service;

    @PostMapping
    @PreAuthorize("hasAnyRole('COORDINADOR', 'DIRECTOR')")
    public ResponseEntity<?> crear(@Valid @RequestBody EspacioRequestDTO dto) {
        return ResponseEntity.ok(service.crear(dto));
    }

    // Cualquier usuario autenticado puede ver la información
    @GetMapping
    public ResponseEntity<List<EspacioResponseDTO>> listar(@RequestParam(required = false) String estado) {
        return ResponseEntity.ok(service.listar(estado));
    }

    // Cualquier usuario autenticado puede ver la información
    @GetMapping("/{id}")
    public ResponseEntity<EspacioResponseDTO> obtener(@PathVariable Long id) {
        return ResponseEntity.ok(service.obtenerPorId(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'DIRECTOR')")
    public ResponseEntity<EspacioResponseDTO> actualizar(@PathVariable Long id,
                                                         @Valid@RequestBody EspacioUpdateDTO dto) {
        return ResponseEntity.ok(service.actualizar(id, dto));
    }

    @PatchMapping("/{id}/estado")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'DIRECTOR')")
    public EspacioResponseDTO cambiarEstado(@PathVariable Long id, @Valid @RequestBody EspacioEstadoRequest cambio) {
        return service.cambiarEstado(id, cambio);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'DIRECTOR')")
    public ResponseEntity<?> eliminar(@PathVariable Long id) {
        service.eliminar(id);
        Map<String, String> respuesta = new HashMap<>();
        respuesta.put("mensaje", "Espacio eliminado correctamente");
        return ResponseEntity.ok(respuesta);
    }
}
