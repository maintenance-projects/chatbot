package kr.co.ultari.chatbot.admin.session;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class AdminSessionStore {

    private static final long TTL_SECONDS = 300; // 5분
    private final Map<String, AdminSession> store = new ConcurrentHashMap<>();

    public void save(String adminId, AdminSession session) {
        store.put(adminId, session);
    }

    public AdminSession get(String adminId) {
        AdminSession session = store.get(adminId);
        if (session == null) return null;

        return session;
    }

    public void remove(String adminId) {
        store.remove(adminId);
    }
}
