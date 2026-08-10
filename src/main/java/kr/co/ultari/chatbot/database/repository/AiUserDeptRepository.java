package kr.co.ultari.chatbot.database.repository;

import kr.co.ultari.chatbot.database.entity.AiUserDept;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AiUserDeptRepository extends JpaRepository<AiUserDept, String> {
}
