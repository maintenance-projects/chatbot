package kr.co.ultari.chatbot.database.repository;

import kr.co.ultari.chatbot.database.entity.AiDeptLabel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AiDeptLabelRepository extends JpaRepository<AiDeptLabel, String> {
}
