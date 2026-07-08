package kr.co.ultari.chatbot.database.entity;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "ai_usage_log",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_ai_usage",
                        columnNames = {"user_id", "request_type", "request_date"}
                )
        }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AiUsageLog {

    @Id
    @Column(name = "log_id", nullable = false, length = 50)
    private String log_id;

    @Column(name = "user_id", nullable = false, length = 50)
    private String userId;

    @Column(name = "session_id", length = 100)
    private String sessionId;

    @Column(name = "request_type", nullable = false, length = 20)
    private String requestType; // CHAT, DOCUMENT

    @Column(name = "request_date", nullable = false)
    private LocalDate requestDate;

    @Column(name = "request_hour", nullable = false)
    private int requestHour; // 0 ~ 23

    @Column(name = "request_count", nullable = false)
    private int requestCount;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /* ===== 생성 메서드 ===== */
    public static AiUsageLog create(String userId, String sessionId, String requestType) {
        AiUsageLog log = new AiUsageLog();
        log.log_id = UUID.randomUUID().toString();
        log.userId = userId;
        log.sessionId = sessionId;
        log.requestType = requestType;
        log.requestDate = LocalDate.now();
        log.requestHour = LocalDateTime.now().getHour();
        log.requestCount = 1;
        log.createdAt = LocalDateTime.now();
        log.updatedAt = LocalDateTime.now();
        return log;
    }

    /* ===== 카운트 증가 ===== */
    public void increase() {
        this.requestCount++;
        this.updatedAt = LocalDateTime.now();
    }
}
