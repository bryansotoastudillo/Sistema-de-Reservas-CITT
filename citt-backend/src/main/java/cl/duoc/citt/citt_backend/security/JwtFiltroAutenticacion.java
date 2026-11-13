package cl.duoc.citt.citt_backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtFiltroAutenticacion extends OncePerRequestFilter {

    private final JwtUtilidades jwtUtilidades;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        // 1. Ignorar peticiones OPTIONS (CORS pre-flight)
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        // 2. Ignorar recursos estáticos (Mejora de rendimiento adoptada de COPIA)
        String path = request.getRequestURI();
        if (path.contains("/assets/") || path.endsWith(".css") || path.endsWith(".js") ||
                path.endsWith(".png") || path.endsWith(".svg") || path.endsWith(".ico")) {
            filterChain.doFilter(request, response);
            return;
        }

        // 3. Extrae el token JWT desde la cookie "auth_token"
        String jwt = null;
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("auth_token".equals(cookie.getName())) {
                    jwt = cookie.getValue();
                    break;
                }
            }
        }

        // 4. Fallback: Buscar en el header de Authorization si no hay cookie (Crucial para Swagger/Postman)
        if (jwt == null) {
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                jwt = authHeader.substring(7);
            }
        }

        // 5. Núcleo de autenticación y reglas de negocio
        if (jwt != null) {
            try {
                String userEmail = jwtUtilidades.extraerUsername(jwt);

                if (userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                    UserDetails userDetails = this.userDetailsService.loadUserByUsername(userEmail);

                    if (userDetails.isEnabled() && jwtUtilidades.esTokenValido(jwt, userDetails)) {

                        // REGLA FUNDAMENTAL: Control de cambio de contraseña provisional
                        if (userDetails instanceof cl.duoc.citt.citt_backend.model.Usuario) {
                            cl.duoc.citt.citt_backend.model.Usuario usuario = (cl.duoc.citt.citt_backend.model.Usuario) userDetails;

                            if (usuario.isDebeCambiarPassword()) {
                                String rutaPeticion = request.getServletPath();

                                // Lista blanca de endpoints permitidos
                                boolean esRutaPermitida = rutaPeticion.equals("/api/auth/cambiar-password") ||
                                        rutaPeticion.equals("/api/auth/login") ||
                                        rutaPeticion.equals("/api/auth/logout") ||
                                        rutaPeticion.contains("/swagger-ui") ||
                                        rutaPeticion.contains("/v3/api-docs");

                                if (!esRutaPermitida) {
                                    // Bloqueo absoluto
                                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                                    response.setContentType("application/json");
                                    response.setCharacterEncoding("UTF-8");
                                    response.getWriter().write("{\"error\": \"ACCESO_DENEGADO\", \"message\": \"Debe cambiar su contraseña predeterminada para acceder a esta función.\"}");
                                    return; // Se detiene la cadena de filtros
                                }
                            }
                        }

                        // Si pasa las barreras, se establece en el contexto de seguridad
                        UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                                userDetails, null, userDetails.getAuthorities());
                        authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                        SecurityContextHolder.getContext().setAuthentication(authToken);
                    }
                }
            } catch (Exception e) {
                // Evita que el backend colapse silenciosamente si el token tiene anomalías
                log.warn("Error en filtro JWT: {}", e.getMessage());
            }
        }

        filterChain.doFilter(request, response);
    }
}
