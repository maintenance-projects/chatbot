package kr.co.ultari.chatbot.pkb;

import kr.co.ultari.chatbot.common.gateway.AiGatewayClient;
import kr.co.ultari.chatbot.common.sse.SseRelay;
import kr.co.ultari.chatbot.database.service.AIUsageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * PKB(AI 첨부파일 비서) 도메인: AI 서버 PKB API(명세서 8장, {@code /{dept}/pkb/{ownerId}/...})로의 릴레이.
 * 개인 지식 저장소로, 소유자(ownerId) 단위로 파일을 AI 분석·인덱싱하고 자연어 검색한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PkbService {

    private final AiGatewayClient gateway;
    private final SseRelay sseRelay;
    private final AIUsageService aiUsageService;

    /** 8.1 첨부파일 인제스트 (AI 분석 포함, SSE) */
    public SseEmitter ingest(String dept, String ownerId, String sender, String roomName,
                             String receivedAt, String attachFileName, MultipartFile file) {
        aiUsageService.increase(ownerId, ownerId, "PKB");
        String filename = file.getOriginalFilename();
        MultipartBodyBuilder b = new MultipartBodyBuilder();
        b.part("sender", sender);
        if (StringUtils.hasText(roomName)) b.part("room_name", roomName);
        if (StringUtils.hasText(receivedAt)) b.part("received_at", receivedAt);
        b.part("attachFile_name", StringUtils.hasText(attachFileName) ? attachFileName : filename);
        b.part("attachFile_bin", file.getResource())
                .filename(filename)
                .contentType(MediaType.APPLICATION_OCTET_STREAM);
        return sseRelay.relay(() -> gateway.stream(dept, "/pkb/" + seg(ownerId) + "/ingest", b));
    }

    /** 8.2 내 파일 목록 조회 (JSON) */
    public ResponseEntity<String> files(String dept, String ownerId, String category, String tag) {
        StringBuilder path = new StringBuilder("/pkb/").append(seg(ownerId)).append("/files");
        List<String> qs = new ArrayList<>();
        if (StringUtils.hasText(category)) qs.add("category=" + q(category));
        if (StringUtils.hasText(tag)) qs.add("tag=" + q(tag));
        if (!qs.isEmpty()) path.append("?").append(String.join("&", qs));
        return gateway.get(dept, path.toString());
    }

    /** 8.3 파일 상세 정보 (JSON) */
    public ResponseEntity<String> file(String dept, String ownerId, String fileHash) {
        return gateway.get(dept, "/pkb/" + seg(ownerId) + "/file/" + seg(fileHash));
    }

    /** 8.4 파일 삭제 (JSON) */
    public ResponseEntity<String> delete(String dept, String ownerId, String fileHash) {
        return gateway.delete(dept, "/pkb/" + seg(ownerId) + "/file/" + seg(fileHash));
    }

    /** 8.5 자연어 검색 (SSE, intent별 응답) */
    public SseEmitter search(String dept, String ownerId, String message) {
        aiUsageService.increase(ownerId, ownerId, "PKB");
        MultipartBodyBuilder b = new MultipartBodyBuilder();
        b.part("message", message);
        return sseRelay.relay(() -> gateway.stream(dept, "/pkb/" + seg(ownerId) + "/search", b));
    }

    private static String q(String v) {
        return UriUtils.encodeQueryParam(v == null ? "" : v, StandardCharsets.UTF_8);
    }

    private static String seg(String v) {
        return UriUtils.encodePathSegment(v == null ? "" : v, StandardCharsets.UTF_8);
    }
}
