package cl.duoc.citt.citt_backend.model;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "notebook_monitoreado")
@Getter
@Setter
public class NotebookMonitoreado {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_articulo", nullable = false, unique = true)
    private Articulo articulo;

    @Column(name = "hash_token", nullable = false, unique = true, length = 64)
    private String hashToken;

    private Instant recibido;
    private Instant observado;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private JsonNode reporte;
}
