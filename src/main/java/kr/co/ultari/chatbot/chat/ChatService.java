package kr.co.ultari.chatbot.chat;

import kr.co.ultari.chatbot.common.gateway.AiGatewayClient;
import kr.co.ultari.chatbot.common.sse.SseRelay;
import kr.co.ultari.chatbot.database.service.AIUsageService;
import kr.co.ultari.chatbot.generate.service.CachedService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

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

    /** PDF 페이지 보기(/document/view) 로컬 사본 저장 경로. */
    @Value("${ultari.ai.temp.path:tmp}")
    private String tempPath;

    /** 2.1 문서 업로드 및 인덱싱 (SSE) */
    public SseEmitter upload(String dept, String userId, String invokeId, String attachFileName, MultipartFile file) {
        aiUsageService.increase(userId, invokeId, "DOCUMENT");
        String filename = file.getOriginalFilename();
        String safeName = Paths.get(filename == null ? "file" : filename).getFileName().toString();

        MultipartBodyBuilder b = new MultipartBodyBuilder();
        b.part("attachFile_name", StringUtils.hasText(attachFileName) ? attachFileName : filename);

        // PDF는 페이지 보기(/document/view/{sessionId}/{fileName})용 로컬 사본을 저장하고,
        // 게이트웨이엔 그 사본에서 스트리밍한다. (다른 타입은 로컬 미리보기가 없어 원본 스트리밍)
        Path local = savePdfCopyForPreview(invokeId, safeName, file);
        if (local != null) {
            b.part("attachFile_bin", new FileSystemResource(local))
                    .filename(safeName)
                    .contentType(MediaType.APPLICATION_OCTET_STREAM);
        } else {
            b.part("attachFile_bin", file.getResource())
                    .filename(filename)
                    .contentType(MediaType.APPLICATION_OCTET_STREAM);
        }
        // 새 문서 인덱싱 완료 시 파일목록 캐시 무효화
        return sseRelay.relay(
                () -> gateway.stream(null, "/upload/" + invokeId, b), // 개인 업로드: 파티션 무관
                () -> cachedService.FilesCacheClear(invokeId)
        );
    }

    /**
     * PDF면 {@code tmp/{invokeId}/document/{fileName}}에 로컬 사본 저장(페이지 보기용) 후 그 경로 반환,
     * 아니거나 실패하면 null. 경로는 DefaultController.viewDocument와 동일 규칙(단일 세그먼트)으로 맞춘다.
     */
    private Path savePdfCopyForPreview(String invokeId, String safeName, MultipartFile file) {
        if (!safeName.toLowerCase().endsWith(".pdf")) return null;
        try {
            String safeSid = Paths.get(invokeId == null ? "" : invokeId).getFileName().toString();
            Path dir = Paths.get(tempPath, safeSid, "document");
            Files.createDirectories(dir);
            Path local = dir.resolve(safeName);
            Files.copy(file.getInputStream(), local, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            return local;
        } catch (Exception e) {
            log.warn("[upload] PDF 미리보기용 로컬 사본 저장 실패(원본 스트리밍으로 대체): {}", e.getMessage());
            return null;
        }
    }

    /** 3.1 통합 챗봇 — target_filename 유무로 private/open 라우팅 (SSE) */
    public SseEmitter message(String dept, String userId, String invokeId, String message, String targetFilename, String translateTo) {
        // 개인 업로드 문서 질문(target_filename 있음)은 파티션 무관 private로 라우팅해야 한다.
        // (업로드가 dept-less /upload에 저장되므로 dept-scoped /message로 물으면 파일을 못 찾음)
        if (StringUtils.hasText(targetFilename)) {
            return messagePrivate(dept, userId, invokeId, message, targetFilename, translateTo);
        }
        aiUsageService.increase(userId, invokeId, "CHAT");
        MultipartBodyBuilder b = new MultipartBodyBuilder();
        b.part("message", message);
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
        return sseRelay.relay(() -> gateway.stream(null, "/message/private/" + invokeId, b)); // 개인 문서 대화: 파티션 무관
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
        return sseRelay.relay(() -> gateway.stream(null, "/message/document-summary/" + invokeId, b)); // 개인 업로드 문서 요약: 파티션 무관
    }

    /** 2.4 업로드 파일 목록 조회 (JSON). 성공 응답만 FILES 캐시. */
    @Cacheable(cacheNames = "FILES", key = "#invokeId",
            unless = "#result == null || !#result.statusCode.is2xxSuccessful()")
    public ResponseEntity<String> files(String dept, String invokeId) {
        return gateway.get(null, "/files/" + invokeId); // 개인 파일 목록: 파티션 무관
    }

    /** 2.5 대화 기록 조회 (JSON) */
    public ResponseEntity<String> history(String dept, String invokeId) {
        return gateway.get(null, "/history/" + invokeId); // 개인 대화 기록: 파티션 무관
    }
}
