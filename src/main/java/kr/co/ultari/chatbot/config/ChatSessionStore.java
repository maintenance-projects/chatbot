package kr.co.ultari.chatbot.config;

import kr.co.ultari.chatbot.generate.datamodel.vo.Message;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ChatSessionStore {
    private final Map<String, List<Message>> sessions = new ConcurrentHashMap<>();

    public List<Message> getMessages(String sessionId) {
        return sessions.computeIfAbsent(sessionId, id -> new ArrayList<>());
    }
}
