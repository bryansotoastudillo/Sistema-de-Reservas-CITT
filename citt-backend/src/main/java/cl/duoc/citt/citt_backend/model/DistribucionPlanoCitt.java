package cl.duoc.citt.citt_backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "distribucion_plano_citt")
public class DistribucionPlanoCitt {
    @Id
    private Integer id;

    @Column(nullable = false, columnDefinition = "text")
    private String posiciones;

    @Column(nullable = false)
    private long revision;
}
