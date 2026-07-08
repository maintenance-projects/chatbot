package kr.co.ultari.chatbot.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.web.client.ClientHttpRequestFactories;
import org.springframework.boot.web.client.ClientHttpRequestFactorySettings;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

@Slf4j
@Configuration
public class RestTemplateConfig {

    // AI 릴레이/요약 등 장시간 응답용 (기본). @Primary 로 기존 @Autowired 주입 유지.
    @Bean("AIRestTemplate")
    @Primary
    public RestTemplate restTemplate() {
        ClientHttpRequestFactorySettings settings = ClientHttpRequestFactorySettings.DEFAULTS
                .withConnectTimeout(Duration.ofSeconds(5))
                .withReadTimeout(Duration.ofSeconds(30));
        return new RestTemplate(ClientHttpRequestFactories.get(settings));
    }

    // 관리자 조회(count/list/search) 전용 — 짧은 타임아웃으로 빠르게 실패시켜 UI 무한 대기 방지.
    @Bean("AdminReadRestTemplate")
    public RestTemplate adminReadRestTemplate() {
        ClientHttpRequestFactorySettings settings = ClientHttpRequestFactorySettings.DEFAULTS
                .withConnectTimeout(Duration.ofSeconds(3))
                .withReadTimeout(Duration.ofSeconds(8));
        return new RestTemplate(ClientHttpRequestFactories.get(settings));
    }
}
