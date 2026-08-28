package kr.co.ultari.chatbot.admin.service;

import kr.co.ultari.chatbot.common.gateway.AiGatewayClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

/**
 * AI 환경설정: 게이트웨이 {@code /admin/settings}(전역, dept 무관)로 조회/저장을 프록시한다.
 * 응답 형식 {@code {file_ttl_days, temperature, system_prompt}}. (로컬 DB 저장 없음 — 게이트웨이 단일 소스)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminConfigService {

    private final AiGatewayClient gateway;

    /** 게이트웨이 실패 시 사용할 기본 보관일수 유도(기존 정적 설정에서). */
    @Value("${ultari.ai.document.cleanup.retention-hours:168}")
    int defaultRetentionHours;

    // file_ttl_days 캐시: 사용자 표시(/me/doc-retention)가 챗봇 접속마다 호출되므로 짧게 캐시.
    private static final long TTL_CACHE_MS = 60_000L;
    private volatile int cachedTtlDays = -1;
    private volatile long cachedAt = 0L;

    /** 설정 조회 — 게이트웨이 GET /admin/settings 응답을 그대로 통과. */
    public ResponseEntity<String> getSettings() {
        return gateway.get(null, "/admin/settings");
    }

    /** 설정 저장 — 게이트웨이 POST /admin/settings 로 JSON 전달, 응답 그대로 통과. */
    public ResponseEntity<String> saveSettings(String jsonBody) {
        ResponseEntity<String> res = gateway.postJson(null, "/admin/settings", jsonBody);
        cachedTtlDays = -1; // 저장 후 캐시 무효화
        return res;
    }

    /** 개인문서 보관일수(사용자 표시용). 게이트웨이 file_ttl_days를 60초 캐시, 실패 시 기본값. */
    public int getDocRetentionDays() {
        long now = System.currentTimeMillis();
        if (cachedTtlDays > 0 && (now - cachedAt) < TTL_CACHE_MS) return cachedTtlDays;

        int fallback = Math.max(1, defaultRetentionHours / 24);
        try {
            ResponseEntity<String> res = gateway.get(null, "/admin/settings");
            if (res != null && res.getBody() != null && !res.getBody().isBlank()) {
                int d = new JSONObject(res.getBody()).optInt("file_ttl_days", fallback);
                cachedTtlDays = d > 0 ? d : fallback;
                cachedAt = now;
                return cachedTtlDays;
            }
        } catch (Exception e) {
            log.warn("[config] file_ttl_days 조회 실패, 기본값({}) 사용: {}", fallback, e.getMessage());
        }
        return fallback;
    }
}
