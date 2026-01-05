package kr.co.ultari.chatbot.generate.controller;

import kr.co.ultari.chatbot.config.ChatSessionStore;
import kr.co.ultari.chatbot.generate.datamodel.dto.RequestDTO;
import kr.co.ultari.chatbot.generate.datamodel.dto.ResponseDTO;
import kr.co.ultari.chatbot.generate.datamodel.vo.Message;
import kr.co.ultari.chatbot.generate.service.QwenChatService;
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
    private final QwenChatService qwenService;

    public ChatController(ChatSessionStore sessionStore,
                          QwenChatService qwenService) {
        this.sessionStore = sessionStore;
        this.qwenService = qwenService;
    }

    @PostMapping
    public ResponseEntity<?> chat(@RequestBody RequestDTO req) throws Exception {
        log.info("{}",req.toString());

        List<Message> messages = sessionStore.getMessages(req.getSessionId());

        log.info(messages.toString());
        // 최초 system prompt
        if (messages.isEmpty()) {
            messages.add(new Message(
                    "system",
                    "너는 한국어로만 답변하는 친절한 AI 챗봇이다."
            ));
        }

        // 사용자 메시지 추가
        messages.add(new Message("user", req.getMessage()));

        // AI 호출
        String reply = qwenService.callQwen(messages);

        // AI 응답 저장
        messages.add(new Message("assistant", reply));

        return ResponseEntity.ok(new ResponseDTO(reply));
    }
}
