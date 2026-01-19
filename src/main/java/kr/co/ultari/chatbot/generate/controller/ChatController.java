package kr.co.ultari.chatbot.generate.controller;

import kr.co.ultari.chatbot.config.ChatSessionStore;
import kr.co.ultari.chatbot.generate.datamodel.dto.RequestDTO;
import kr.co.ultari.chatbot.generate.datamodel.dto.ResponseDTO;
import kr.co.ultari.chatbot.generate.datamodel.vo.Message;
import kr.co.ultari.chatbot.generate.service.AIChatService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.File;
import java.io.IOException;
import java.util.List;

@Profile("chat")
@Slf4j
@RestController
@RequestMapping("/api/chat")
public class ChatController {

    @Value("${ultari.ai.summary-size:5}")
    int summarySize;

    private final ChatSessionStore sessionStore;
    private final AIChatService aiService;

    public ChatController(ChatSessionStore sessionStore,
                          AIChatService aiService) {
        this.sessionStore = sessionStore;
        this.aiService = aiService;
    }

    @PostMapping
    public ResponseEntity<?> chat(@RequestBody RequestDTO req) throws Exception {
        log.debug("{}",req.toString());

        List<Message> messages = sessionStore.getMessages(req.getSessionId());

        // 최초 system prompt
        if (messages.isEmpty()) {
            messages.add(new Message(
                    "system",
                    "너는 한국어로만 답변하는 친절한 AI 챗봇이다. 제발 한국어로만 대답하고 중국어는 좀 그만해줘. 제발 한국어만 사용해 주세요."
            ));
        }

        // 요약
        int msgCount = (int) messages.stream()
                .filter(m -> !"system".equals(m.getRole()))
                .count();
        log.debug("messages.'user and assistant'.size()={}",msgCount);
        if(msgCount > summarySize) {
            String summaryMessage = aiService.summarize(messages);
            log.debug(summaryMessage);

            messages.removeIf(msg -> !"system".equals(msg.getRole()));
            //messages.clear();

            messages.add(new Message("system", "이전 대화 요약:"+summaryMessage));
            log.debug("현재 메시지 : "+messages.toString());
            sessionStore.setMessages(req.getSessionId(), messages);
        }

        // 사용자 메시지 추가
        messages.add(new Message("user", req.getMessage()));

        // AI 호출
        String reply = aiService.callAi(messages);

        // AI 응답 저장
        messages.add(new Message("assistant", reply));

        log.debug(messages.toString());
        return ResponseEntity.ok(new ResponseDTO(reply));
    }

    @PostMapping("/upload")
    public ResponseEntity<?> summarizeFile(@RequestParam("file") MultipartFile file, @RequestParam("sessionId") String sessionId) throws Exception {
        log.debug(file.getOriginalFilename());
        ResponseDTO responseDTO = null;
        String fileName = file.getOriginalFilename();
        String ext = fileName.substring(fileName.lastIndexOf(".")+1);
        if(!ext.equalsIgnoreCase("docx") && !ext.equalsIgnoreCase("hwp")
                && !ext.equalsIgnoreCase("hwpx") && !ext.equalsIgnoreCase("pdf")
                && !ext.equalsIgnoreCase("txt")) {
            return ResponseEntity.ok(new ResponseDTO("요약이 불가능한 파일입니다."));
        }
        String text = "";
        if(ext.equalsIgnoreCase("docx"))
            text = aiService.extractTextFromDocx2(file);
        else if(ext.equalsIgnoreCase("hwp")) {
            text = aiService.extractTextFromHwp(file);
        } else if (ext.equalsIgnoreCase("hwpx")) {
            text = aiService.extractTextFromHwpx(file);
        } else if (ext.equalsIgnoreCase("pdf")) {
            text = aiService.extractTextFromPdf(file);
        } else if (ext.equalsIgnoreCase("txt")) {
            text = aiService.extractTextFromTxt(file);

            //텍스트 파일 요약 요청을 효율적으로 하기 위한 전처리.
            text = text.replaceAll("[ \\t]+", " ")
                    .replaceAll("\\n{3,}", "\n\n")
                    .trim();
        }

        if(StringUtils.hasText(text)) {
            List<Message> messages = sessionStore.getMessages(sessionId);
            String summaryText = aiService.summarizeRequest(text);
            responseDTO = new ResponseDTO(summaryText);
            messages.add(new Message("assistant", summaryText));
            sessionStore.setMessages(sessionId, messages);
        }
        else responseDTO = new ResponseDTO("문서를 읽을 수 없습니다.");

        return ResponseEntity.ok(responseDTO);
    }

    public File multipartFileToFile(MultipartFile multipartFile) throws IOException {
        File file = new File(multipartFile.getOriginalFilename());
        multipartFile.transferTo(file);
        return file;
    }

    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chatStream(@RequestBody RequestDTO req) {
        log.info(req.toString());
        return aiService.ChatRelayServiceStream(req);
    }
}
