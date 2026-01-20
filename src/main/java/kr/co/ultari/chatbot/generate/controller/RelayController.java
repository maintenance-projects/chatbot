package kr.co.ultari.chatbot.generate.controller;

import kr.co.ultari.chatbot.generate.datamodel.dto.RequestDTO;
import kr.co.ultari.chatbot.generate.datamodel.dto.ResponseDTO;
import kr.co.ultari.chatbot.generate.service.AIRelayService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;

@Profile("relay")
@Slf4j
@RestController
@RequestMapping("/api/chat")
public class RelayController {

    @Autowired
    AIRelayService relayService;

    @Value("${ultari.ai.temp.path:tmp}")
    String tempPath;

    @PostMapping
    public ResponseEntity<?> chat(@RequestBody RequestDTO req) {
        if(log.isDebugEnabled()) {
            log.debug(req.toString());
        }
        String answer = relayService.ChatRelayService(req);
        log.debug(answer);
        return ResponseEntity.ok(new ResponseDTO(answer));
    }

    @PostMapping("/template")
    @ResponseBody
    public String requestTemplate(@RequestBody RequestDTO req) {
        return relayService.DocumentRelayTemplateService(req.getSessionId(), req.getMessage(), req.isDeepResearch(), null, req.getTemplateKey());
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
    public SseEmitter uploadStream(@RequestParam(value = "file") MultipartFile file, @RequestParam("message") String message, @RequestParam("deepResearch") boolean deepRsrch, @RequestParam("sessionId") String sessionId, @RequestParam(value="templateKey", required = false) String templateKey) {
        log.info(file.getOriginalFilename());
        log.info(sessionId);
        //return relayService.ChatRelayServiceAudioStream(sessionId, file);

        if(StringUtils.hasText(file.getOriginalFilename())) {
            String safeFilename = Paths.get(file.getOriginalFilename()).getFileName().toString();

            // 2. 저장 경로
            Path dirPath = Paths.get(tempPath);
            Path filePath = dirPath.resolve(safeFilename);

            try {
                // 3. 파일 저장 (덮어쓰기)
                Files.copy(
                        file.getInputStream(),
                        filePath,
                        StandardCopyOption.REPLACE_EXISTING
                );

                log.info("파일 저장 완료: {}", filePath);

            } catch (IOException e) {
                log.error("파일 저장 실패", e);
                throw new RuntimeException("파일 저장 중 오류가 발생했습니다.", e);
            }

        }

        return relayService.ChatRelayServiceStream(sessionId, message, deepRsrch, file);
    }

    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chatStream(@RequestBody RequestDTO req) {
        log.info(req.toString());
        return relayService.ChatRelayServiceStream(req);
    }
}
