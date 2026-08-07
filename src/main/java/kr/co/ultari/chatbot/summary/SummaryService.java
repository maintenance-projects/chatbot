package kr.co.ultari.chatbot.summary;

import kr.co.ultari.chatbot.common.gateway.AiGatewayClient;
import kr.co.ultari.chatbot.common.sse.SseRelay;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 대화 요약 도메인: AI 서버 대화 요약 API(명세서 6장)로의 릴레이.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SummaryService {

    private final AiGatewayClient gateway;
    private final SseRelay sseRelay;

    /** 6.1 CSV 채팅 로그 → 대화록 변환 (text/plain) */
    public ResponseEntity<String> dialogue(String dept, MultipartFile csvFile) {
        MultipartBodyBuilder b = new MultipartBodyBuilder();
        b.part("csv_file", csvFile.getResource()).filename(csvFile.getOriginalFilename());
        return gateway.postMultipart(dept, "/convert/dialogue", b);
    }

    /** 6.2 대화 로그 LLM 요약 (SSE) */
    public SseEmitter dialogueSummary(String dept, MultipartFile csvFile) {
        MultipartBodyBuilder b = new MultipartBodyBuilder();
        b.part("csv_file", csvFile.getResource()).filename(csvFile.getOriginalFilename());
        return sseRelay.relay(() -> gateway.stream(dept, "/convert/dialogue-summary", b));
    }
}
