package kr.co.ultari.chatbot.docgen;

import kr.co.ultari.chatbot.common.gateway.AiGatewayClient;
import kr.co.ultari.chatbot.common.sse.SseRelay;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;

/**
 * 문서 자동화 도메인: AI 서버 문서 자동화 API(명세서 5장)로의 릴레이.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DocGenService {

    private final AiGatewayClient gateway;
    private final SseRelay sseRelay;

    /** 5.1 HWPX 문서 자동 생성 (JSON) */
    public ResponseEntity<String> generateHwpx(String dept, String templateName, String contextData,
                                               Integer expiresIn, Boolean oneTime) {
        MultipartBodyBuilder b = new MultipartBodyBuilder();
        b.part("template_name", templateName);
        b.part("context_data", contextData);
        if (expiresIn != null) b.part("expires_in", expiresIn);
        if (oneTime != null) b.part("one_time", oneTime);
        return gateway.postMultipart(dept, "/documents/generate-hwpx", b);
    }

    /** 5.2 회의록 HWPX 생성 (SSE, 커스텀 stage/percent 형식 — 투명 전달) */
    public SseEmitter meetingMinutes(String dept, String rawText, MultipartFile file,
                                     Integer expiresIn, Boolean oneTime) {
        MultipartBodyBuilder b = new MultipartBodyBuilder();
        if (StringUtils.hasText(rawText)) b.part("raw_text", rawText);
        if (file != null && !file.isEmpty()) {
            b.part("file", file.getResource()).filename(file.getOriginalFilename());
        }
        if (expiresIn != null) b.part("expires_in", expiresIn);
        if (oneTime != null) b.part("one_time", oneTime);
        return sseRelay.relay(() -> gateway.stream(dept, "/documents/meeting-minutes/generate-from-text", b));
    }

    /** 5.3 토큰 기반 파일 다운로드 (binary) */
    public ResponseEntity<byte[]> download(String dept, String token) {
        return gateway.download(dept, "/documents/download/"
                + UriUtils.encodePathSegment(token == null ? "" : token, StandardCharsets.UTF_8));
    }
}
