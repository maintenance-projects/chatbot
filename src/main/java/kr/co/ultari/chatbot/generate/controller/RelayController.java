package kr.co.ultari.chatbot.generate.controller;

import kr.co.ultari.chatbot.generate.datamodel.dto.RequestDTO;
import kr.co.ultari.chatbot.generate.service.AIRelayService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 구 릴레이 컨트롤러(잔존분). 신규 재구성으로 대부분 /chat·/documents·/convert 컨트롤러로 이전됨.
 * 남은 엔드포인트: /api/chat/stream/continue (이어쓰기 — 유지 결정).
 */
@Slf4j
@RestController
@RequestMapping("/api/chat")
public class RelayController {

    @Autowired
    AIRelayService relayService;

    @PostMapping(value = "/stream/continue", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chatStreamContinue(@RequestBody RequestDTO req) {
        log.info(req.toString());
        return relayService.ChatRelayServiceStream(req);
    }
}
