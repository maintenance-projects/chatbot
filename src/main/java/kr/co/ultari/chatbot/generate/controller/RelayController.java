package kr.co.ultari.chatbot.generate.controller;

import kr.co.ultari.chatbot.generate.datamodel.dto.RequestDTO;
import kr.co.ultari.chatbot.generate.service.AICsvService;
import kr.co.ultari.chatbot.generate.service.AIRelayService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * 구 릴레이 컨트롤러(잔존분). 신규 재구성으로 대부분 /chat·/documents 컨트롤러로 이전됨.
 * 남은 엔드포인트:
 *  - /api/chat/stream/continue : 이어쓰기(유지 결정)
 *  - /api/chat/csv/stream      : 대화요약 화면(summary.js) — 서버 저장 CSV 경로 참조 방식
 */
@Slf4j
@RestController
@RequestMapping("/api/chat")
public class RelayController {

    @Autowired
    AIRelayService relayService;

    @Autowired
    AICsvService csvService;

    @Value("${ultari.ai.temp.path:tmp}")
    String tempPath;

    @PostMapping(value = "/stream/continue", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chatStreamContinue(@RequestBody RequestDTO req) {
        log.info(req.toString());
        return relayService.ChatRelayServiceStream(req);
    }

    @RequestMapping(value = "/csv/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE + ";charset=UTF-8")
    public SseEmitter streamCsvSummary(@RequestParam("fileName") String fileName, @RequestParam("sessionId") String sessionId) throws Exception {
        log.debug(fileName);
        log.debug(sessionId);
        return csvService.callAiServer(getCsvPath(fileName, sessionId), sessionId);
    }

    protected Path getCsvPath(String fileKey, String sessionId) {
        Path dirPath = Paths.get(tempPath + File.separator + sessionId + File.separator + "dialog");
        return dirPath.resolve(fileKey);
    }
}
