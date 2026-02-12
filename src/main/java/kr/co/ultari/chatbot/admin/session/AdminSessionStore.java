package kr.co.ultari.chatbot.admin.session;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Component
public class AdminSessionStore {

    @Value("${ultari.admin.session.ttl-seconds:3600}")
    private long ttlSeconds;

    private final Map<String, SessionEntry> store = new ConcurrentHashMap<>();

    public void save(String adminId, AdminSession session) {
        store.put(adminId, new SessionEntry(session, expiresAt(-1)));
    }

    public void save(String adminId, AdminSession session, long customTtlSeconds) {
        store.put(adminId, new SessionEntry(session, expiresAt(customTtlSeconds)));
    }

    public AdminSession get(String adminId) {
        SessionEntry entry = store.get(adminId);
        if (entry == null) return null;
        if (entry.isExpired()) {
            store.remove(adminId);
            return null;
        }
        return entry.session;
    }

    public void remove(String adminId) {
        if (adminId != null) {
            store.remove(adminId);
        }
    }

    public long getDefaultTtlSeconds() {
        return ttlSeconds;
    }

    @Scheduled(fixedDelayString = "${ultari.admin.session.cleanup-ms:60000}")
    public void cleanupExpired() {
        for (Map.Entry<String, SessionEntry> entry : store.entrySet()) {
            if (entry.getValue().isExpired()) {
                store.remove(entry.getKey());
            }
        }
    }

    private long expiresAt(long customTtlSeconds) {
        long effectiveTtl = customTtlSeconds > 0 ? customTtlSeconds : ttlSeconds;
        return System.currentTimeMillis() + TimeUnit.SECONDS.toMillis(effectiveTtl);
    }

    private static class SessionEntry {
        private final AdminSession session;
        private final long expiresAt;

        private SessionEntry(AdminSession session, long expiresAt) {
            this.session = session;
            this.expiresAt = expiresAt;
        }

        private boolean isExpired() {
            return System.currentTimeMillis() > expiresAt;
        }
    }
}
