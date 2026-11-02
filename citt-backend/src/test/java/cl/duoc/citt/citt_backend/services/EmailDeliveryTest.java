package cl.duoc.citt.citt_backend.services;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.PropertySource;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.mail.MailSenderAutoConfiguration;
import org.springframework.context.support.PropertySourcesPlaceholderConfigurer;

@EnabledIfEnvironmentVariable(named = "CITT_MAIL_LIVE_TEST", matches = "true")
class EmailDeliveryTest {
    @Configuration
    @PropertySource("classpath:application.properties")
    @Import(EmailService.class)
    @ImportAutoConfiguration(MailSenderAutoConfiguration.class)
    static class Config {
        @Bean static PropertySourcesPlaceholderConfigurer placeholders() {
            return new PropertySourcesPlaceholderConfigurer();
        }
    }
    @Test void enviarCorreoRealSinPostgres() throws Exception {
        try (var context = new AnnotationConfigApplicationContext(Config.class)) {
            context.getBean(EmailService.class).enviarCorreo(
                "cittvalparaiso@gmail.com", "Prueba de correo CITT",
                "Mensaje de prueba del Sistema de Reservas CITT.");
        }
    }
}
