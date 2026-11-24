package cl.duoc.citt.citt_backend.services;

import cl.duoc.citt.citt_backend.dto.DevolucionRequestDTO;
import cl.duoc.citt.citt_backend.exception.ReglaNegocioException;
import cl.duoc.citt.citt_backend.model.*;
import cl.duoc.citt.citt_backend.repositories.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import java.time.*;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class FlujoSolicitudesTest {
    SolicitudRepository solicitudes = mock(SolicitudRepository.class);
    EstadoSolicitudRepository estados = mock(EstadoSolicitudRepository.class);
    EmailService correo = mock(EmailService.class);
    ArticuloRepository articulos = mock(ArticuloRepository.class);
    EstadoArticuloRepository estadosArticulo = mock(EstadoArticuloRepository.class);
    Map<String, EstadoSolicitud> catalogo = new HashMap<>();
    SolicitudServiceImpl servicio;
    SolicitudSchedulerService scheduler;

    @BeforeEach void preparar() {
        long id = 1;
        for (String nombre : List.of("PENDIENTE", "APROBADA", "EN PROCESO", "ATRASADO", "RECHAZADA", "FINALIZADA")) {
            var estado = new EstadoSolicitud(id++, nombre); catalogo.put(nombre, estado);
            when(estados.findByNombreIgnoreCase(nombre)).thenReturn(Optional.of(estado));
            when(solicitudes.findByEstadoSolicitud(estado)).thenReturn(List.of());
        }
        when(solicitudes.save(any())).thenAnswer(i -> i.getArgument(0));
        servicio = new SolicitudServiceImpl(solicitudes, mock(UsuarioRepository.class), mock(EspacioRepository.class),
                articulos, estados, mock(EstadoEspacioRepository.class), estadosArticulo,
                mock(CategoriaRepository.class), mock(ApplicationEventPublisher.class));
        scheduler = new SolicitudSchedulerService(solicitudes, estados, correo);
    }

    Solicitud solicitud(String estado, boolean espacio, boolean pedir, boolean retirar, boolean vencida) {
        var s = Solicitud.builder().idSolicitud(1L).estadoSolicitud(catalogo.get(estado))
                .usuario(Usuario.builder().email("persona@example.test").build())
                .fecha(LocalDate.now(ZoneId.of("America/Santiago")).plusDays(vencida ? -1 : 0))
                .horaInicio(LocalTime.MIN).horaFin(LocalTime.MAX).exclusividad(false).build();
        if (espacio) {var e = new Espacio(); e.setNombre("Sala"); s.setEspacio(e);}
        if (pedir) {
            var categoria = new Categoria(); categoria.setIdCategoria(1L); categoria.setNombreCategoria("Notebook");
            var r = new RequerimientoArticulo(); r.setCategoria(categoria);r.setMarca("Marca");r.setCantidad(1);
            s.getRequerimientos().add(r);
            if (retirar) {
                var a = new Articulo();a.setIdArticulo(5L);a.setNombreArticulo("Notebook");a.setMarca("Marca");
                a.setCategoria(categoria);a.setEstadoArticulo(new EstadoArticulo(1L,"PRESTADO"));
                s.getArticulos().add(a);
            }
        }
        when(solicitudes.bloquearPorId(1L)).thenReturn(Optional.of(s));
        return s;
    }

    @Test void espacioAprobadoFinalizaSinAvisosDeArticulos() {
        var s = solicitud("APROBADA",true,false,false,true);
        when(solicitudes.findByEstadoSolicitud(catalogo.get("APROBADA"))).thenReturn(List.of(s));
        scheduler.detectarSolicitudesVencidas();
        assertEquals("FINALIZADA",s.getEstadoSolicitud().getNombre());
        assertNotNull(s.getFechaLiberacionEspacio());assertNull(s.getFechaDevolucionReal());
        verifyNoInteractions(correo);
    }

    @Test void soloArticulosSinRetiroFinalizaYNoReclamaDevolucion() {
        var s = solicitud("APROBADA",false,true,false,true);
        when(solicitudes.findByEstadoSolicitud(catalogo.get("APROBADA"))).thenReturn(List.of(s));
        scheduler.detectarSolicitudesVencidas();
        assertEquals("FINALIZADA",s.getEstadoSolicitud().getNombre());
        verify(correo).enviarCorreoVencimientoSinRetiro("persona@example.test",1L,s.getHoraFin());
        verify(correo,never()).enviarCorreoAtraso(any(),any(),any());
    }

    @Test void soloLoRetiradoPuedeQuedarAtrasado() {
        var s = solicitud("EN PROCESO",true,true,true,true);
        when(solicitudes.findByEstadoSolicitud(catalogo.get("EN PROCESO"))).thenReturn(List.of(s));
        scheduler.detectarSolicitudesVencidas();
        assertEquals("ATRASADO",s.getEstadoSolicitud().getNombre());
        verify(correo).enviarCorreoAtraso("persona@example.test",s.getFecha(),s.getHoraFin());
        verify(correo,never()).enviarCorreoVencimientoSinRetiro(any(),any(),any());
    }

    @Test void espacioAntiguoEnProcesoSeFinalizaSinAvisos() {
        var s = solicitud("EN PROCESO",true,false,false,true);
        when(solicitudes.findByEstadoSolicitud(catalogo.get("EN PROCESO"))).thenReturn(List.of(s));
        scheduler.detectarSolicitudesVencidas();assertEquals("FINALIZADA",s.getEstadoSolicitud().getNombre());verifyNoInteractions(correo);
    }

    @Test void impideRetiroODevolucionDeUnEspacioSolo() {
        solicitud("APROBADA",true,false,false,false);
        assertThrows(ReglaNegocioException.class,()->servicio.entregarArticulos(1L,List.of(),"ayudante@example.test"));
        assertThrows(ReglaNegocioException.class,()->servicio.devolverArticulos(1L,new DevolucionRequestDTO(),"ayudante@example.test"));
        verify(articulos,never()).saveAll(any());
    }

    @Test void retiroYDevolucionSeConfirmanConInventarioYTimestamps() {
        var s = solicitud("APROBADA",false,true,true,false);
        var a = s.getArticulos().getFirst();s.getArticulos().clear();
        a.setEstadoArticulo(new EstadoArticulo(1L,"DISPONIBLE"));
        when(articulos.findAllById(List.of(5L))).thenReturn(List.of(a));
        when(estadosArticulo.findAll()).thenReturn(List.of(new EstadoArticulo(1L,"DISPONIBLE"),
                new EstadoArticulo(2L,"PRESTADO"),new EstadoArticulo(3L,"DAÑADO")));
        var retirado = servicio.entregarArticulos(1L,List.of(5L),"ayudante@example.test");
        assertEquals("EN PROCESO",retirado.getEstado());assertNotNull(retirado.getFechaRetiroReal());
        assertEquals("PRESTADO",a.getEstadoArticulo().getNombreEstado());
        var devuelto = servicio.devolverArticulos(1L,new DevolucionRequestDTO(),"ayudante@example.test");
        assertEquals("FINALIZADA",devuelto.getEstado());assertNotNull(devuelto.getFechaDevolucionReal());
        assertEquals("DISPONIBLE",a.getEstadoArticulo().getNombreEstado());
        assertThrows(ReglaNegocioException.class,()->servicio.devolverArticulos(1L,new DevolucionRequestDTO(),"ayudante@example.test"));
    }

    @Test void reservaFuturaNoSeFinaliza() {
        var s=solicitud("APROBADA",true,false,false,false);
        when(solicitudes.findByEstadoSolicitud(catalogo.get("APROBADA"))).thenReturn(List.of(s));
        scheduler.detectarSolicitudesVencidas();assertEquals("APROBADA",s.getEstadoSolicitud().getNombre());verifyNoInteractions(correo);
    }

    @Test void unidadesAsignadasSinConfirmarRetiroNoGeneranDevolucionPendiente() {
        var s=solicitud("APROBADA",false,true,true,true);
        when(solicitudes.findByEstadoSolicitud(catalogo.get("APROBADA"))).thenReturn(List.of(s));
        scheduler.detectarSolicitudesVencidas();
        assertEquals("FINALIZADA",s.getEstadoSolicitud().getNombre());
        verify(correo,never()).enviarCorreoAtraso(any(),any(),any());
    }
}
