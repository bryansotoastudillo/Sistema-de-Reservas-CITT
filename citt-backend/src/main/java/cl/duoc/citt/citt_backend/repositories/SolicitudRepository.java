package cl.duoc.citt.citt_backend.repositories;

import cl.duoc.citt.citt_backend.model.EstadoSolicitud;
import cl.duoc.citt.citt_backend.model.Solicitud;
import cl.duoc.citt.citt_backend.model.Usuario;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface SolicitudRepository extends JpaRepository<Solicitud, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Solicitud s where s.idSolicitud = :id")
    Optional<Solicitud> bloquearPorId(@Param("id") Long id);

    @Modifying
    @Query("update Solicitud s set s.estadoSolicitud = :atrasado where s.idSolicitud = :id and s.estadoSolicitud = :enProceso")
    int marcarAtrasada(@Param("id") Long id, @Param("enProceso") EstadoSolicitud enProceso,
                       @Param("atrasado") EstadoSolicitud atrasado);

    @Query("""
            select s.idSolicitud from Solicitud s
            where s.estadoSolicitud.nombre = 'EN PROCESO' and s.recordatorioNotebookEnviado is null
              and s.fecha between :desde and :hasta
              and exists (select n.id from NotebookMonitoreado n
                  where n.articulo member of s.articulos and n.articulo.eliminado = false
                    and n.articulo.estadoArticulo.nombreEstado = 'PRESTADO')
            """)
    List<Long> prestamosConRecordatorioPendiente(@Param("desde") LocalDate desde, @Param("hasta") LocalDate hasta);

    List<Solicitud> findByUsuarioOrderByFechaDesc(Usuario usuario);

    List<Solicitud> findByFecha(LocalDate fecha);

    List<Solicitud> findByEstadoSolicitud(EstadoSolicitud estado);

    @Query("""
            SELECT s FROM Solicitud s JOIN FETCH s.espacio
            WHERE s.estadoSolicitud.nombre IN ('EN PROCESO', 'ATRASADO')
               OR (s.estadoSolicitud.nombre = 'APROBADA'
                   AND s.fecha = :fecha AND s.horaInicio <= :hora AND s.horaFin > :hora)
            """)
    List<Solicitud> findOcupacionesActuales(@Param("fecha") LocalDate fecha, @Param("hora") LocalTime hora);

    // Consulta para verificar si un espacio ya está reservado en un horario específico
    @Query("SELECT COUNT(s) FROM Solicitud s WHERE s.espacio.id = :idEspacio " +
            "AND s.fecha = :fecha " +
            "AND s.estadoSolicitud.nombre IN ('PENDIENTE', 'APROBADA', 'EN PROCESO', 'ATRASADO') " +
            "AND (s.horaInicio < :horaFin AND s.horaFin > :horaInicio)")
    int contarChoquesDeHorario(
            @Param("idEspacio") Long idEspacio,
            @Param("fecha") LocalDate fecha,
            @Param("horaInicio") LocalTime horaInicio,
            @Param("horaFin") LocalTime horaFin
    );

    //  Solicitud de Exclusividad: Verifica que TODO el CITT esté libre
    @Query("SELECT COUNT(s) FROM Solicitud s WHERE s.fecha = :fecha " +
            "AND s.estadoSolicitud.nombre IN ('PENDIENTE', 'APROBADA', 'EN PROCESO', 'ATRASADO') " +
            "AND (s.horaInicio < :horaFin AND s.horaFin > :horaInicio)")
    int contarCualquierReservaEnHorario(
            @Param("fecha") LocalDate fecha,
            @Param("horaInicio") LocalTime horaInicio,
            @Param("horaFin") LocalTime horaFin
    );

    // Solicitud Común: Bloquea reservas si ya hay una exclusividad activa
    @Query("SELECT COUNT(s) FROM Solicitud s WHERE s.fecha = :fecha " +
            "AND s.exclusividad = true " +
            "AND s.estadoSolicitud.nombre IN ('PENDIENTE', 'APROBADA', 'EN PROCESO', 'ATRASADO') " +
            "AND (s.horaInicio < :horaFin AND s.horaFin > :horaInicio)")
    int contarExclusividadesActivas(
            @Param("fecha") LocalDate fecha,
            @Param("horaInicio") LocalTime horaInicio,
            @Param("horaFin") LocalTime horaFin
    );

    @Query("SELECT s FROM Solicitud s WHERE s.espacio IS NOT NULL AND s.estadoSolicitud.nombre IN ('APROBADA', 'EN PROCESO', 'ATRASADO')")
    List<Solicitud> findSolicitudesParaCalendario();
}
