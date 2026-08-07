package kr.co.ultari.chatbot.filesearch;

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

/**
 * 첨부파일 검색 도메인: AI 서버 file-search API(명세서 7장)로의 릴레이.
 * 대화방 단위(invokeId)로 메신저 첨부파일을 인덱싱·검색한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FileSearchService {

    private final AiGatewayClient gateway;
    private final SseRelay sseRelay;
    private final AIUsageService aiUsageService;

    /** 7.1 첨부파일 업로드 및 인덱싱 (SSE) */
    public SseEmitter upload(String dept, String userId, String invokeId, String attachFileName, MultipartFile file) {
        aiUsageService.increase(userId, invokeId, "FILESEARCH");
        String filename = file.getOriginalFilename();
        MultipartBodyBuilder b = new MultipartBodyBuilder();
        b.part("attachFile_name", StringUtils.hasText(attachFileName) ? attachFileName : filename);
        b.part("attachFile_bin", file.getResource())
                .filename(filename)
                .contentType(MediaType.APPLICATION_OCTET_STREAM);
        return sseRelay.relay(() -> gateway.stream(dept, "/file-search/upload/" + invokeId, b));
    }

    /** 7.2 첨부파일 내용 질문 (SSE) */
    public SseEmitter ask(String dept, String userId, String invokeId, String message, String targetFilename) {
        aiUsageService.increase(userId, invokeId, "FILESEARCH");
        MultipartBodyBuilder b = new MultipartBodyBuilder();
        b.part("message", message);
        b.part("target_filename", targetFilename);
        return sseRelay.relay(() -> gateway.stream(dept, "/file-search/ask/" + invokeId, b));
    }

    /** 7.3 인덱싱된 파일 목록 조회 (JSON) */
    public ResponseEntity<String> files(String dept, String invokeId) {
        return gateway.get(dept, "/file-search/files/" + invokeId);
    }
}
