package cl.duoc.citt.citt_backend.dto;


import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EspacioResponseDTO {

    private Long id;
    private String nombre;
    private String clavePlano;
    private String comentarios;
    private Integer capacidad;
    private String estado;
    private Boolean enUsoAhora;

}
