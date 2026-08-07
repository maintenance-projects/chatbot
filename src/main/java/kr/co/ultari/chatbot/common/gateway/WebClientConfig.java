package kr.co.ultari.chatbot.common.gateway;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * WebClient.Builder 빈 제공.
 * Boot 4.0(서블릿/webmvc 스택)에서는 WebClient.Builder가 자동 구성되지 않으므로 명시적으로 등록한다.
 * AiGatewayClient·AIRelayClientService가 주입받아 각자 커넥터/타임아웃을 구성한다.
 */
@Configuration
public class WebClientConfig {

    @Bean
    public WebClient.Builder webClientBuilder() {
        return WebClient.builder();
    }
}
