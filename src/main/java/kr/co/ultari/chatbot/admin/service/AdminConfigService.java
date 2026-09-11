package kr.co.ultari.chatbot.admin.service;

import kr.co.ultari.chatbot.common.dept.DeptProperties;
import kr.co.ultari.chatbot.common.gateway.AiGatewayClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

/**
 * AI 환경설정: 게이트웨이 {@code /admin/settings/{dept}}(파티션별)로 조회/저장을 프록시한다.
 * 응답 형식 {@code {file_ttl_days, temperature, system_prompt}}. (로컬 DB 저장 없음 — 게이트웨이 단일 소스)
 * <p>temperature/system_prompt는 파티션별. file_ttl_days(보관기간)는 전역 취급으로,
 * 전용 API가 나오기 전까지 기본 dept({@link DeptProperties#getDefaultDept()}) 설정에서 조회/저장한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminConfigService {

    private final AiGatewayClient gateway;
    private final DeptProperties deptProperties;

    /** 게이트웨이 실패 시 사용할 기본 보관일수 유도(기존 정적 설정에서). */
    @Value("${ultari.ai.document.cleanup.retention-hours:168}")
    int defaultRetentionHours;

    // file_ttl_days 캐시: 사용자 표시(/me/doc-retention)가 챗봇 접속마다 호출되므로 짧게 캐시.
    private static final long TTL_CACHE_MS = 60_000L;
    private volatile int cachedTtlDays = -1;
    private volatile long cachedAt = 0L;

    /** 파티션별 설정 조회 — 게이트웨이 GET /admin/settings/{dept} 응답을 그대로 통과. */
    public ResponseEntity<String> getSettings(String dept) {
        return gateway.get(null, "/admin/settings/" + dept);
    }

    /**
     * 파티션별 설정 저장 — POST /admin/settings/{dept}.
     * <p>게이트웨이 per-dept 저장은 {@code temperature}·{@code system_prompt}만 허용한다
     * (그 외 필드는 422 extra_forbidden). 보관기간(file_ttl_days)은 전용 API 예정이라 여기서 보내지 않는다.
     * 전달 JSON에서 허용 키만 추려 봉투 필드·초과 필드 유입을 차단한다.
     */
    public ResponseEntity<String> saveSettings(String dept, String jsonBody) {
        String body = filterSettingKeys(jsonBody);
        ResponseEntity<String> res = gateway.postJson(null, "/admin/settings/" + dept, body);
        cachedTtlDays = -1; // 저장 후 캐시 무효화
        return res;
    }

    /** 게이트웨이 per-dept 저장이 허용하는 설정 키(보관기간·봉투 필드 제외). */
    private static final String[] SETTING_KEYS = {"temperature", "system_prompt"};

    /** 전달 JSON에서 허용 설정 키만 추린 JSON 반환(초과 필드로 인한 422 방지). */
    private String filterSettingKeys(String jsonBody) {
        JSONObject in = (jsonBody == null || jsonBody.isBlank()) ? new JSONObject() : new JSONObject(jsonBody);
        JSONObject out = new JSONObject();
        for (String k : SETTING_KEYS) {
            if (in.has(k)) out.put(k, in.get(k));
        }
        return out.toString();
    }

    /** 개인문서 보관기간 조회(전역) — 게이트웨이 GET /admin/file-ttl 응답을 그대로 통과. */
    public ResponseEntity<String> getFileTtl() {
        return gateway.get(null, "/admin/file-ttl");
    }

    /** 개인문서 보관기간 저장(전역) — file_ttl_days만 추려 POST /admin/file-ttl. 저장 후 캐시 무효화. */
    public ResponseEntity<String> saveFileTtl(String jsonBody) {
        JSONObject in = (jsonBody == null || jsonBody.isBlank()) ? new JSONObject() : new JSONObject(jsonBody);
        JSONObject out = new JSONObject();
        if (in.has("file_ttl_days")) out.put("file_ttl_days", in.get("file_ttl_days"));
        ResponseEntity<String> res = gateway.postJson(null, "/admin/file-ttl", out.toString());
        cachedTtlDays = -1; // 저장 후 캐시 무효화
        return res;
    }

    /**
     * 개인문서 보관일수(전역, 사용자 표시용). 게이트웨이 GET /admin/file-ttl 의 file_ttl_days를 60초 캐시, 실패 시 기본값.
     */
    public int getDocRetentionDays() {
        long now = System.currentTimeMillis();
        if (cachedTtlDays > 0 && (now - cachedAt) < TTL_CACHE_MS) return cachedTtlDays;

        int fallback = Math.max(1, defaultRetentionHours / 24);
        try {
            ResponseEntity<String> res = gateway.get(null, "/admin/file-ttl");
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
