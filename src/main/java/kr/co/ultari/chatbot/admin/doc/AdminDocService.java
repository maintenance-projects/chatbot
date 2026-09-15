package kr.co.ultari.chatbot.admin.doc;

import kr.co.ultari.chatbot.common.gateway.AiGatewayClient;
import kr.co.ultari.chatbot.database.entity.MsgAdmin;
import kr.co.ultari.chatbot.database.repository.MsgAdminRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * 관리자 문서관리 도메인: AI 서버 관리자 API(명세서 4장, {@code /{dept}/admin/...})로의 릴레이.
 * <p>응답은 게이트웨이의 공통 코드 봉투(0000/4000/4004/5000)를 상태코드째 그대로 통과시킨다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminDocService {

    private final AiGatewayClient gateway;
    private final MsgAdminRepository adminRepository;

    /**
     * 4.1 문서 등록. 명세서가 요구하는 key(고유)·adminName은 서버에서 채운다
     * (프론트는 adminId+file만 전송 — 기존 UX 유지). key는 서버 생성 UUID.
     * partition(파티션명)이 있으면 등록 대상 파티션으로 함께 전송한다.
     */
    public ResponseEntity<String> add(String dept, String adminId, String partition, MultipartFile file) {
        String adminName = adminRepository.findById(adminId)
                .map(MsgAdmin::getAdminName)
                .orElse(adminId);
        String key = UUID.randomUUID().toString();
        MultipartBodyBuilder b = new MultipartBodyBuilder();
        b.part("key", key);
        b.part("adminId", adminId);
        b.part("adminName", adminName);
        if (StringUtils.hasText(partition)) b.part("partition", partition);
        b.part("file", file.getResource()).filename(file.getOriginalFilename());
        return gateway.postMultipart(dept, "/admin/add_documents", b);
    }

    /** 4.2 문서 삭제 — partition(파티션명)이 있으면 쿼리로 함께 전송. */
    public ResponseEntity<String> delete(String dept, String key, String partition) {
        String path = "/admin/del_documents/" + seg(key);
        if (StringUtils.hasText(partition)) path += "?partition=" + q(partition);
        return gateway.delete(dept, path);
    }

    /** 4.3 문서 목록 조회 — partition(파티션명)으로 필터. */
    public ResponseEntity<String> list(String dept, int page, int size, String orderType, String order, String partition) {
        String path = "/admin/get_documents?page=" + page + "&size=" + size
                + "&orderType=" + q(orderType) + "&order=" + q(order);
        if (StringUtils.hasText(partition)) path += "&partition=" + q(partition);
        return gateway.get(dept, path);
    }

    /** 4.4 문서 검색 — partition(파티션명)으로 필터. */
    public ResponseEntity<String> search(String dept, String searchType, String searchTerm,
                                         int page, int size, String orderType, String order, String partition) {
        String path = "/admin/documents/search?searchType=" + q(searchType)
                + "&searchTerm=" + q(searchTerm)
                + "&page=" + page + "&size=" + size
                + "&orderType=" + q(orderType) + "&order=" + q(order);
        if (StringUtils.hasText(partition)) path += "&partition=" + q(partition);
        return gateway.get(dept, path);
    }

    /** 4.5 문서 사용여부 토글(isUse 반전) — partition(파티션명)이 있으면 쿼리로 함께 전송. */
    public ResponseEntity<String> toggle(String dept, String key, String partition) {
        String path = "/admin/documents/" + seg(key) + "/toggle";
        if (StringUtils.hasText(partition)) path += "?partition=" + q(partition);
        return gateway.patch(dept, path);
    }

    /** 4.6 문서 통계 조회 */
    public ResponseEntity<String> count(String dept) {
        return gateway.get(dept, "/admin/documents/count");
    }

    /** 4.7 금칙어 목록 재로드 */
    public ResponseEntity<String> reloadProfanity(String dept) {
        return gateway.post(dept, "/admin/profanity/reload");
    }

    private static String q(String v) {
        return UriUtils.encodeQueryParam(v == null ? "" : v, StandardCharsets.UTF_8);
    }

    private static String seg(String v) {
        return UriUtils.encodePathSegment(v == null ? "" : v, StandardCharsets.UTF_8);
    }
}
