package cl.duoc.citt.citt_backend.controllers;

import cl.duoc.citt.citt_backend.dto.*;
import cl.duoc.citt.citt_backend.model.Usuario;
import cl.duoc.citt.citt_backend.security.DominiosInstitucionales.Regla;
import cl.duoc.citt.citt_backend.services.AutenticacionService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AutenticacionController {

    private final AutenticacionService autenticacionService;

    // true en producción (HTTPS), false en local (HTTP)
    private static final boolean EN_PRODUCCION = System.getenv("PRODUCTION") != null;

    // Solo coordinadores y directores pueden registrar usuarios manualmente
    @PostMapping("/registro")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'DIRECTOR')")
    public ResponseEntity<RegistroResponseDTO> registrar(@Valid @RequestBody RegistroRequestDTO solicitud) {
        return ResponseEntity.ok(autenticacionService.registrar(solicitud));
    }

    @GetMapping("/dominios-registro")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'DIRECTOR')")
    public List<Regla> dominiosRegistro() {
        return autenticacionService.dominiosRegistro();
    }

    // Autorregistro para los dominios autorizados por la política institucional.
    @PostMapping("/auto-registro")
    public ResponseEntity<RegistroResponseDTO> autoRegistro(@Valid @RequestBody AutoRegistroRequestDTO solicitud) {
        return ResponseEntity.ok(autenticacionService.autoRegistrar(solicitud));
    }

    // Login: genera el access token y refresh token, los guarda en cookies HttpOnly
    @PostMapping("/login")
    public ResponseEntity<String> iniciarSesion(@Valid @RequestBody InicioSesionRequestDTO solicitud, HttpServletResponse response) {
        AutenticacionResponseDTO authData = autenticacionService.iniciarSesion(solicitud);

        // Cookie para el ACCESS TOKEN - dura 1 hora
        ResponseCookie tokenCookie = ResponseCookie.from("auth_token", authData.getToken())
                .httpOnly(true)
                .secure(EN_PRODUCCION)
                .path("/")
                .maxAge(3600)
                .sameSite(EN_PRODUCCION ? "None" : "Lax")
                .build();

        // Cookie para el REFRESH TOKEN - dura 7 días
        // Solo se envía al endpoint de refrescar token por seguridad
        ResponseCookie refreshCookie = ResponseCookie.from("refresh_token", authData.getRefreshToken())
                .httpOnly(true)
                .secure(EN_PRODUCCION)
                .path("/api/auth/refrescar-token")
                .maxAge(604800)
                .sameSite(EN_PRODUCCION ? "None" : "Lax")
                .build();

        response.addHeader("Set-Cookie", tokenCookie.toString());
        response.addHeader("Set-Cookie", refreshCookie.toString());

        return ResponseEntity.ok("Login exitoso. Tokens configurados en cookies seguras.");
    }

    // Cambiar contraseña (el usuario debe estar autenticado)
    @PutMapping("/cambiar-password")
    public ResponseEntity<String> cambiarPassword(@Valid @RequestBody CambioPasswordRequestDTO solicitud) {
        autenticacionService.cambiarPassword(solicitud);
        return ResponseEntity.ok("Contraseña actualizada exitosamente");
    }

    // Refrescar el access token usando el refresh token que viene en la cookie
    @PostMapping("/refrescar-token")
    public ResponseEntity<AutenticacionResponseDTO> refrescarToken(
            @CookieValue(name = "refresh_token") String refreshToken, HttpServletResponse response) {

        TokenRefreshRequestDTO solicitud = new TokenRefreshRequestDTO();
        solicitud.setRefreshToken(refreshToken);

        AutenticacionResponseDTO nuevoTokens = autenticacionService.refrescarToken(solicitud);

        // Se actualiza la cookie del access token con el nuevo token generado
        ResponseCookie tokenCookie = ResponseCookie.from("auth_token", nuevoTokens.getToken())
                .httpOnly(true)
                .secure(EN_PRODUCCION)
                .path("/")
                .maxAge(3600)
                .sameSite(EN_PRODUCCION ? "None" : "Lax")
                .build();

        // Se actualiza también la cookie del refresh token
        ResponseCookie refreshCookie = ResponseCookie.from("refresh_token", nuevoTokens.getRefreshToken())
                .httpOnly(true)
                .secure(EN_PRODUCCION)
                .path("/api/auth/refrescar-token")
                .maxAge(604800)
                .sameSite(EN_PRODUCCION ? "None" : "Lax")
                .build();

        response.addHeader("Set-Cookie", tokenCookie.toString());
        response.addHeader("Set-Cookie", refreshCookie.toString());

        return ResponseEntity.ok(nuevoTokens);
    }

    // Solicitar recuperación de contraseña (manda el código al correo)
    @PostMapping("/olvido-password")
    public ResponseEntity<String> solicitarRecuperacion(@Valid @RequestBody OlvidoPasswordRequestDTO solicitud) {
        autenticacionService.solicitarRecuperacionPassword(solicitud);
        return ResponseEntity.ok("Si el correo está registrado, recibirás un código en breve.");
    }

    // Restablecer contraseña usando el código recibido en el correo
    @PostMapping("/restablecer-password")
    public ResponseEntity<String> resetearPassword(@Valid @RequestBody RecuperarPasswordRequestDTO solicitud) {
        autenticacionService.resetearPassword(solicitud);
        return ResponseEntity.ok("Contraseña restablecida exitosamente.");
    }

    // Logout: invalida el refresh token y borra las cookies del navegador
    @PostMapping("/logout")
    public ResponseEntity<Void> cerrarSesion(
            @CookieValue(name = "refresh_token", required = false) String refreshToken,
            HttpServletResponse response) {

        if (refreshToken != null) {
            try {
                autenticacionService.cerrarSesion(refreshToken);
            } catch (Exception e) {
                // Si el token ya expiró igual limpiamos las cookies
            }
        }

        // Borramos las cookies del navegador poniendo Max-Age en 0 usando ResponseCookie para respetar los atributos
        ResponseCookie clearTokenCookie = ResponseCookie.from("auth_token", "")
                .httpOnly(true)
                .secure(EN_PRODUCCION)
                .path("/")
                .maxAge(0)
                .sameSite(EN_PRODUCCION ? "None" : "Lax")
                .build();

        ResponseCookie clearRefreshCookie = ResponseCookie.from("refresh_token", "")
                .httpOnly(true)
                .secure(EN_PRODUCCION)
                .path("/api/auth/refrescar-token")
                .maxAge(0)
                .sameSite(EN_PRODUCCION ? "None" : "Lax")
                .build();

        response.addHeader("Set-Cookie", clearTokenCookie.toString());
        response.addHeader("Set-Cookie", clearRefreshCookie.toString());

        return ResponseEntity.noContent().build();
    }

    // Devuelve el email y roles del usuario autenticado leyendo el contexto de seguridad
    @GetMapping("/perfil")
    public ResponseEntity<?> obtenerPerfil() {
        org.springframework.security.core.Authentication authentication =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();

        String email = authentication.getName();
        var roles = authentication.getPrincipal() instanceof Usuario usuario
                ? usuario.nombresRoles()
                : authentication.getAuthorities().stream()
                .map(org.springframework.security.core.GrantedAuthority::getAuthority)
                .map(role -> role.replace("ROLE_", ""))
                .collect(java.util.stream.Collectors.toSet());

        return ResponseEntity.ok(java.util.Map.of(
                "email", email,
                "roles", roles
        ));
    }
}
