package kr.co.ultari.chatbot.database.repository;

import kr.co.ultari.chatbot.database.entity.MsgAdmin;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MsgAdminRepository extends JpaRepository<MsgAdmin, String> {

    List<MsgAdmin> findByAdminIdContaining(String adminId);

    List<MsgAdmin> findByAdminNameContaining(String adminName);
}
