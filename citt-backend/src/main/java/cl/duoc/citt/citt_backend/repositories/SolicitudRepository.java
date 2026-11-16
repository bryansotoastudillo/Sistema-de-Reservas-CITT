package cl.duoc.citt.citt_backend.repositories;

import cl.duoc.citt.citt_backend.model.EstadoSolicitud;
import cl.duoc.citt.citt_backend.model.Solicitud;
import cl.duoc.citt.citt_backend.model.Usuario;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface SolicitudRepository extends JpaRepository<Solicitud, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Solicitud s where s.idSolicitud = :id")
    Optional<Solicitud> bloquearPorId(@Param("id") Long id);


    List<Solicitud> findByUsuarioOrderByFechaDesc(Usuario usuario);

    List<Solicitud> findByFecha(LocalDate fecha);

    List<Solicitud> findByEstadoSolicitud(EstadoSolicitud estado);

    @Query("""
            SELECT s FROM Solicitud s JOIN FETCH s.espacio
            WHERE s.fechaLiberacionEspacio IS NULL AND (s.estadoSolicitud.nombre IN ('EN PROCESO', 'ATRASADO')
               OR (s.estadoSolicitud.nombre = 'APROBADA'
                   AND s.fecha = :fecha AND s.horaInicio <= :hora AND s.horaFin > :hora))
            """)
    List<Solicitud> findOcupacionesActuales(@Param("fecha") LocalDate fecha, @Param("hora") LocalTime hora);

    @Query("""
            SELECT s.idSolicitud FROM Solicitud s
            WHERE s.espacio IS NOT NULL AND (s.espacio.id = :id OR s.exclusividad = true)
              AND s.fechaLiberacionEspacio IS NULL
              AND (s.estadoSolicitud.nombre IN ('EN PROCESO', 'ATRASADO')
                OR (s.estadoSolicitud.nombre = 'APROBADA' AND s.fecha = :fecha
                    AND s.horaInicio <= :hora AND s.horaFin > :hora))
            ORDER BY s.idSolicitud
            """)
    List<Long> idsOcupacionesActualesDelEspacio(@Param("id") Long id, @Param("fecha") LocalDate fecha,
                                                @Param("hora") LocalTime hora);

    @Query("""
            SELECT COUNT(s) FROM Solicitud s
            WHERE s.espacio IS NOT NULL AND (s.espacio.id = :id OR s.exclusividad = true)
              AND s.fechaLiberacionEspacio IS NULL AND s.estadoSolicitud.nombre IN ('PENDIENTE', 'APROBADA')
              AND (s.fecha > :hoy OR (s.fecha = :hoy AND s.horaInicio > :hora))
              AND (s.fecha < :diaLimite OR (s.fecha = :diaLimite AND s.horaInicio < :horaLimite))
            """)
    long contarReservasPosteriores(@Param("id") Long id, @Param("hoy") LocalDate hoy,
                                   @Param("hora") LocalTime hora, @Param("diaLimite") LocalDate diaLimite,
                                   @Param("horaLimite") LocalTime horaLimite);

    // Consulta para verificar si un espacio ya está reservado en un horario específico
    @Query("SELECT COUNT(s) FROM Solicitud s WHERE s.espacio.id = :idEspacio " +
            "AND s.fechaLiberacionEspacio IS NULL " +
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
            "AND s.fechaLiberacionEspacio IS NULL " +
            "AND s.estadoSolicitud.nombre IN ('PENDIENTE', 'APROBADA', 'EN PROCESO', 'ATRASADO') " +
            "AND (s.horaInicio < :horaFin AND s.horaFin > :horaInicio)")
    int contarCualquierReservaEnHorario(
            @Param("fecha") LocalDate fecha,
            @Param("horaInicio") LocalTime horaInicio,
            @Param("horaFin") LocalTime horaFin
    );

    // Solicitud Común: Bloquea reservas si ya hay una exclusividad activa
    @Query("SELECT COUNT(s) FROM Solicitud s WHERE s.fecha = :fecha " +
            "AND s.fechaLiberacionEspacio IS NULL " +
            "AND s.exclusividad = true " +
            "AND s.estadoSolicitud.nombre IN ('PENDIENTE', 'APROBADA', 'EN PROCESO', 'ATRASADO') " +
            "AND (s.horaInicio < :horaFin AND s.horaFin > :horaInicio)")
    int contarExclusividadesActivas(
            @Param("fecha") LocalDate fecha,
            @Param("horaInicio") LocalTime horaInicio,
            @Param("horaFin") LocalTime horaFin
    );

    @Query("""
            SELECT COUNT(s) FROM Solicitud s WHERE s.espacio IS NOT NULL
              AND (s.espacio.id = :id OR s.exclusividad = true)
              AND s.fecha = :fecha
              AND s.estadoSolicitud.nombre IN ('PENDIENTE', 'APROBADA', 'EN PROCESO', 'ATRASADO', 'FINALIZADA')
              AND s.horaInicio < :fin AND s.horaFin > :inicio
              AND (s.fechaLiberacionEspacio IS NULL OR s.fechaLiberacionEspacio > :fechaHoraInicio)
              AND (s.fechaDevolucionReal IS NULL OR s.fechaDevolucionReal > :fechaHoraInicio)
            """)
    long contarChoquesRegularizacion(@Param("id") Long espacio, @Param("fecha") LocalDate fecha,
                                     @Param("inicio") LocalTime inicio, @Param("fin") LocalTime fin,
                                     @Param("fechaHoraInicio") LocalDateTime fechaHoraInicio);

    @Query("""
            SELECT s FROM Solicitud s WHERE s.espacio IS NOT NULL AND
              ((s.fechaLiberacionEspacio IS NULL AND s.estadoSolicitud.nombre IN ('APROBADA', 'EN PROCESO', 'ATRASADO'))
                OR (s.reservaRegularizada = true AND s.estadoSolicitud.nombre = 'FINALIZADA'))
            """)
    List<Solicitud> findSolicitudesParaCalendario();
}
