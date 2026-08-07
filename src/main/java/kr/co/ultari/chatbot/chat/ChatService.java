package kr.co.ultari.chatbot.chat;

import kr.co.ultari.chatbot.common.gateway.AiGatewayClient;
import kr.co.ultari.chatbot.common.sse.SseRelay;
import kr.co.ultari.chatbot.database.service.AIUsageService;
import kr.co.ultari.chatbot.generate.service.CachedService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 챗봇 도메인: AI 서버 챗봇 API(명세서 2·3장)로의 릴레이.
 * <p>부서코드(dept)는 컨트롤러가 세션에서 주입하고, 여기서는 게이트웨이 경로만 조립한다.
 * 사용량 로깅·파일목록 캐시(상태형)는 기존 서비스를 재사용한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {

    private final AiGatewayClient gateway;
    private final SseRelay sseRelay;
    private final AIUsageService aiUsageService;
    private final CachedService cachedService;

    /** 2.1 문서 업로드 및 인덱싱 (SSE) */
    public SseEmitter upload(String dept, String userId, String invokeId, String attachFileName, MultipartFile file) {
        aiUsageService.increase(userId, invokeId, "DOCUMENT");
        String filename = file.getOriginalFilename();
        MultipartBodyBuilder b = new MultipartBodyBuilder();
        b.part("attachFile_name", StringUtils.hasText(attachFileName) ? attachFileName : filename);
        b.part("attachFile_bin", file.getResource())
                .filename(filename)
                .contentType(MediaType.APPLICATION_OCTET_STREAM);
        // 새 문서 인덱싱 완료 시 파일목록 캐시 무효화
        return sseRelay.relay(
                () -> gateway.stream(dept, "/upload/" + invokeId, b),
                () -> cachedService.FilesCacheClear(invokeId)
        );
    }

    /** 3.1 통합 챗봇 — target_filename 유무로 private/open 자동 라우팅 (SSE) */
    public SseEmitter message(String dept, String userId, String invokeId, String message, String targetFilename, String translateTo) {
        aiUsageService.increase(userId, invokeId, "CHAT");
        MultipartBodyBuilder b = new MultipartBodyBuilder();
        b.part("message", message);
        if (StringUtils.hasText(targetFilename)) b.part("target_filename", targetFilename);
        if (StringUtils.hasText(translateTo)) b.part("translate_to", translateTo);
        return sseRelay.relay(() -> gateway.stream(dept, "/message/" + invokeId, b));
    }

    /** 2.2 Private 대화 — 특정 문서 검색 (SSE) */
    public SseEmitter messagePrivate(String dept, String userId, String invokeId, String message, String targetFilename, String translateTo) {
        aiUsageService.increase(userId, invokeId, "CHAT");
        MultipartBodyBuilder b = new MultipartBodyBuilder();
        b.part("message", message);
        b.part("target_filename", targetFilename);
        if (StringUtils.hasText(translateTo)) b.part("translate_to", translateTo);
        return sseRelay.relay(() -> gateway.stream(dept, "/message/private/" + invokeId, b));
    }

    /** 2.3 Open 대화 — 전체 문서 검색 (SSE) */
    public SseEmitter messageOpen(String dept, String userId, String invokeId, String message, String translateTo) {
        aiUsageService.increase(userId, invokeId, "CHAT");
        MultipartBodyBuilder b = new MultipartBodyBuilder();
        b.part("message", message);
        if (StringUtils.hasText(translateTo)) b.part("translate_to", translateTo);
        return sseRelay.relay(() -> gateway.stream(dept, "/message/open/" + invokeId, b));
    }

    /** 2.6 문서 체계적 요약 (SSE) */
    public SseEmitter documentSummary(String dept, String userId, String invokeId, String targetFilename) {
        aiUsageService.increase(userId, invokeId, "SUMMARY");
        MultipartBodyBuilder b = new MultipartBodyBuilder();
        b.part("target_filename", targetFilename);
        return sseRelay.relay(() -> gateway.stream(dept, "/message/document-summary/" + invokeId, b));
    }

    /** 2.4 업로드 파일 목록 조회 (JSON). 성공 응답만 FILES 캐시. */
    @Cacheable(cacheNames = "FILES", key = "#invokeId",
            unless = "#result == null || !#result.statusCode.is2xxSuccessful()")
    public ResponseEntity<String> files(String dept, String invokeId) {
        return gateway.get(dept, "/files/" + invokeId);
    }

    /** 2.5 대화 기록 조회 (JSON) */
    public ResponseEntity<String> history(String dept, String invokeId) {
        return gateway.get(dept, "/history/" + invokeId);
    }
}
