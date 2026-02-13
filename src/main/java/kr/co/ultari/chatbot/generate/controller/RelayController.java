package kr.co.ultari.chatbot.generate.controller;

import kr.co.ultari.chatbot.generate.datamodel.dto.RequestDTO;
import kr.co.ultari.chatbot.generate.datamodel.dto.ResponseDTO;
import kr.co.ultari.chatbot.generate.service.AICsvService;
import kr.co.ultari.chatbot.generate.service.AIRelayService;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.ui.Model;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.concurrent.Executors;

@Profile("relay")
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
        log.debug(req.toString());
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
    public SseEmitter uploadStream(@RequestParam(value = "file") MultipartFile file, @RequestParam("message") String message, @RequestParam("deepResearch") boolean deepRsrch
            , @RequestParam("sessionId") String sessionId, @RequestParam(value="templateKey", required = false) String templateKey
            , @RequestParam(value="isContinue", required = false) boolean isContinue) {
        log.info("fileName = {}, sessionId = {}",file.getOriginalFilename(), sessionId);
        //return relayService.ChatRelayServiceAudioStream(sessionId, file);

        RequestDTO req = new RequestDTO(sessionId, message, templateKey, null, deepRsrch, isContinue, null);
        if(StringUtils.hasText(file.getOriginalFilename())) {
            String safeFilename = Paths.get(file.getOriginalFilename()).getFileName().toString();

            File f = new File(tempPath + File.separator + sessionId + File.separator + "document");
            if(!f.exists()) f.mkdirs();

            // 2. 저장 경로
            Path dirPath = Paths.get(f.getPath());
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

        return relayService.ChatRelayServiceStream(req, file);
    }

    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chatStream(@RequestBody RequestDTO req) {
        log.info(req.toString());
        return relayService.ChatRelayServiceStream(req);
    }

    @PostMapping(value = "/stream/continue", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chatStreamContinue(@RequestBody RequestDTO req) {
        log.info(req.toString());

        return relayService.ChatRelayServiceStream(req);
    }

    @RequestMapping("/files")
    public List<String> requestFileList(@RequestParam("sessionId") String sessionId) {
        log.debug(sessionId);
        return relayService.requestFileList(sessionId);
    }

    @RequestMapping(value = "/csv/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE + ";charset=UTF-8")
    public SseEmitter streamCsvSummary(@RequestParam("fileName") String fileName, @RequestParam("sessionId") String sessionId) throws Exception {
        log.debug(fileName);
        log.debug(sessionId);

        return csvService.callAiServer(getCsvPath(fileName, sessionId), sessionId);
    }

    @RequestMapping("/history")
    public String requestChatHistory(@RequestParam("sessionId") String sessionId) {
        return relayService.getChatHistory(sessionId).toString();
    }

    protected Path getCsvPath(String fileKey, String sessionId) {
        Path dirPath = Paths.get(tempPath + File.separator + sessionId + File.separator + "dialog");
        Path filePath = dirPath.resolve(fileKey);
        return filePath;
    }
}
