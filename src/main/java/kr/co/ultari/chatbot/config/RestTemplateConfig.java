package kr.co.ultari.chatbot.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

@Slf4j
@Configuration
public class RestTemplateConfig {

    // AI 릴레이/요약 등 장시간 응답용 (기본). @Primary 로 기존 @Autowired 주입 유지.
    @Bean("AIRestTemplate")
    @Primary
    public RestTemplate restTemplate() {
        return build(Duration.ofSeconds(5), Duration.ofSeconds(30));
    }

    // 관리자 조회(count/list/search) 전용 — 짧은 타임아웃으로 빠르게 실패시켜 UI 무한 대기 방지.
    @Bean("AdminReadRestTemplate")
    public RestTemplate adminReadRestTemplate() {
        return build(Duration.ofSeconds(3), Duration.ofSeconds(8));
    }

    // 연결/읽기 타임아웃만 지정한 RestTemplate 생성. (Boot 4.0에서 분리된
    // ClientHttpRequestFactoryBuilder 대신 Spring Framework 표준 팩토리 사용)
    private RestTemplate build(Duration connectTimeout, Duration readTimeout) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeout);
        factory.setReadTimeout(readTimeout);
        return new RestTemplate(factory);
    }
}
