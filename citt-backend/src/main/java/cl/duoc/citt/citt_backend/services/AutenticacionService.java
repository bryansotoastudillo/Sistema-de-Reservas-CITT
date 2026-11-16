package cl.duoc.citt.citt_backend.services;

import cl.duoc.citt.citt_backend.dto.*;
import cl.duoc.citt.citt_backend.model.RefreshToken;
import cl.duoc.citt.citt_backend.model.Rol;
import cl.duoc.citt.citt_backend.model.Usuario;
import cl.duoc.citt.citt_backend.repositories.RolRepository;
import cl.duoc.citt.citt_backend.repositories.UsuarioRepository;
import cl.duoc.citt.citt_backend.security.JwtUtilidades;
import cl.duoc.citt.citt_backend.security.DominiosInstitucionales;
import cl.duoc.citt.citt_backend.exception.ReglaNegocioException;
import cl.duoc.citt.citt_backend.repositories.RefreshTokenRepository;
import cl.duoc.citt.citt_backend.model.RecuperarPasswordToken;
import cl.duoc.citt.citt_backend.repositories.RecuperarPasswordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Lógica central de autenticación del sistema.
 *
 *   Gestiona:
 * 1. Registro (Manual y Auto-registro con validación de dominio)
 * 2. Sesiones (Login, Logout y Refresh Token)
 * 3. Seguridad (Cambio y Recuperación de contraseña)
 */
@Service
@RequiredArgsConstructor
public class AutenticacionService {

    private final UsuarioRepository usuarioRepository;
    private final RolRepository rolRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtilidades jwtUtilidades;
    private final AuthenticationManager authenticationManager;
    private final EmailService emailService;
    private final RefreshTokenService refreshTokenService;
    private final RefreshTokenRepository refreshTokenRepository;
    private final RecuperarPasswordRepository passwordRecuperarRepository;
    private final DominiosInstitucionales dominios;

    public List<DominiosInstitucionales.Regla> dominiosRegistro() {
        return dominios.listar();
    }

    /**
     * REGISTRO MANUAL: Realizado por un Administrador/Coordinador.
     */
    public RegistroResponseDTO registrar(RegistroRequestDTO solicitud) {
        var regla = dominios.exigirDominio(solicitud.getEmail());

        if (usuarioRepository.findByEmail(solicitud.getEmail()).isPresent()) {
            throw new ReglaNegocioException("El correo electrónico ya se encuentra registrado");
        }

        Set<String> nombres = new HashSet<>();
        if (regla.rol() != null) nombres.add(regla.rol());
        if (solicitud.getRolesNombres() != null) nombres.addAll(solicitud.getRolesNombres());
        if (nombres.isEmpty()) throw new ReglaNegocioException("Selecciona al menos un rol para este correo.");
        Set<Rol> roles = nombres.stream()
                .map(nombre -> rolRepository.findByNombre(nombre.toUpperCase())
                        .orElseThrow(() -> new ReglaNegocioException("Error: El rol " + nombre + " no existe")))
                .collect(Collectors.toSet());
        UsuarioService.exigirDirectorParaRoles(roles);

        String passwordProvisoria = UUID.randomUUID().toString().substring(0, 8);

        var usuario = Usuario.builder()
                .email(solicitud.getEmail())
                .password(passwordEncoder.encode(passwordProvisoria))
                .roles(roles)
                .debeCambiarPassword(true) // Obliga al usuario a cambiar clave al entrar
                .build();

        usuarioRepository.save(usuario);
        emailService.enviarPasswordProvisoria(usuario.getEmail(), passwordProvisoria);

        return RegistroResponseDTO.builder()
                .mensaje("Usuario registrado exitosamente. Se ha enviado la clave provisoria.")
                .email(usuario.getEmail())
                .roles(usuario.getRoles().stream().map(Rol::getNombre).collect(Collectors.toSet()))
                .build();
    }

    /**
     * AUTO-REGISTRO: El usuario crea su propia cuenta (solo Alumnos y Docentes).
     */
    public RegistroResponseDTO autoRegistrar(AutoRegistroRequestDTO solicitud) {
        if (solicitud.getEmail() == null || solicitud.getEmail().isBlank()) {
            throw new ReglaNegocioException("El correo electrónico es obligatorio");
        }

        var regla = dominios.exigirDominio(solicitud.getEmail());
        if (!regla.permiteAutorregistro()) {
            throw new ReglaNegocioException("Este correo requiere registro manual.");
        }

        if (usuarioRepository.findByEmail(solicitud.getEmail()).isPresent()) {
            throw new ReglaNegocioException("El correo electrónico ya se encuentra registrado");
        }

        String rolDetectado = regla.rol();

        Rol rol = rolRepository.findByNombre(rolDetectado)
                .orElseThrow(() -> new ReglaNegocioException("Error interno: el rol no existe en la BD"));

        String passwordProvisoria = UUID.randomUUID().toString().substring(0, 8);

        var usuario = Usuario.builder()
                .email(solicitud.getEmail())
                .password(passwordEncoder.encode(passwordProvisoria))
                .roles(Set.of(rol))
                .debeCambiarPassword(true)
                .build();

        usuarioRepository.save(usuario);
        emailService.enviarPasswordProvisoria(usuario.getEmail(), passwordProvisoria);

        return RegistroResponseDTO.builder()
                .mensaje("¡Cuenta creada! Revisa tu correo para tu clave provisoria.")
                .email(usuario.getEmail())
                .roles(Set.of(rolDetectado))
                .build();
    }

    /**
     * LOGIN: Genera Access Token (JWT) y Refresh Token.
     */
    public AutenticacionResponseDTO iniciarSesion(InicioSesionRequestDTO solicitud) {
        dominios.exigirDominio(solicitud.getEmail());
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(solicitud.getEmail(), solicitud.getPassword())
        );

        var usuario = usuarioRepository.findByEmail(solicitud.getEmail())
                .orElseThrow(() -> new ReglaNegocioException("Usuario no encontrado"));

        var refreshToken = refreshTokenService.crearRefreshToken(usuario.getId());
        usuario = refreshToken.getUsuario();
        var tokenJwt = jwtUtilidades.generarToken(usuario);

        return AutenticacionResponseDTO.builder()
                .token(tokenJwt)
                .refreshToken(refreshToken.getToken())
                .email(usuario.getEmail())
                .roles(usuario.getRoles().stream().map(Rol::getNombre).collect(Collectors.toSet()))
                .debeCambiarPassword(usuario.isDebeCambiarPassword())
                .build();
    }

    /**
     * LOGOUT: Invalida la sesión eliminando el Refresh Token.
     * Recibe el valor del refresh token desde la cookie.
     */
    @Transactional
    public void cerrarSesion(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return; // No hay token que invalidar, pero no fallamos
        }

        refreshTokenRepository.findByToken(refreshToken)
                .ifPresent(rt -> refreshTokenService.eliminarPorUsuario(rt.getUsuario().getId()));
    }

    /**
     * RECUPERACIÓN DE CONTRASEÑA (Paso 1): Genera un Token seguro.
     */
    @Transactional
    public void solicitarRecuperacionPassword(OlvidoPasswordRequestDTO solicitud) {
        var usuarioOpt = usuarioRepository.findByEmail(solicitud.getEmail()).filter(Usuario::isEnabled);

        // PROTECCIÓN: No revelamos si el correo existe o no
        if (usuarioOpt.isEmpty()) {
            return;
        }

        Usuario usuario = usuarioOpt.get();
        passwordRecuperarRepository.deleteByUsuario(usuario);

        String token = UUID.randomUUID().toString().substring(0, 8);
        RecuperarPasswordToken resetToken = RecuperarPasswordToken.builder()
                .token(token)
                .usuario(usuario)
                .fechaExpiracion(LocalDateTime.now().plusMinutes(30))
                .build();

        passwordRecuperarRepository.save(resetToken);
        emailService.enviarPasswordRecuperacion(usuario.getEmail(), token);
    }

    /**
     * RESTABLECER CONTRASEÑA (Paso 2): Valida el Token y cambia la clave.
     */
    @Transactional
    public void resetearPassword(RecuperarPasswordRequestDTO solicitud) {
        RecuperarPasswordToken resetToken = passwordRecuperarRepository.findByToken(solicitud.getCodigoRecuperacion())
                .orElseThrow(() -> new ReglaNegocioException("El código de recuperación es inválido o no existe"));

        if (resetToken.estaExpirado()) {
            passwordRecuperarRepository.delete(resetToken);
            throw new ReglaNegocioException("El código de recuperación ha expirado");
        }

        Usuario usuario = resetToken.getUsuario();
        if (!usuario.isEnabled()) throw new ReglaNegocioException("El código de recuperación es inválido o no existe");
        usuario.setPassword(passwordEncoder.encode(solicitud.getNuevaPassword()));
        usuario.setDebeCambiarPassword(false);
        usuarioRepository.save(usuario);

        passwordRecuperarRepository.delete(resetToken);
        refreshTokenService.eliminarPorUsuario(usuario.getId()); // Cierra sesiones en otros dispositivos
    }

    // RENOVACIÓN DE TOKEN
    @Transactional
    public AutenticacionResponseDTO refrescarToken(TokenRefreshRequestDTO solicitud) {
        return refreshTokenRepository.buscarUsuarioId(solicitud.getRefreshToken())
                .flatMap(usuarioRepository::bloquearId)
                .flatMap(id -> refreshTokenRepository.findByToken(solicitud.getRefreshToken()))
                .map(refreshTokenService::verificarExpiracion)
                .map(RefreshToken::getUsuario)
                .filter(Usuario::isEnabled)
                .map(usuario -> {
                    dominios.exigirDominio(usuario.getEmail());
                    String token = jwtUtilidades.generarToken(usuario);
                    var nuevoRefreshToken = refreshTokenService.crearRefreshToken(usuario.getId());
                    return AutenticacionResponseDTO.builder()
                            .token(token)
                            .refreshToken(nuevoRefreshToken.getToken())
                            .email(usuario.getEmail())
                            .roles(usuario.getRoles().stream().map(Rol::getNombre).collect(Collectors.toSet()))
                            .debeCambiarPassword(usuario.isDebeCambiarPassword())
                            .build();
                })
                .orElseThrow(() -> new ReglaNegocioException("Token de refresco inválido o expirado"));
    }

    // CAMBIO DE CLAVE
    public void cambiarPassword(CambioPasswordRequestDTO solicitud) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        Usuario usuario = usuarioRepository.findByEmail(email)
                .orElseThrow(() -> new ReglaNegocioException("Usuario no encontrado"));

        if (!passwordEncoder.matches(solicitud.getPasswordActual(), usuario.getPassword())) {
            throw new ReglaNegocioException("La contraseña actual es incorrecta");
        }

        usuario.setPassword(passwordEncoder.encode(solicitud.getNuevaPassword()));
        usuario.setDebeCambiarPassword(false);
        usuarioRepository.save(usuario);
    }
}
