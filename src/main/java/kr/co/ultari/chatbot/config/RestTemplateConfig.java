package kr.co.ultari.chatbot.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

@Slf4j
@Configuration
public class RestTemplateConfig {

    // AI 릴레이/요약 등 장시간 응답용 (기본). @Primary 로 기존 @Autowired 주입 유지.
    @Bean("AIRestTemplate")
    @Primary
    public RestTemplate restTemplate() {
        HttpComponentsClientHttpRequestFactory factory =
                new HttpComponentsClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(30_000);
        return new RestTemplate(factory);
    }

    // 관리자 조회(count/list/search) 전용 — 짧은 타임아웃으로 빠르게 실패시켜 UI 무한 대기 방지.
    @Bean("AdminReadRestTemplate")
    public RestTemplate adminReadRestTemplate() {
        HttpComponentsClientHttpRequestFactory factory =
                new HttpComponentsClientHttpRequestFactory();
        factory.setConnectTimeout(3_000);
        factory.setReadTimeout(8_000);
        return new RestTemplate(factory);
    }
}
