package cl.duoc.citt.citt_backend.controllers;

import cl.duoc.citt.citt_backend.services.NotebookMonitoreadoService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/notebooks")
@RequiredArgsConstructor
public class NotebookMonitoreadoController {
    private static final int MAX_REPORTE = 2_000_000;
    private final NotebookMonitoreadoService servicio;
    private final ObjectMapper json;

    @GetMapping
    @PreAuthorize("hasAnyRole('COORDINADOR', 'DIRECTOR')")
    public ResponseEntity<List<NotebookMonitoreadoService.Equipo>> listar() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(servicio.listar());
    }

    @PostMapping(value = "/{articuloId}/credencial", consumes = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('COORDINADOR', 'DIRECTOR')")
    public ResponseEntity<NotebookMonitoreadoService.Credencial> emitir(
            @PathVariable Long articuloId, @RequestParam(defaultValue = "false") boolean renovar) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(servicio.emitirCredencial(articuloId, renovar));
    }

    @PostMapping(value = "/reportes", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> recibir(
            @RequestHeader(value = "Authorization", required = false) String token,
            HttpServletRequest solicitud) throws IOException {
        Long prestamo = servicio.guardar(token, leerJson(solicitud, MAX_REPORTE));
        Map<String, Object> respuesta = new LinkedHashMap<>();
        respuesta.put("ok", true);
        if (prestamo != null) respuesta.put("prestamoExterno", prestamo);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(respuesta);
    }

    @PostMapping(value = "/ubicacion", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Void> recibirUbicacion(
            @RequestHeader(value = "Authorization", required = false) String token,
            HttpServletRequest solicitud) throws IOException {
        servicio.guardarUbicacion(token, leerJson(solicitud, 2048));
        return ResponseEntity.noContent().build();
    }

    private JsonNode leerJson(HttpServletRequest solicitud, int maximo) throws IOException {
        byte[] cuerpo = solicitud.getInputStream().readNBytes(maximo + 1);
        if (cuerpo.length > maximo) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE);
        try {
            return json.reader().with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS).readTree(cuerpo);
        } catch (JsonProcessingException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reporte JSON inválido");
        }
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> responderError(ResponseStatusException error) {
        String mensaje = error.getReason() == null ? "Reporte demasiado grande" : error.getReason();
        return ResponseEntity.status(error.getStatusCode()).body(Map.of("error", mensaje));
    }
}
