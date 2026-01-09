package kr.co.ultari.chatbot.generate.controller;

import kr.co.ultari.chatbot.generate.datamodel.dto.RequestDTO;
import kr.co.ultari.chatbot.generate.datamodel.dto.ResponseDTO;
import kr.co.ultari.chatbot.generate.service.AIRelayService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@Profile("relay")
@Slf4j
@RestController
@RequestMapping("/api/chat")
public class RelayController {

    @Autowired
    AIRelayService relayService;

    @PostMapping
    public ResponseEntity<?> chat(@RequestBody RequestDTO req) throws Exception {
        log.info(req.toString());
        String answer = relayService.ChatRelayService(req);
        log.info(answer);
        return ResponseEntity.ok(new ResponseDTO(answer));
    }

    @PostMapping("/upload")
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file, @RequestParam("deepResearch") boolean deepRsrch, @RequestParam("sessionId") String sessionId) throws Exception {
        log.info(file.getOriginalFilename());
        log.info("sessionId={}, deepResearch={}",sessionId,deepRsrch);
        String answer = relayService.DocumentRelayService(sessionId,file,deepRsrch);
        log.info(answer);
        return ResponseEntity.ok(new ResponseDTO(answer));
    }
}
