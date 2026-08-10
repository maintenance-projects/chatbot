package kr.co.ultari.chatbot.config;

import org.apache.ibatis.session.SqlSessionFactory;
import org.mybatis.spring.SqlSessionFactoryBean;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import javax.sql.DataSource;

/**
 * 인사(HR) DB 조회용 MyBatis 설정. hrDataSource에 바인딩되며,
 * 매퍼 인터페이스는 {@code kr.co.ultari.chatbot.hr.mapper}, SQL은 {@code classpath:mapper/hr/*.xml}.
 * (컬럼명이 불확실해 SQL을 XML로 외부화 — 운영 중 조정 가능)
 */
@Configuration
@MapperScan(basePackages = "kr.co.ultari.chatbot.hr.mapper", sqlSessionFactoryRef = "hrSqlSessionFactory")
public class MyBatisConfig {

    @Bean
    public SqlSessionFactory hrSqlSessionFactory(@Qualifier("hrDataSource") DataSource hrDataSource) throws Exception {
        SqlSessionFactoryBean factory = new SqlSessionFactoryBean();
        factory.setDataSource(hrDataSource);
        factory.setMapperLocations(
                new PathMatchingResourcePatternResolver().getResources("classpath:mapper/hr/*.xml"));
        return factory.getObject();
    }
}
