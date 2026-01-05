package kr.co.ultari.chatbot.generate.controller;

import kr.co.ultari.chatbot.config.ChatSessionStore;
import kr.co.ultari.chatbot.generate.datamodel.dto.RequestDTO;
import kr.co.ultari.chatbot.generate.datamodel.dto.ResponseDTO;
import kr.co.ultari.chatbot.generate.datamodel.vo.Message;
import kr.co.ultari.chatbot.generate.service.AIChatService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/chat")
public class ChatController {
    private final ChatSessionStore sessionStore;
    private final AIChatService aiService;

    public ChatController(ChatSessionStore sessionStore,
                          AIChatService aiService) {
        this.sessionStore = sessionStore;
        this.aiService = aiService;
    }

    @PostMapping
    public ResponseEntity<?> chat(@RequestBody RequestDTO req) throws Exception {
        log.info("{}",req.toString());

        List<Message> messages = sessionStore.getMessages(req.getSessionId());

        // 최초 system prompt
        if (messages.isEmpty()) {
            messages.add(new Message(
                    "system",
                    "너는 한국어로만 답변하는 친절한 AI 챗봇이다. 제발 한국어로만 대답하고 중국만 좀 그만해줘."
            ));
        }

        // 요약
        int userCount = (int) messages.stream()
                .filter(m -> "user".equals(m.getRole()))
                .count();
        log.info("messages.'user'.size()={}",userCount);
        if(userCount > 20) {
            String summaryMessage = aiService.summarize(messages);
            log.info(summaryMessage);

            messages.removeIf(msg -> !"system".equals(msg.getRole()));
            //messages.clear();

            messages.add(new Message("system", "이전 대화 요약:"+summaryMessage));
            log.info(messages.toString());
            sessionStore.setMessages(req.getSessionId(), messages);
        }

        // 사용자 메시지 추가
        messages.add(new Message("user", req.getMessage()));

        // AI 호출
        String reply = aiService.callAi(messages);

        // AI 응답 저장
        messages.add(new Message("assistant", reply));

        log.info(messages.toString());
        return ResponseEntity.ok(new ResponseDTO(reply));
    }
}
