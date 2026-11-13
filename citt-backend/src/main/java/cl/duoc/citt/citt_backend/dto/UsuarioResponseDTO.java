package cl.duoc.citt.citt_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Set;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class UsuarioResponseDTO {
    private Long id;
    private String email;
    private Set<String> roles;
    private boolean debeCambiarPassword;
    private boolean habilitado;
}
