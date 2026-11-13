package cl.duoc.citt.citt_backend.controllers;

import cl.duoc.citt.citt_backend.dto.UsuarioResponseDTO;
import cl.duoc.citt.citt_backend.dto.UsuarioUpdateDTO;
import cl.duoc.citt.citt_backend.services.UsuarioService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/usuarios")
@RequiredArgsConstructor
public class UsuarioController {

    private final UsuarioService usuarioService;

    public record EstadoCuenta(@jakarta.validation.constraints.NotNull Boolean habilitado) {}

    @PatchMapping("/{id}/estado")
    @PreAuthorize("hasRole('DIRECTOR')")
    public ResponseEntity<UsuarioResponseDTO> cambiarEstado(@PathVariable Long id,
            @jakarta.validation.Valid @RequestBody EstadoCuenta estado, Authentication autenticacion) {
        return ResponseEntity.ok(usuarioService.cambiarEstado(id, estado.habilitado(), autenticacion.getName()));
    }

    // Cualquier usuario autenticado puede ver su propia información
    @GetMapping("/mi-perfil")
    public ResponseEntity<UsuarioResponseDTO> miPerfil() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return ResponseEntity.ok(usuarioService.buscarPorEmail(email));
    }

    // Lista paginada de usuarios registrados. Solo COORDINADOR y DIRECTOR
    @GetMapping
    @PreAuthorize("hasAnyRole('COORDINADOR', 'DIRECTOR')")
    public ResponseEntity<Page<UsuarioResponseDTO>> obtenerTodos(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String buscar) {
        return ResponseEntity.ok(usuarioService.obtenerTodosPaginados(page, size, buscar));
    }

    // Actualiza los datos de un usuario específico. Solo COORDINADOR y DIRECTOR
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'DIRECTOR')")
    public ResponseEntity<UsuarioResponseDTO> actualizar(@PathVariable Long id,
         @jakarta.validation.Valid @RequestBody UsuarioUpdateDTO solicitud) {
        return ResponseEntity.ok(usuarioService.actualizar(id, solicitud));
    }

    // Busca un usuario por su ID. Solo COORDINADOR y DIRECTOR
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'DIRECTOR')")
    public ResponseEntity<UsuarioResponseDTO> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(usuarioService.buscarPorId(id));
    }

    // Elimina a un usuario del sistema de forma definitiva. Solo COORDINADOR y DIRECTOR
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'DIRECTOR')")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        usuarioService.eliminar(id);
        return ResponseEntity.noContent().build();
    }
}
