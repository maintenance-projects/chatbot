package kr.co.ultari.chatbot.database.repository;

import kr.co.ultari.chatbot.database.entity.AiUsageLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface AiUsageLogRepository extends JpaRepository<AiUsageLog, Long> {

    Optional<AiUsageLog> findByUserIdAndRequestTypeAndRequestDateAndRequestHour(
            String userId,
            String requestType,
            LocalDate requestDate,
            int requestHour
    );
}
