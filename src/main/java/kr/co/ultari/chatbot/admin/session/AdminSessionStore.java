package kr.co.ultari.chatbot.admin.session;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Component
public class AdminSessionStore {

    @Value("${ultari.admin.session.ttl-seconds:330}")
    private long ttlSeconds;

    private final Map<String, SessionEntry> store = new ConcurrentHashMap<>();

    public void save(String adminId, AdminSession session) {
        long ttl = effectiveTtlSeconds(-1);
        store.put(adminId, new SessionEntry(session, expiresAt(ttl), ttl));
    }

    public void save(String adminId, AdminSession session, long customTtlSeconds) {
        long ttl = effectiveTtlSeconds(customTtlSeconds);
        store.put(adminId, new SessionEntry(session, expiresAt(ttl), ttl));
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

    public long getRemainingSeconds(String adminId) {
        SessionEntry entry = store.get(adminId);
        if (entry == null) return 0;
        if (entry.isExpired()) {
            store.remove(adminId);
            return 0;
        }
        return entry.remainingSeconds();
    }

    public long refresh(String adminId) {
        SessionEntry entry = store.get(adminId);
        if (entry == null) return 0;
        if (entry.isExpired()) {
            store.remove(adminId);
            return 0;
        }
        entry.refresh();
        return entry.remainingSeconds();
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

    private long effectiveTtlSeconds(long customTtlSeconds) {
        return customTtlSeconds > 0 ? customTtlSeconds : ttlSeconds;
    }

    private long expiresAt(long ttlSeconds) {
        return System.currentTimeMillis() + TimeUnit.SECONDS.toMillis(ttlSeconds);
    }

    private static class SessionEntry {
        private final AdminSession session;
        private final long ttlSeconds;
        private volatile long expiresAt;

        private SessionEntry(AdminSession session, long expiresAt, long ttlSeconds) {
            this.session = session;
            this.expiresAt = expiresAt;
            this.ttlSeconds = ttlSeconds;
        }

        private boolean isExpired() {
            return System.currentTimeMillis() > expiresAt;
        }

        private long remainingSeconds() {
            long remainingMillis = expiresAt - System.currentTimeMillis();
            return Math.max(0, TimeUnit.MILLISECONDS.toSeconds(remainingMillis));
        }

        private void refresh() {
            this.expiresAt = System.currentTimeMillis() + TimeUnit.SECONDS.toMillis(ttlSeconds);
        }
    }
}
