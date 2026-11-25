package cl.duoc.citt.citt_backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(properties="spring.jpa.hibernate.ddl-auto=create-drop")
@AutoConfigureTestDatabase(replace=AutoConfigureTestDatabase.Replace.NONE)
@EnabledIfEnvironmentVariable(named="CITT_PRUEBA_POSTGRES_AISLADO",matches="true")
class DisenosPlanoPostgresTest {
    @Autowired JdbcTemplate sql;
    @Test void bibliotecaPersisteSinPublicarYConservaElOriginal()throws Exception{
        sql.update("insert into distribucion_plano_citt(id,posiciones,revision) values(1,'{}',1)");
        var c=new DisenosPlanoController(sql,new ObjectMapper());
        assertEquals("predeterminado",c.listar().getBody().getFirst().id());
        sql.update("update distribucion_plano_citt set posiciones=? where id=1","{\"CW\":{\"x\":5,\"y\":0}}");
        c.listar();assertTrue(c.obtener("predeterminado").getBody().posiciones().isEmpty());
        var p=new PlanoCittController.Posicion(10d,20d,0d,false,"sillaCowork","#123456",50d,50d,100d);
        var nuevo=c.crear(new DisenosPlanoController.Nuevo("Taller",Map.of("extra-12345678-1234-1234-1234-123456789abc",p),DisenosPlanoTest.png(400,244))).getBody();
        assertEquals(p,c.obtener(nuevo.id()).getBody().posiciones().values().iterator().next());
        assertEquals(1L,sql.queryForObject("select revision from distribucion_plano_citt where id=1",Long.class));
        assertTrue(c.imagen(nuevo.id()).getHeaders().getCacheControl().contains("private"));
        assertTrue(c.listar().getBody().get(1).miniatura().endsWith("/portada"));
        c.eliminar(nuevo.id());assertEquals(1,c.listar().getBody().size());
    }
}
