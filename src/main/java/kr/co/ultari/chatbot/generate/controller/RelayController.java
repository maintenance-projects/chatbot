package kr.co.ultari.chatbot.generate.controller;

import kr.co.ultari.chatbot.generate.datamodel.dto.RequestDTO;
import kr.co.ultari.chatbot.generate.datamodel.dto.ResponseDTO;
import kr.co.ultari.chatbot.generate.service.AIRelayService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

@Profile("relay")
@Slf4j
@RestController
@RequestMapping("/api/chat")
public class RelayController {

    @Autowired
    AIRelayService relayService;

    @PostMapping
    public ResponseEntity<?> chat(@RequestBody RequestDTO req) {
        if(log.isDebugEnabled()) {
            log.debug(req.toString());
        }
        String answer = relayService.ChatRelayService(req);
        log.debug(answer);
        return ResponseEntity.ok(new ResponseDTO(answer));
    }

    @PostMapping("/upload")
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file, @RequestParam("message") String message, @RequestParam("deepResearch") boolean deepRsrch, @RequestParam("sessionId") String sessionId) {
        if(log.isDebugEnabled()) {
            log.debug(file.getOriginalFilename());
            log.debug("sessionId={}, message={}, deepResearch={}", sessionId, message, deepRsrch);
        }
        String answer = relayService.DocumentRelayService(sessionId,file,message,deepRsrch);
        log.debug(answer);
        return ResponseEntity.ok(new ResponseDTO(answer));
    }

    @PostMapping(value = "/upload/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter uploadStream(@RequestParam("file") MultipartFile file, @RequestParam("sessionId") String sessionId) {
        log.info(file.getOriginalFilename());
        log.info(sessionId);
        return relayService.ChatRelayServiceAudioStream(sessionId, file);
    }

    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chatStream(@RequestBody RequestDTO req) {
        log.info(req.toString());
        return relayService.ChatRelayServiceStream(req);
    }
}
