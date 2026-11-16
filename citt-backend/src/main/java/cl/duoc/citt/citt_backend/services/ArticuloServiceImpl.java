package cl.duoc.citt.citt_backend.services;

import cl.duoc.citt.citt_backend.dto.ArticuloRequestDTO;
import cl.duoc.citt.citt_backend.dto.ArticuloResponseDTO;
import cl.duoc.citt.citt_backend.dto.ArticuloUpdateDTO;
import cl.duoc.citt.citt_backend.dto.EstadisticasInventarioDTO;
import cl.duoc.citt.citt_backend.exception.ReglaNegocioException;
import cl.duoc.citt.citt_backend.model.Articulo;
import cl.duoc.citt.citt_backend.model.Categoria;
import cl.duoc.citt.citt_backend.model.EstadoArticulo;
import cl.duoc.citt.citt_backend.repositories.ArticuloRepository;
import cl.duoc.citt.citt_backend.repositories.CategoriaRepository;
import cl.duoc.citt.citt_backend.repositories.EstadoArticuloRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ArticuloServiceImpl implements ArticuloService{
    private final ArticuloRepository articuloRepository;

    private final CategoriaRepository categoriaRepository;
    private final EstadoArticuloRepository estadoArticuloRepository;
    private final FichaActivoService fichas;

    private void estandarizarTextos(ArticuloRequestDTO dto) {
        if (dto.getNombreArticulo() != null) dto.setNombreArticulo(dto.getNombreArticulo().trim().toUpperCase());
        if (dto.getMarca() == null || dto.getMarca().isBlank()) {
            dto.setMarca("GENERICO");
        } else {
            dto.setMarca(dto.getMarca().trim().toUpperCase());
        }
        if (dto.getComentarios() != null) dto.setComentarios(dto.getComentarios().trim().toUpperCase());
        if (dto.getSfai() != null) dto.setSfai(dto.getSfai().trim().toUpperCase());
        if (dto.getColliers() != null) dto.setColliers(dto.getColliers().trim().toUpperCase());
        if (dto.getNumeroSerie() != null) dto.setNumeroSerie(dto.getNumeroSerie().trim().toUpperCase());
        if (dto.getEtiqueta() != null) dto.setEtiqueta(dto.getEtiqueta().trim().toUpperCase());

        if (dto.getCodigoDuoc() != null && !dto.getCodigoDuoc().isBlank()) {
            dto.setCodigoDuoc(dto.getCodigoDuoc().trim().toUpperCase());
        } else {
            dto.setCodigoDuoc(null);
        }
    }

    private void estandarizarTextosUpdate(ArticuloUpdateDTO dto) {
        if (dto.getNombreArticulo() != null) dto.setNombreArticulo(dto.getNombreArticulo().trim().toUpperCase());
        if (dto.getMarca() == null || dto.getMarca().isBlank()) {
            dto.setMarca("GENERICO");
        } else {
            dto.setMarca(dto.getMarca().trim().toUpperCase());
        }
        if (dto.getComentarios() != null) dto.setComentarios(dto.getComentarios().trim().toUpperCase());
        if (dto.getSfai() != null) dto.setSfai(dto.getSfai().trim().toUpperCase());
        if (dto.getColliers() != null) dto.setColliers(dto.getColliers().trim().toUpperCase());
        if (dto.getNumeroSerie() != null) dto.setNumeroSerie(dto.getNumeroSerie().trim().toUpperCase());
        if (dto.getEtiqueta() != null) dto.setEtiqueta(dto.getEtiqueta().trim().toUpperCase());
    }

    private Articulo fromCreate(ArticuloRequestDTO d){
        Articulo art = new Articulo();
        art.setNombreArticulo(d.getNombreArticulo());
        art.setMarca(d.getMarca());
        art.setComentarios(d.getComentarios());
        art.setSfai(d.getSfai());
        art.setColliers(d.getColliers());
        art.setNumeroSerie(d.getNumeroSerie());
        art.setValor(d.getValor());
        art.setEtiqueta(d.getEtiqueta());
        art.setFechaCompra(d.getFechaCompra());
        art.setCodigoDuoc(d.getCodigoDuoc());


        Categoria cat = categoriaRepository.findById(d.getIdCategoria())
                .orElseThrow(() -> new ReglaNegocioException("La categoría con ID " + d.getIdCategoria() + " no existe."));


        EstadoArticulo est = estadoArticuloRepository.findById(d.getIdEstadoArticulo())
                .orElseThrow(() -> new ReglaNegocioException("El estado con ID " + d.getIdEstadoArticulo() + " no existe."));


        art.setCategoria(cat);
        art.setEstadoArticulo(est);

        return art;
    }

    private ArticuloResponseDTO toDTO(Articulo a){
        return ArticuloResponseDTO.builder()
                .idArticulo(a.getIdArticulo())
                .nombreArticulo(a.getNombreArticulo())
                .marca(a.getMarca())
                .comentarios(a.getComentarios())
                .sfai(a.getSfai())
                .colliers(a.getColliers())
                .numeroSerie(a.getNumeroSerie())
                .valor(a.getValor())
                .etiqueta(a.getEtiqueta())
                .fechaCompra(a.getFechaCompra())
                .codigoDuoc(a.getCodigoDuoc())
                .idCategoria(a.getCategoria().getIdCategoria())
                .nombreCategoria(a.getCategoria().getNombreCategoria())
                .idEstadoArticulo(a.getEstadoArticulo().getIdEstadoArticulo())
                .nombreEstado(a.getEstadoArticulo().getNombreEstado())
                .esTecnologico(a.getCategoria().isEsTecnologico())
                .eliminado(a.isEliminado())
                .build();
    }

    private void aplicarUpdate(Articulo a, ArticuloUpdateDTO d){
        a.setNombreArticulo(d.getNombreArticulo());
        a.setMarca(d.getMarca());
        a.setComentarios(d.getComentarios());
        a.setSfai(d.getSfai());
        a.setColliers(d.getColliers());
        a.setNumeroSerie(d.getNumeroSerie());
        a.setValor(d.getValor());
        a.setEtiqueta(d.getEtiqueta());
        a.setFechaCompra(d.getFechaCompra());

        // Actualizamos las relaciones si el usuario mandó IDs diferentes
        Categoria cat = categoriaRepository.findById(d.getIdCategoria())
                .orElseThrow(() -> new ReglaNegocioException("La categoría con ID " + d.getIdCategoria() + " no existe."));

        EstadoArticulo est = estadoArticuloRepository.findById(d.getIdEstadoArticulo())
                .orElseThrow(() -> new ReglaNegocioException("El estado con ID " + d.getIdEstadoArticulo() + " no existe."));

        a.setCategoria(cat);
        a.setEstadoArticulo(est);
    }


    @Override
    @Transactional
    public ArticuloResponseDTO registrarArticulo(ArticuloRequestDTO dto) {
        estandarizarTextos(dto);

        if (dto.getCodigoDuoc() != null) {
            if(articuloRepository.contarPorCodigoDuocIgnorandoFiltros(dto.getCodigoDuoc()) > 0){
                throw new ReglaNegocioException("No se puede registrar: El código DUOC '" + dto.getCodigoDuoc() + "' ya fue utilizado.");
            }
        }

        Articulo saved = articuloRepository.save(fromCreate(dto));
        return toDTO(saved);
    }

    @Override
    public ArticuloResponseDTO obtenerArticuloPorId(Long id) {
        Articulo a = articuloRepository.findById(id)
                .orElseThrow(()-> new ReglaNegocioException("Artículo " + id + " no existe"));
        return toDTO(a);
    }

    @Override
    @Transactional
    public ArticuloResponseDTO actualizarArticulo(Long id, ArticuloUpdateDTO dto) {
        estandarizarTextosUpdate(dto);
        Articulo a = articuloRepository.buscarParaEditar(id)
                .orElseThrow(() -> new ReglaNegocioException("Articulo " + id + " no existe"));

        // --- NUEVA VALIDACIÓN DE COMENTARIOS ---
        EstadoArticulo nuevoEstado = estadoArticuloRepository.findById(dto.getIdEstadoArticulo())
                .orElseThrow(() -> new ReglaNegocioException("El estado con ID " + dto.getIdEstadoArticulo() + " no existe."));

        List<String> estadosCriticos = List.of("DAÑADO", "MANTENCION");
        if (estadosCriticos.contains(nuevoEstado.getNombreEstado().toUpperCase())) {
            if (dto.getComentarios() == null || dto.getComentarios().trim().isEmpty()) {
                throw new ReglaNegocioException("Para marcar el artículo como " + nuevoEstado.getNombreEstado() + ", debe ingresar obligatoriamente un comentario explicando la razón.");
            }
        }
        // ----------------------------------------

        aplicarUpdate(a, dto);
        Articulo saved = articuloRepository.saveAndFlush(a);
        if (dto.getFichaActivo() != null) fichas.guardar(id, dto.getFichaActivo());
        return toDTO(saved);
    }

    @Override
    public Page<ArticuloResponseDTO> listarArticulosAdmin(Long idCategoria, String nombre, boolean mostrarEliminados, Pageable pageable) {
        if (mostrarEliminados) {
            return articuloRepository.findAllAdminNativo(idCategoria, nombre, true, pageable)
                    .map(this::toDTO);
        }
        return articuloRepository.findAllPaginadoFiltrado(idCategoria, nombre, pageable)
                .map(this::toDTO);
    }

    @Override
    public Page<ArticuloResponseDTO> listarTecnologicosPorEstado(String estado, Pageable pageable) {
        return articuloRepository.findTecnologicosPorEstadoPaginado(estado.trim().toUpperCase(), pageable)
                .map(this::toDTO);
    }

    @Override
    @Transactional
    public void eliminarArticulo(Long id) {
        if(!articuloRepository.existsById(id)){
            throw new ReglaNegocioException("El articulo no existe");
        }

        // Spring intentará hacer un DELETE, pero @SQLDelete lo convertirá en un UPDATE.
        articuloRepository.deleteById(id);
    }

    @Override
    public EstadisticasInventarioDTO obtenerEstadisticasDashboard() {
        return EstadisticasInventarioDTO.builder()
                .totalArticulosTecnologicos(articuloRepository.contarArticulosTecnologicos())
                .totalInmobiliario(articuloRepository.contarInmobiliario())
                .totalPrestados(articuloRepository.contarPorEstadoFisico("PRESTADO"))
                .totalDanados(articuloRepository.contarPorEstadoFisico("DAÑADO"))
                .build();
    }

    @Override
    @Transactional
    public ArticuloResponseDTO restaurarArticulo(Long id) {
        int actualizados = articuloRepository.restaurarArticuloNativo(id);
        if (actualizados == 0) {
            throw new ReglaNegocioException("El artículo no existe.");
        }
        return obtenerArticuloPorId(id);
    }

    @Override
    @Transactional(readOnly = false)
    public void eliminarFisicamente(Long id) {
        try {
            articuloRepository.eliminarFisicamente(id);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            throw new ReglaNegocioException(
                    "No se puede eliminar físicamente el artículo porque tiene historial de préstamos o solicitudes asociadas. " +
                    "Use el borrado lógico en su lugar.");
        }
    }
}
