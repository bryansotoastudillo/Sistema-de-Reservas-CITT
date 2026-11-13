package cl.duoc.citt.citt_backend.repositories;

import cl.duoc.citt.citt_backend.model.NotebookUbicacion;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotebookUbicacionRepository extends JpaRepository<NotebookUbicacion, Long> {
    Optional<NotebookUbicacion> findFirstByNotebookIdAndSolicitudIdOrderByObservadaDesc(Long notebookId, Long solicitudId);

    Slice<NotebookUbicacion> findByNotebookArticuloIdArticuloAndNotebookArticuloEliminadoFalseAndObservadaAfterOrderByObservadaDescIdDesc(
            Long articuloId, Instant desde, Pageable pagina);

    @Query(value = """
            select distinct on (notebook_id, solicitud_id) *
            from notebook_ubicacion
            where observada > :desde
            order by notebook_id, solicitud_id, observada desc
            """, nativeQuery = true)
    List<NotebookUbicacion> listarUltimas(@Param("desde") Instant desde);

    @Modifying
    @Query("delete from NotebookUbicacion u where u.observada <= :hasta")
    int eliminarVencidas(@Param("hasta") Instant hasta);
}
