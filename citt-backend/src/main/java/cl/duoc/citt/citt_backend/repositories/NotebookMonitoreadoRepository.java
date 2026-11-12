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
    String PRESTAMOS_EXTERNOS = """
            from Solicitud s join s.articulos a
            where s.espacio is null and s.destinoExterno is not null and trim(s.destinoExterno) <> ''
              and s.estadoSolicitud.nombre in ('EN PROCESO', 'ATRASADO')
              and a.estadoArticulo.nombreEstado = 'PRESTADO' and a.eliminado = false
            """;

    interface PrestamoExterno {
        Long getArticuloId();
        Long getSolicitudId();
    }

    @Query("select a.idArticulo as articuloId, min(s.idSolicitud) as solicitudId " + PRESTAMOS_EXTERNOS
            + " and exists (select n.id from NotebookMonitoreado n where n.articulo = a)"
            + " group by a.idArticulo having count(s) = 1")
    List<PrestamoExterno> listarPrestamosExternos();

    @Query("select min(s.idSolicitud) " + PRESTAMOS_EXTERNOS
            + " and a.idArticulo = :id group by a.idArticulo having count(s) = 1")
    Optional<Long> buscarPrestamoExterno(@Param("id") Long id);

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
