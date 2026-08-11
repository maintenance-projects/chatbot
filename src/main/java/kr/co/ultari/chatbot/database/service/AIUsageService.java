package kr.co.ultari.chatbot.database.service;

import kr.co.ultari.chatbot.database.entity.AiUsageLog;
import kr.co.ultari.chatbot.database.repository.AiUsageLogRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Slf4j
@Service
public class AIUsageService {
    @Autowired
    AiUsageLogRepository repository;

    /**
     * (user, type, 오늘, 현재 시(hour)) 사용량을 +1.
     * <p>동시 요청 경합에 안전하도록 <b>원자적 UPDATE 우선</b> → 행이 없으면 INSERT →
     * 그 사이 다른 요청이 먼저 INSERT해 중복키가 나면 다시 UPDATE로 흡수한다.
     * <p>OSIV 비활성이라 각 repository 호출은 독립 트랜잭션이므로 INSERT 실패가 후속 UPDATE를
     * 오염시키지 않는다. 또한 사용량 집계 실패가 대화/문서 처리를 막지 않도록 예외는 무시(로그만)한다.
     */
    public void increase(String userId, String sessionId, String type) {
        LocalDate today = LocalDate.now();
        int hour = LocalDateTime.now().getHour();
        try {
            // 1) 이미 있으면 원자적으로 +1
            if (repository.incrementCount(userId, type, today, hour) > 0) return;
            // 2) 없으면 신규 생성. 동시 요청 경합으로 중복키가 나면 다시 +1로 흡수.
            try {
                repository.save(AiUsageLog.create(userId, sessionId, type));
            } catch (DataIntegrityViolationException race) {
                repository.incrementCount(userId, type, today, hour);
            }
        } catch (Exception e) {
            log.warn("ai_usage_log 증가 실패(무시): user={}, type={}, msg={}", userId, type, e.getMessage());
        }
    }
}
