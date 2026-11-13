package cl.duoc.citt.citt_backend.model;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "notebook_ubicacion", indexes = {
        @Index(name = "idx_notebook_ubicacion_fecha", columnList = "observada"),
        @Index(name = "idx_notebook_ubicacion_equipo_fecha", columnList = "notebook_id, observada")
}, uniqueConstraints = @UniqueConstraint(columnNames = {"notebook_id", "solicitud_id", "observada"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class NotebookUbicacion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "notebook_id", nullable = false)
    private NotebookMonitoreado notebook;

    @Column(name = "solicitud_id", nullable = false)
    private Long solicitudId;

    @Column(nullable = false)
    private Instant observada;
    private double latitud;
    private double longitud;
    private double precisionMetros;
}
