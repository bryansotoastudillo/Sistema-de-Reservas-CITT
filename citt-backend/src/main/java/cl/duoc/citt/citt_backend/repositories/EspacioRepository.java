package cl.duoc.citt.citt_backend.repositories;

import cl.duoc.citt.citt_backend.model.Espacio;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface EspacioRepository extends JpaRepository<Espacio, Long> {
    boolean existsByNombreIgnoreCase(String nombre);
    Optional<Espacio> findByNombreIgnoreCase(String nombre);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from Espacio e where e.id = :id")
    Optional<Espacio> bloquearPorId(@Param("id") Long id);

    boolean existsByOcupadoManualmenteHastaAfter(LocalDateTime inicio);
}
