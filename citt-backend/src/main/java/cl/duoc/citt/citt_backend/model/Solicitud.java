package cl.duoc.citt.citt_backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "solicitud")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Solicitud {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_solicitud")
    private Long idSolicitud;

    @Column(nullable = false)
    private LocalDate fecha;

    @Column(name = "hora_inicio", nullable = false)
    private LocalTime horaInicio;

    @Column(name = "hora_fin", nullable = false)
    private LocalTime horaFin;

    @Column(name = "cantidad_integrantes")
    private Integer cantidadIntegrantes;

    @Column(nullable = false)
    private Boolean exclusividad;

    @Column(length = 500)
    private String proposito;

    @Column(name = "motivo_rechazo", length = 500)
    private String motivoRechazo;

    // Feature 2: Timestamp real de devolución
    @Column(name = "fecha_devolucion_real")
    private java.time.LocalDateTime fechaDevolucionReal;

    // Feature 4: Rastreo de daños por solicitud
    @Column(name = "espacio_danado_en_devolucion")
    private Boolean espacioDanadoEnDevolucion;

    @Column(name = "comentario_dano_espacio", length = 500)
    private String comentarioDanoEspacio;

    @Column(name = "ids_articulos_danados", length = 500)
    private String idsArticulosDanados;

    // Autogestión de solicitudes
    @Column(name = "registro_autogestion", length = 500)
    private String registroAutogestion;

    // Uso externo: destino al que se llevarán los artículos fuera del CITT
    @Column(name = "destino_externo", length = 300)
    private String destinoExterno;

    @ElementCollection
    @CollectionTable(name = "solicitud_recurso_cowork", joinColumns = @JoinColumn(name = "id_solicitud"))
    @Column(name = "recurso", nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Set<RecursoCowork> recursosCowork = new HashSet<>();

    // --- RELACIONES ---
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_estado_solicitud", nullable = false)
    private EstadoSolicitud estadoSolicitud;


    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_usuario", nullable = false)
    private Usuario usuario;

    // Puede ser null si la solicitud es "Solo Artículos"
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_espacio", nullable = true)
    private Espacio espacio;

    // Puede estar vacía si la solicitud es "Solo Espacio"
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "solicitud_articulo",
            joinColumns = @JoinColumn(name = "id_solicitud"),
            inverseJoinColumns = @JoinColumn(name = "id_articulo")
    )
    @Builder.Default
    private List<Articulo> articulos = new ArrayList<>();

    @OneToMany(mappedBy = "solicitud", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<RequerimientoArticulo> requerimientos = new ArrayList<>();
}
