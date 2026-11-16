package cl.duoc.citt.citt_backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.util.Set;

@Data
public class RegistroRequestDTO {

    // - validaciones -
    @NotBlank(message = "Ingresa tu correo electrónico! ")
    @Email(message = "El correo electrónico es invalido! Solo correos @Duoc")
    private String email;

    private Set<@NotBlank String> rolesNombres; // Roles adicionales al valor por defecto del dominio.
}
