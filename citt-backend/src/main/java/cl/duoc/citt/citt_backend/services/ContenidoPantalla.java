package cl.duoc.citt.citt_backend.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import javax.imageio.stream.MemoryCacheImageInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Service
public class ContenidoPantalla {
    private static final long MAXIMO_BYTES = 900 * 1024;
    private static final int MAXIMO_IMAGENES = 30;
    private static final System.Logger LOG = System.getLogger(ContenidoPantalla.class.getName());
    private final ObjectMapper json;
    private final Path directorio;

    public record Imagen(UUID id, String nombre, String archivo) {}
    public record Catalogo(long revision, List<Imagen> imagenes) {}

    public ContenidoPantalla(ObjectMapper json, @Value("${CITT_PANTALLA_DIR:${user.home}/.citt/contenido-pantalla}") String directorio) {
        this.json = json;
        this.directorio = Path.of(directorio).toAbsolutePath();
    }

    public synchronized Catalogo listar() throws IOException {
        Path catalogo = directorio.resolve("catalogo.json");
        if (Files.notExists(catalogo)) return new Catalogo(0, List.of());
        return json.readValue(catalogo.toFile(), Catalogo.class);
    }

    public Catalogo agregar(MultipartFile archivo) throws IOException {
        return guardarImagen(null, archivo);
    }

    public Catalogo reemplazar(UUID id, MultipartFile archivo) throws IOException {
        return guardarImagen(id, archivo);
    }

    private Catalogo guardarImagen(UUID id, MultipartFile carga) throws IOException {
        if (carga.isEmpty() || carga.getSize() > MAXIMO_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La imagen preparada debe pesar hasta 900 KB.");
        }
        byte[] bytes = carga.getBytes();
        String tipo = formato(bytes);
        String nombre = carga.getOriginalFilename();
        nombre = nombre == null ? "Imagen" : nombre.replace('\\', '/');
        nombre = nombre.substring(nombre.lastIndexOf('/') + 1).replaceAll("\\p{Cntrl}", "").strip();
        if (nombre.isEmpty()) nombre = "Imagen";
        if (nombre.length() > 150) nombre = nombre.substring(0, 150);

        synchronized (this) {
            Catalogo actual = listar();
            if (id == null && actual.imagenes().size() >= MAXIMO_IMAGENES) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Puedes publicar hasta 30 imágenes.");
            }
            List<Imagen> imagenes = new ArrayList<>(actual.imagenes());
            int indice = id == null ? imagenes.size() : indice(imagenes, id);
            Path archivo = directorio.resolve(UUID.randomUUID() + "." + tipo);
            Imagen imagen = new Imagen(id == null ? UUID.randomUUID() : id, nombre, archivo.getFileName().toString());
            Files.createDirectories(directorio);
            if (id == null) imagenes.add(imagen);
            else conservarDuranteUnaVuelta(imagenes.set(indice, imagen));
            Files.write(archivo, bytes);
            try {
                return publicar(actual, imagenes);
            } catch (IOException error) {
                Files.deleteIfExists(archivo);
                throw error;
            }
        }
    }

    public synchronized Catalogo eliminar(UUID id) throws IOException {
        Catalogo actual = listar();
        List<Imagen> imagenes = new ArrayList<>(actual.imagenes());
        conservarDuranteUnaVuelta(imagenes.remove(indice(imagenes, id)));
        return publicar(actual, imagenes);
    }

    public synchronized Catalogo mover(UUID id, int desplazamiento) throws IOException {
        Catalogo actual = listar();
        List<Imagen> imagenes = new ArrayList<>(actual.imagenes());
        int origen = indice(imagenes, id);
        int destino = origen + desplazamiento;
        if (destino < 0 || destino >= imagenes.size()) return actual;
        Collections.swap(imagenes, origen, destino);
        return publicar(actual, imagenes);
    }

    public synchronized Path verArchivo(String archivo) throws IOException {
        if (listar().imagenes().stream().noneMatch(imagen -> imagen.archivo().equals(archivo))) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "La imagen no está publicada.");
        }
        return directorio.resolve(archivo);
    }

    private Catalogo publicar(Catalogo actual, List<Imagen> imagenes) throws IOException {
        Catalogo siguiente = new Catalogo(actual.revision() + 1, List.copyOf(imagenes));
        Path temporal = directorio.resolve("." + UUID.randomUUID() + ".json");
        try {
            Files.write(temporal, json.writeValueAsBytes(siguiente));
            Files.move(temporal, directorio.resolve("catalogo.json"), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            return siguiente;
        } finally {
            Files.deleteIfExists(temporal);
        }
    }

    private int indice(List<Imagen> imagenes, UUID id) {
        for (int i = 0; i < imagenes.size(); i++) {
            if (imagenes.get(i).id().equals(id)) return i;
        }
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "La imagen ya no está en el carrusel.");
    }

    private String formato(byte[] bytes) {
        try (var entrada = new MemoryCacheImageInputStream(new ByteArrayInputStream(bytes))) {
            var lectores = ImageIO.getImageReaders(entrada);
            if (lectores.hasNext()) {
                var lector = lectores.next();
                try {
                    lector.setInput(entrada, true, true);
                    String tipo = lector.getFormatName();
                    if (("JPEG".equalsIgnoreCase(tipo) || "PNG".equalsIgnoreCase(tipo))
                            && (long) lector.getWidth(0) * lector.getHeight(0) <= 12_000_000) {
                        lector.read(0);
                        return "PNG".equalsIgnoreCase(tipo) ? "png" : "jpg";
                    }
                } finally {
                    lector.dispose();
                }
            }
        } catch (IOException imagenInvalida) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No se pudo leer la imagen.");
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sube una imagen PNG o JPEG de hasta 12 megapíxeles.");
    }

    private void conservarDuranteUnaVuelta(Imagen imagen) throws IOException {
        Path archivo = directorio.resolve(imagen.archivo());
        if (Files.exists(archivo)) Files.setLastModifiedTime(archivo, FileTime.from(Instant.now()));
    }

    @Scheduled(fixedDelay = 3_600_000)
    public synchronized void limpiarImagenesRetiradas() {
        if (Files.notExists(directorio)) return;
        try (var archivos = Files.list(directorio)) {
            var publicadas = listar().imagenes().stream().map(Imagen::archivo).toList();
            Instant limite = Instant.now().minus(1, ChronoUnit.DAYS);
            for (Path archivo : archivos.toList()) {
                String nombre = archivo.getFileName().toString();
                if (nombre.matches("[0-9a-f-]{36}\\.(jpg|jpeg|png)") && !publicadas.contains(nombre)
                        && Files.getLastModifiedTime(archivo).toInstant().isBefore(limite)) {
                    Files.deleteIfExists(archivo);
                }
            }
        } catch (IOException error) {
            LOG.log(System.Logger.Level.WARNING, "No se pudieron limpiar las imágenes de pantalla", error);
        }
    }
}
