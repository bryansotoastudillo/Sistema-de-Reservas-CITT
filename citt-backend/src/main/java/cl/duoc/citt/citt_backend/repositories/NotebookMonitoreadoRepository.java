package cl.duoc.citt.citt_backend.repositories;

import cl.duoc.citt.citt_backend.model.Articulo;
import cl.duoc.citt.citt_backend.model.NotebookMonitoreado;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotebookMonitoreadoRepository extends JpaRepository<NotebookMonitoreado, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<NotebookMonitoreado> findByHashToken(String hashToken);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<NotebookMonitoreado> findByArticuloIdArticulo(Long articuloId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Articulo a where a.idArticulo = :id")
    Optional<Articulo> bloquearArticulo(@Param("id") Long id);

    @Query("select n from NotebookMonitoreado n join fetch n.articulo a join fetch a.estadoArticulo order by a.nombreArticulo, n.id")
    List<NotebookMonitoreado> listarConArticulo();
}
