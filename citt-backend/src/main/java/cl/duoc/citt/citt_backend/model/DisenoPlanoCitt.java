package cl.duoc.citt.citt_backend.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "diseno_plano_citt")
public class DisenoPlanoCitt {
    @Id @Column(length = 36) private String id;
    @Column(nullable = false, length = 80) private String nombre;
    @Column(nullable = false, columnDefinition = "text") private String posiciones;
    @Column(columnDefinition = "text") private String miniatura;
    @Column(nullable = false) private Instant creado;
}
