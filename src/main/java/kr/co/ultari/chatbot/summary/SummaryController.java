package kr.co.ultari.chatbot.summary;

import kr.co.ultari.chatbot.common.web.GatewayApi;
import kr.co.ultari.chatbot.common.web.GatewayForward;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * 대화 요약 API (명세서 6장 대칭). 메신저 대화 CSV는 개인·임시 데이터라 dept-less.
 */
@GatewayApi
@RestController
@RequiredArgsConstructor
public class SummaryController {

    @Value("${ultari.ai.temp.path:tmp}")
    private String tempPath;

    private final SummaryService service;

    /** 6.1 CSV 채팅 로그 → 대화록 변환 (text/plain) */
    @PostMapping("/convert/dialogue")
    public ResponseEntity<String> dialogue(@RequestParam("csv_file") MultipartFile csvFile) {
        return GatewayForward.as(
                service.dialogue(csvFile),
                new MediaType(MediaType.TEXT_PLAIN, StandardCharsets.UTF_8));
    }

    /** 6.2 대화 로그 LLM 요약 (SSE) */
    @PostMapping(value = "/convert/dialogue-summary", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter dialogueSummary(@RequestParam("csv_file") MultipartFile csvFile) {
        return service.dialogueSummary(csvFile);
    }

    /**
     * 대화요약 화면 전용: 서버에 저장된 CSV(/chatbot/csv/upload 로 저장)를 fileName+sessionId로
     * 참조해 요약 스트림으로 중계. summary.js가 GET으로 호출.
     */
    @GetMapping(value = "/convert/dialogue-summary/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter dialogueSummaryStream(@RequestParam("fileName") String fileName,
                                            @RequestParam("sessionId") String sessionId) {
        // 경로 탈출 방지: 파일명/세션ID는 단일 세그먼트만 허용(디렉터리 구분자 제거) + base 하위 확인
        String safeName = Paths.get(fileName).getFileName().toString();
        String safeSid = Paths.get(sessionId).getFileName().toString();
        Path base = Paths.get(tempPath).toAbsolutePath().normalize();
        Path csv = base.resolve(safeSid).resolve("dialog").resolve(safeName).normalize();
        if (!csv.startsWith(base)) {
            throw new IllegalArgumentException("잘못된 파일 경로");
        }
        return service.dialogueSummaryFromFile(csv);
    }
}
