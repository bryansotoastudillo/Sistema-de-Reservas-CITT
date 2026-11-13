package cl.duoc.citt.citt_backend.security;

import cl.duoc.citt.citt_backend.model.Usuario;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

@Component
public class JwtUtilidades {

    // Lee la clave secreta definida en el archivo application.properties
    @Value("${jwt.secret}")
    private String secretKey;

    // Lee el tiempo de duración del token desde la configuración
    @Value("${jwt.expiration}")
    private long jwtExpiration;

    // Extrae el nombre de usuario guardado dentro del token.
    public String extraerUsername(String token) {
        return extraerClaim(token, Claims::getSubject);
    }


     // Extrae el nombre de usuario incluso si el token ha expirado.
    public String extraerUsernameInclusoSiExpirado(String token) {
        try {
            return extraerUsername(token);
        } catch (io.jsonwebtoken.ExpiredJwtException e) {
            return e.getClaims().getSubject();
        } catch (Exception e) {
            return null;
        }
    }

    // Método genérico para extraer cualquier dato específico (Claim) del token.
    public <T> T extraerClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extraerTodosLosClaims(token);
        return claimsResolver.apply(claims);
    }

    /**
     * Punto de entrada para crear un nuevo token cuando un usuario se loguea.
     * Agrega información extra como los roles y si debe cambiar la clave.
     */
    public String generarToken(UserDetails detallesUsuario) {
        Map<String, Object> extraClaims = new HashMap<>();

        // Guarda los roles del usuario dentro del token para que el frontend los pueda leer
        var roles = detallesUsuario.getAuthorities().stream()
                .map(auth -> auth.getAuthority())
                .toList();
        extraClaims.put("roles", roles);

        // Si es un usuario del sistema, añade el estado de su contraseña
        if (detallesUsuario instanceof cl.duoc.citt.citt_backend.model.Usuario) {
            extraClaims.put("debeCambiarPassword",
                    ((cl.duoc.citt.citt_backend.model.Usuario) detallesUsuario).isDebeCambiarPassword());
        }

        return generarToken(extraClaims, detallesUsuario);
    }

    // Construye el JWT con la fecha de emisión, expiración y la firma digital.
    public String generarToken(Map<String, Object> extraClaims, UserDetails detallesUsuario) {
        Map<String, Object> claims = new HashMap<>(extraClaims);
        if (detallesUsuario instanceof Usuario usuario) claims.put("versionAcceso", usuario.getVersionAcceso());
        return Jwts.builder()
                .setClaims(claims)
                .setSubject(detallesUsuario.getUsername())
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + jwtExpiration))
                .signWith(obtenerLlaveFirma(), SignatureAlgorithm.HS256)
                .compact();
    }

    // Verifica que el token pertenezca al usuario y que no haya caducado.
    public boolean esTokenValido(String token, UserDetails detallesUsuario) {
        Claims claims = extraerTodosLosClaims(token);
        Long version = claims.get("versionAcceso", Long.class);
        return claims.getSubject().equals(detallesUsuario.getUsername()) && claims.getExpiration().after(new Date())
                && (!(detallesUsuario instanceof Usuario usuario)
                    || usuario.getVersionAcceso() == (version == null ? 0L : version));
    }

    // Abre el token usando la llave secreta para leer todo su contenido (Claims).
    private Claims extraerTodosLosClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(obtenerLlaveFirma())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    // Transforma la clave secreta de String a un objeto Key.
    private Key obtenerLlaveFirma() {
        byte[] llaveBytes = secretKey.getBytes();
        return Keys.hmacShaKeyFor(llaveBytes);
    }
}
