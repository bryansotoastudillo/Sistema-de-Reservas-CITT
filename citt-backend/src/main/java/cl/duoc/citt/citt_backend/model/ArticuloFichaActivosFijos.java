package cl.duoc.citt.citt_backend.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(name = "articulo_ficha_activos_fijos")
public class ArticuloFichaActivosFijos {
    @Id
    private Long idArticulo;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_articulo")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Articulo articulo;

    private Integer cantidad;
    private String numeroSerie;
    private LocalDate adquisicion;
    private Long montoActivo;
    private String ubicacionRegistrada;
    private String confirmarUbicacion;
    private String poseeEtiquetaDuoc;

    @Column(columnDefinition = "text")
    private String observacion;
}
