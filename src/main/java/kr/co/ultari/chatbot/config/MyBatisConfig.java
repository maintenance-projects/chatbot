package kr.co.ultari.chatbot.config;

import org.apache.ibatis.session.SqlSessionFactory;
import org.mybatis.spring.SqlSessionFactoryBean;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import javax.sql.DataSource;

/**
 * 인사(HR) DB 조회용 MyBatis 설정. hrDataSource에 바인딩되며,
 * 매퍼 인터페이스는 {@code kr.co.ultari.chatbot.hr.mapper}.
 * <p>SQL(매퍼 XML) 위치는 {@code hr.mapper.locations}로 설정한다. 기본값은 jar 내부
 * {@code classpath:mapper/hr/*.xml}. <b>납품 서버에서 리빌드 없이 쿼리를 조정하려면</b>
 * 외부 파일 경로로 지정한다(예: {@code file:./config/mapper/hr/*.xml}) 후 그 폴더의 XML을
 * 수정하고 앱을 재시작하면 반영된다. (MyBatis는 기동 시 1회 로드 — 런타임 핫리로드 없음)
 */
@Configuration
@MapperScan(basePackages = "kr.co.ultari.chatbot.hr.mapper", sqlSessionFactoryRef = "hrSqlSessionFactory")
public class MyBatisConfig {

    /** HR 매퍼 XML 위치. 외부화하려면 file: 경로로 오버라이드(예: file:./config/mapper/hr/*.xml). */
    @Value("${hr.mapper.locations:classpath:mapper/hr/*.xml}")
    private String mapperLocations;

    @Bean
    public SqlSessionFactory hrSqlSessionFactory(@Qualifier("hrDataSource") DataSource hrDataSource) throws Exception {
        SqlSessionFactoryBean factory = new SqlSessionFactoryBean();
        factory.setDataSource(hrDataSource);
        Resource[] resources =
                new PathMatchingResourcePatternResolver().getResources(mapperLocations);
        if (resources.length == 0) {
            throw new IllegalStateException(
                    "HR 매퍼 XML을 찾지 못했습니다: hr.mapper.locations=" + mapperLocations);
        }
        factory.setMapperLocations(resources);
        return factory.getObject();
    }
}
