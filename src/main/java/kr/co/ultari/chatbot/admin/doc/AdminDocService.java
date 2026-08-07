package kr.co.ultari.chatbot.admin.doc;

import kr.co.ultari.chatbot.common.gateway.AiGatewayClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;

/**
 * 관리자 문서관리 도메인: AI 서버 관리자 API(명세서 4장, {@code /{dept}/admin/...})로의 릴레이.
 * <p>응답은 게이트웨이의 공통 코드 봉투(0000/4000/4004/5000)를 그대로 통과시킨다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminDocService {

    private final AiGatewayClient gateway;

    /** 4.1 문서 등록 */
    public String add(String dept, String key, String adminId, String adminName, MultipartFile file) {
        MultipartBodyBuilder b = new MultipartBodyBuilder();
        b.part("key", key);
        b.part("adminId", adminId);
        b.part("adminName", adminName);
        b.part("file", file.getResource()).filename(file.getOriginalFilename());
        return gateway.postMultipart(dept, "/admin/add_documents", b);
    }

    /** 4.2 문서 삭제 */
    public String delete(String dept, String key) {
        return gateway.delete(dept, "/admin/del_documents/" + seg(key));
    }

    /** 4.3 문서 목록 조회 */
    public String list(String dept, int page, int size, String orderType, String order) {
        String path = "/admin/get_documents?page=" + page + "&size=" + size
                + "&orderType=" + q(orderType) + "&order=" + q(order);
        return gateway.get(dept, path);
    }

    /** 4.4 문서 검색 */
    public String search(String dept, String searchType, String searchTerm,
                         int page, int size, String orderType, String order) {
        String path = "/admin/documents/search?searchType=" + q(searchType)
                + "&searchTerm=" + q(searchTerm)
                + "&page=" + page + "&size=" + size
                + "&orderType=" + q(orderType) + "&order=" + q(order);
        return gateway.get(dept, path);
    }

    /** 4.5 문서 사용여부 토글(isUse 반전) */
    public String toggle(String dept, String key) {
        return gateway.patch(dept, "/admin/documents/" + seg(key) + "/toggle");
    }

    /** 4.6 문서 통계 조회 */
    public String count(String dept) {
        return gateway.get(dept, "/admin/documents/count");
    }

    /** 4.7 금칙어 목록 재로드 */
    public String reloadProfanity(String dept) {
        return gateway.post(dept, "/admin/profanity/reload");
    }

    private static String q(String v) {
        return UriUtils.encodeQueryParam(v == null ? "" : v, StandardCharsets.UTF_8);
    }

    private static String seg(String v) {
        return UriUtils.encodePathSegment(v == null ? "" : v, StandardCharsets.UTF_8);
    }
}
