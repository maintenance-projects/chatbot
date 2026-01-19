package kr.co.ultari.chatbot.database.service;

import kr.co.ultari.chatbot.database.entity.AiUsageLog;
import kr.co.ultari.chatbot.database.repository.AiUsageLogRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

@Slf4j
@Service
public class AIUsageService {
    @Autowired
    AiUsageLogRepository repository;

    @Transactional
    public void increase(String userId, String sessionId, String type) {
        LocalDate today = LocalDate.now();
        int hour = LocalDateTime.now().getHour();

        Optional<AiUsageLog> opt =
                repository.findByUserIdAndRequestTypeAndRequestDateAndRequestHour(userId, type, today, hour);

        if (opt.isPresent()) {
            opt.get().increase();
        } else {
            repository.save(
                    AiUsageLog.create(userId, sessionId, type)
            );
        }
    }
}
