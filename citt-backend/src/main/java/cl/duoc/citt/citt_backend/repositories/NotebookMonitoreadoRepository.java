package cl.duoc.citt.citt_backend.repositories;

import cl.duoc.citt.citt_backend.model.Articulo;
import cl.duoc.citt.citt_backend.model.NotebookMonitoreado;
import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
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

    interface PrestamoNotebook {
        Long getArticuloId();
        Long getSolicitudId();
        String getEstado();
        String getSolicitante();
        LocalDate getFecha();
        LocalTime getHoraFin();
        LocalDateTime getDevolucion();
        String getIdsDanados();
        String getComentariosArticulo();
    }

    @Query("""
            select a.idArticulo as articuloId, s.idSolicitud as solicitudId, s.estadoSolicitud.nombre as estado,
                   s.usuario.email as solicitante, s.fecha as fecha, s.horaFin as horaFin,
                   s.fechaDevolucionReal as devolucion, s.idsArticulosDanados as idsDanados,
                   a.comentarios as comentariosArticulo
            from NotebookMonitoreado n join n.articulo a, Solicitud s
            where a member of s.articulos and not a.eliminado
              and s.idSolicitud = coalesce(
                (select max(activa.idSolicitud) from Solicitud activa
                 where a member of activa.articulos and activa.estadoSolicitud.nombre in ('EN PROCESO', 'ATRASADO')),
                (select max(devuelta.idSolicitud) from Solicitud devuelta
                 where a member of devuelta.articulos and devuelta.estadoSolicitud.nombre = 'FINALIZADA'
                   and devuelta.fechaDevolucionReal = (
                     select max(historica.fechaDevolucionReal) from Solicitud historica
                     where a member of historica.articulos and historica.estadoSolicitud.nombre = 'FINALIZADA')),
                (select max(anterior.idSolicitud) from Solicitud anterior
                 where a member of anterior.articulos and anterior.estadoSolicitud.nombre = 'FINALIZADA'))
            """)
    List<PrestamoNotebook> listarUltimosPrestamos();

    @Query("""
            select a.nombreArticulo from Solicitud s join s.articulos a
            where s.idSolicitud = :id and a.eliminado = false and a.estadoArticulo.nombreEstado = 'PRESTADO'
              and exists (select n.id from NotebookMonitoreado n where n.articulo = a)
            order by a.nombreArticulo
            """)
    List<String> nombresPrestados(@Param("id") Long idSolicitud);

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
