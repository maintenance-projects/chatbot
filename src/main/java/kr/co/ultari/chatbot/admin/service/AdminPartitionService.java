package kr.co.ultari.chatbot.admin.service;

import kr.co.ultari.chatbot.common.gateway.AiGatewayClient;
import kr.co.ultari.chatbot.database.entity.AiPartitionGrant;
import kr.co.ultari.chatbot.database.repository.AiPartitionGrantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * AI 파티션(벡터DB 하위) 관리 — 게이트웨이 {@code /{dept}/admin/partitions} 프록시.
 * <p>벡터DB(dept)는 URL <b>prefix</b>로 들어가므로 {@link AiGatewayClient#url(String, String)}의
 * 첫 인자에 dept를 넘긴다(환경설정 {@code /admin/settings/{dept}}가 path에 박는 것과 다름).
 * <ul>
 *   <li>목록 {@code GET  /{dept}/admin/partitions}</li>
 *   <li>생성 {@code POST /{dept}/admin/partitions} — body {@code description=파티션이름}(name은 게이트웨이 채번)</li>
 *   <li>삭제 {@code DELETE /{dept}/admin/partitions/{name}}</li>
 * </ul>
 * 게이트웨이 응답(봉투 {@code {code,message,partitions}})은 상태코드·본문째 그대로 통과한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminPartitionService {

    private final AiGatewayClient gateway;
    private final AiPartitionGrantRepository partitionGrantRepository;

    /** 파티션 목록 조회 — 게이트웨이 응답을 그대로 통과. */
    public ResponseEntity<String> list(String dept) {
        return gateway.get(dept, "/admin/partitions");
    }

    /** 파티션 생성 — description(사용자 입력 이름)만 multipart로 전달, name은 게이트웨이가 채번. */
    public ResponseEntity<String> create(String dept, String description) {
        MultipartBodyBuilder body = new MultipartBodyBuilder();
        body.part("description", description);
        return gateway.postMultipart(dept, "/admin/partitions", body);
    }

    /**
     * 파티션 이름 변경 — 식별자(name)는 경로로 유지, description(표시명)만 새 값으로 갱신.
     * 게이트웨이는 <b>PATCH + multipart</b>만 허용한다(POST/PUT=405, JSON=422).
     */
    public ResponseEntity<String> rename(String dept, String name, String description) {
        String encoded = URLEncoder.encode(name, StandardCharsets.UTF_8).replace("+", "%20");
        MultipartBodyBuilder body = new MultipartBodyBuilder();
        body.part("description", description);
        return gateway.patchMultipart(dept, "/admin/partitions/" + encoded, body);
    }

    /**
     * 파티션 삭제 — 식별자(name)를 경로에 넣어 전달(URL 인코딩).
     * 게이트웨이 삭제 성공(code 0000) 시에만 해당 파티션의 접근 권한(AI_PARTITION_GRANT) orphan을 함께 정리한다.
     */
    public ResponseEntity<String> delete(String dept, String name) {
        String encoded = URLEncoder.encode(name, StandardCharsets.UTF_8).replace("+", "%20");
        ResponseEntity<String> res = gateway.delete(dept, "/admin/partitions/" + encoded);
        if (res.getStatusCode().is2xxSuccessful() && isOk(res.getBody())) {
            List<AiPartitionGrant> grants =
                    partitionGrantRepository.findByAiDeptAndPartitionName(dept, name);
            if (!grants.isEmpty()) {
                partitionGrantRepository.deleteAll(grants);
                log.debug("[partition delete] dept={}, name={}, 권한 {}건 정리", dept, name, grants.size());
            }
        }
        return res;
    }

    /** 게이트웨이 응답 봉투가 성공(code 0000)인지. */
    private boolean isOk(String body) {
        if (body == null || body.isBlank()) return false;
        try {
            return "0000".equals(new JSONObject(body).optString("code"));
        } catch (Exception e) {
            return false;
        }
    }
}
