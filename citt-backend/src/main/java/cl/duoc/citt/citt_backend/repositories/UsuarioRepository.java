package cl.duoc.citt.citt_backend.repositories;

import cl.duoc.citt.citt_backend.model.Usuario;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
    Optional<Usuario> findByEmail(String email);
    Page<Usuario> findByEmailContainingIgnoreCase(String email, Pageable pageable);

    @Query(value = "select id from usuarios where id = :id for update", nativeQuery = true)
    Optional<Long> bloquearId(@Param("id") Long id);

    @Query("""
            select distinct u.email from Usuario u join u.roles r
            where u.habilitado = true and upper(r.nombre) in ('COORDINADOR', 'DIRECTOR')
            """)
    List<String> findEmailsDeCoordinadoresYDirectores();
}
