package cl.duoc.citt.citt_backend.repositories;

import cl.duoc.citt.citt_backend.model.EstadoSolicitud;
import cl.duoc.citt.citt_backend.model.Solicitud;
import cl.duoc.citt.citt_backend.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Repository
public interface SolicitudRepository extends JpaRepository<Solicitud, Long> {

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
