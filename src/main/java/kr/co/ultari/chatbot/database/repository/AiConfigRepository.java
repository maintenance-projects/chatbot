package kr.co.ultari.chatbot.database.repository;

import kr.co.ultari.chatbot.database.entity.AiConfig;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiConfigRepository extends JpaRepository<AiConfig, Integer> {
}
