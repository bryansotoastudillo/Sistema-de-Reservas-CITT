package cl.duoc.citt.citt_backend.services;

import cl.duoc.citt.citt_backend.exception.ReglaNegocioException;
import cl.duoc.citt.citt_backend.model.RefreshToken;
import cl.duoc.citt.citt_backend.repositories.RefreshTokenRepository;
import cl.duoc.citt.citt_backend.repositories.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    @Value("${jwt.refresh-expiration}")
    private long refreshExpiration;

    private final RefreshTokenRepository refreshTokenRepository;
    private final UsuarioRepository usuarioRepository;


     // Crea o actualiza un Refresh Token para un usuario.
    @Transactional
    public RefreshToken crearRefreshToken(Long usuarioId) {
        usuarioRepository.bloquearId(usuarioId)
                .orElseThrow(() -> new ReglaNegocioException("Usuario no encontrado"));
        var usuario = usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> new ReglaNegocioException("Usuario no encontrado"));
        if (!usuario.isEnabled()) throw new ReglaNegocioException("La cuenta está deshabilitada.");

        // Eliminar tokens antiguos si existen para mantener uno solo por usuario
        refreshTokenRepository.deleteByUsuario(usuario);
        refreshTokenRepository.flush(); // Fuerza la ejecución del borrado inmediatamente

        RefreshToken refreshToken = RefreshToken.builder()
                .usuario(usuario)
                .token(UUID.randomUUID().toString())
                .fechaExpiracion(Instant.now().plusMillis(refreshExpiration))
                .build();

        return refreshTokenRepository.save(refreshToken);
    }


     // Verifica si el token ha expirado.
    public RefreshToken verificarExpiracion(RefreshToken token) {
        if (token.getFechaExpiracion().compareTo(Instant.now()) < 0) {
            refreshTokenRepository.delete(token);
            throw new ReglaNegocioException("El Refresh Token ha expirado. Por favor, inicie sesión nuevamente.");
        }
        return token;
    }

    @Transactional
    public void eliminarPorUsuario(Long usuarioId) {
        var usuario = usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> new ReglaNegocioException("Usuario no encontrado"));
        refreshTokenRepository.deleteByUsuario(usuario);
    }
}
