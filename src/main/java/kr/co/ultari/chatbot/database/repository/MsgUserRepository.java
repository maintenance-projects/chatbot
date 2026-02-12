package kr.co.ultari.chatbot.database.repository;

import kr.co.ultari.chatbot.database.entity.MsgUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MsgUserRepository extends JpaRepository<MsgUser, String> {
}
