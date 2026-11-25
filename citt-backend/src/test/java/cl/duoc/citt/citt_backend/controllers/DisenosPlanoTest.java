package cl.duoc.citt.citt_backend.controllers;

import cl.duoc.citt.citt_backend.exception.ReglaNegocioException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.Map;
import javax.imageio.ImageIO;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DisenosPlanoTest {
    static String png(int w,int h)throws Exception{
        var b=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(w,h,BufferedImage.TYPE_INT_RGB),"png",b);
        return "data:image/png;base64,"+Base64.getEncoder().encodeToString(b.toByteArray());
    }
    @Test void portadaEsPngRealLimitado()throws Exception{
        assertDoesNotThrow(()->DisenosPlanoController.validarMiniatura(png(400,244)));
        assertThrows(ReglaNegocioException.class,()->DisenosPlanoController.validarMiniatura(png(801,2)));
        assertThrows(ReglaNegocioException.class,()->DisenosPlanoController.validarMiniatura("data:image/svg+xml;base64,PHN2Zz4="));
        assertThrows(ReglaNegocioException.class,()->DisenosPlanoController.validarMiniatura("data:image/png;base64,aGVsbG8="));
    }
    @Test void predeterminadoNoSeElimina(){
        var sql=mock(JdbcTemplate.class);var c=new DisenosPlanoController(sql,new ObjectMapper());
        assertThrows(ReglaNegocioException.class,()->c.eliminar("predeterminado"));verifyNoInteractions(sql);
    }
    @Test void guardarNoCambiaLaDistribucionPublicada()throws Exception{
        var sql=mock(JdbcTemplate.class);when(sql.queryForObject(anyString(),eq(Long.class))).thenReturn(1L);
        when(sql.queryForObject(anyString(),eq(Long.class),eq("Sala taller"))).thenReturn(0L);
        var c=new DisenosPlanoController(sql,new ObjectMapper());
        var result=c.crear(new DisenosPlanoController.Nuevo("Sala taller",Map.of(),png(400,244)));
        assertEquals(201,result.getStatusCode().value());
        verify(sql,never()).update(startsWith("update distribucion_plano_citt"),any(Object[].class));
        assertThrows(ReglaNegocioException.class,()->c.crear(new DisenosPlanoController.Nuevo("Predeterminado",Map.of(),png(1,1))));
    }
}
