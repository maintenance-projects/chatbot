package kr.co.ultari.chatbot.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.jdbc.autoconfigure.DataSourceProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * 듀얼 데이터소스.
 * <ul>
 *   <li>app(@Primary, 쓰기): JPA 기본 — chatbot_admin, ai_usage_log, AI_USER_DEPT 등</li>
 *   <li>hr(조회 전용): MyBatis — 인사DB(msg_user, msg_part). 앱은 절대 쓰지 않음</li>
 * </ul>
 */
@Configuration
public class DataSourceConfig {

    // ===== 앱 DB (쓰기, JPA 기본) =====
    @Bean
    @Primary
    @ConfigurationProperties("spring.datasource")
    public DataSourceProperties appDataSourceProperties() {
        return new DataSourceProperties();
    }

    @Bean
    @Primary
    @ConfigurationProperties("spring.datasource.hikari")
    public HikariDataSource dataSource(@Qualifier("appDataSourceProperties") DataSourceProperties props) {
        return props.initializeDataSourceBuilder().type(HikariDataSource.class).build();
    }

    // ===== 인사(HR) DB (조회 전용, MyBatis) =====
    @Bean
    @ConfigurationProperties("hr.datasource")
    public DataSourceProperties hrDataSourceProperties() {
        return new DataSourceProperties();
    }

    @Bean
    @ConfigurationProperties("hr.datasource.hikari")
    public HikariDataSource hrDataSource(@Qualifier("hrDataSourceProperties") DataSourceProperties props) {
        return props.initializeDataSourceBuilder().type(HikariDataSource.class).build();
    }
}
