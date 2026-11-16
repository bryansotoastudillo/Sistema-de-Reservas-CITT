package cl.duoc.citt.citt_backend.repositories;

import cl.duoc.citt.citt_backend.model.Articulo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface ArticuloRepository extends JpaRepository<Articulo,Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Articulo a where a.idArticulo = :id")
    java.util.Optional<Articulo> buscarParaEditar(@Param("id") Long id);

    @Query(value = "SELECT COUNT(*) FROM articulo WHERE LOWER(codigo_duoc) = LOWER(CAST(:codigoDuoc AS TEXT))", nativeQuery = true)
    int contarPorCodigoDuocIgnorandoFiltros(@Param("codigoDuoc") String codigoDuoc);

    @Query(value = "SELECT COUNT(*) FROM articulo WHERE id_categoria = :idCategoria", nativeQuery = true)
    int contarHistoricoPorCategoriaId(@Param("idCategoria") Long idCategoria);

    @Query(value = "SELECT * FROM articulo " +
            "WHERE (CAST(:idCategoria AS BIGINT) IS NULL OR id_categoria = CAST(:idCategoria AS BIGINT)) " +
            "AND (CAST(:nombre AS TEXT) IS NULL OR LOWER(nombre_articulo) LIKE LOWER(CONCAT('%', CAST(:nombre AS TEXT), '%'))) " +
            "AND (CAST(:mostrarEliminados AS BOOLEAN) = true OR eliminado = false) " +
            "ORDER BY nombre_articulo ASC",
            countQuery = "SELECT COUNT(*) FROM articulo " +
                    "WHERE (CAST(:idCategoria AS BIGINT) IS NULL OR id_categoria = CAST(:idCategoria AS BIGINT)) " +
                    "AND (CAST(:nombre AS TEXT) IS NULL OR LOWER(nombre_articulo) LIKE LOWER(CONCAT('%', CAST(:nombre AS TEXT), '%'))) " +
                    "AND (CAST(:mostrarEliminados AS BOOLEAN) = true OR eliminado = false)",
            nativeQuery = true)
    Page<Articulo> findAllAdminNativo(
            @Param("idCategoria") Long idCategoria,
            @Param("nombre") String nombre,
            @Param("mostrarEliminados") boolean mostrarEliminados,
            Pageable pageable);

    @Modifying
    @Transactional
    @Query(value = "DELETE FROM articulo WHERE id_articulo = :id", nativeQuery = true)
    void eliminarFisicamente(@Param("id") Long id);

    // countQuery para que Spring sepa cuántas páginas totales hay cuando usamos JOIN FETCH
    @Query(value = "SELECT a FROM Articulo a JOIN FETCH a.categoria JOIN FETCH a.estadoArticulo " +
            "WHERE (:idCategoria IS NULL OR a.categoria.idCategoria = :idCategoria) " +
            "AND (CAST(:nombre AS STRING) IS NULL OR LOWER(a.nombreArticulo) LIKE LOWER(CONCAT('%', CAST(:nombre AS STRING), '%'))) " +
            "ORDER BY a.nombreArticulo ASC",
            countQuery = "SELECT COUNT(a) FROM Articulo a " +
                    "WHERE (:idCategoria IS NULL OR a.categoria.idCategoria = :idCategoria) " +
                    "AND (CAST(:nombre AS STRING) IS NULL OR LOWER(a.nombreArticulo) LIKE LOWER(CONCAT('%', CAST(:nombre AS STRING), '%')))")
    Page<Articulo> findAllPaginadoFiltrado(@Param("idCategoria") Long idCategoria, @Param("nombre") String nombre, Pageable pageable);

    @Query(value = "SELECT c.id_categoria, c.nombre_categoria, a.marca, COUNT(a.id_articulo) AS total " +
            "FROM articulo a " +
            "JOIN categoria c ON a.id_categoria = c.id_categoria " +
            "JOIN estado_articulo e ON a.id_estado_articulo = e.id_estado_articulo " +
            "WHERE c.eliminado = false AND a.eliminado = false AND c.es_tecnologico = true AND e.nombre_estado = 'DISPONIBLE' " +
            "GROUP BY c.id_categoria, c.nombre_categoria, a.marca " +
            "ORDER BY c.nombre_categoria, a.marca", nativeQuery = true)
    List<Object[]> contarDisponiblesAgrupadosNativo();

    // Busca artículos tecnológicos filtrados por su estado exacto, con paginación
    @Query(value = "SELECT a FROM Articulo a JOIN FETCH a.categoria c JOIN FETCH a.estadoArticulo e " +
            "WHERE c.esTecnologico = true AND e.nombreEstado = :estado " +
            "ORDER BY a.nombreArticulo ASC",
            countQuery = "SELECT COUNT(a) FROM Articulo a JOIN a.categoria c JOIN a.estadoArticulo e " +
                    "WHERE c.esTecnologico = true AND e.nombreEstado = :estado")
    Page<Articulo> findTecnologicosPorEstadoPaginado(@Param("estado") String estado, Pageable pageable);

    @Query("SELECT COUNT(a) FROM Articulo a WHERE a.categoria.esTecnologico = true")
    long contarArticulosTecnologicos();

    @Query("SELECT COUNT(a) FROM Articulo a WHERE a.categoria.esTecnologico = false")
    long contarInmobiliario();

    @Query("SELECT COUNT(a) FROM Articulo a JOIN a.estadoArticulo e WHERE e.nombreEstado = :estado")
    long contarPorEstadoFisico(@Param("estado") String estado);

    @Modifying(clearAutomatically = true)
    @Query(value = "UPDATE articulo SET eliminado = false WHERE id_articulo = :id", nativeQuery = true)
    int restaurarArticuloNativo(@Param("id") Long id);

    @Query("SELECT COUNT(a) FROM Articulo a WHERE a.categoria.idCategoria = :idCategoria " +
            "AND a.marca = :marca AND a.estadoArticulo.nombreEstado = 'DISPONIBLE' AND a.eliminado = false")
    int contarDisponiblesPorCategoriaYMarca(@Param("idCategoria") Long idCategoria, @Param("marca") String marca);
}
