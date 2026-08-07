package kr.co.ultari.chatbot.summary;

import jakarta.servlet.http.HttpServletRequest;
import kr.co.ultari.chatbot.common.dept.DeptContext;
import kr.co.ultari.chatbot.common.web.GatewayApi;
import kr.co.ultari.chatbot.common.web.GatewayForward;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.nio.charset.StandardCharsets;

/**
 * 대화 요약 API (명세서 6장 대칭). 부서(dept)는 세션에서 주입.
 */
@GatewayApi
@RestController
@RequiredArgsConstructor
public class SummaryController {

    private final DeptContext deptContext;
    private final SummaryService service;

    /** 6.1 CSV 채팅 로그 → 대화록 변환 (text/plain) */
    @PostMapping("/convert/dialogue")
    public ResponseEntity<String> dialogue(@RequestParam("csv_file") MultipartFile csvFile,
                                           HttpServletRequest request) {
        return GatewayForward.as(
                service.dialogue(deptContext.resolve(request), csvFile),
                new MediaType(MediaType.TEXT_PLAIN, StandardCharsets.UTF_8));
    }

    /** 6.2 대화 로그 LLM 요약 (SSE) */
    @PostMapping(value = "/convert/dialogue-summary", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter dialogueSummary(@RequestParam("csv_file") MultipartFile csvFile,
                                      HttpServletRequest request) {
        return service.dialogueSummary(deptContext.resolve(request), csvFile);
    }
}
