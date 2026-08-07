package kr.co.ultari.chatbot.common.gateway;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * AI 서버(게이트웨이) 접속 설정.
 * 실제 요청 URL은 {@code baseUrl + "/" + dept + path} 로 조립된다.
 */
@Component
@Getter
@Setter
@ConfigurationProperties(prefix = "ultari.ai-gateway")
public class AiGatewayProperties {

    /** AI 서버 base URL (부서 prefix 이전). 예: http://10.0.0.31:8000 */
    private String baseUrl = "http://10.0.0.31:8000";

    /** 커넥션 타임아웃(ms) */
    private int connectTimeoutMs = 3000;
}
