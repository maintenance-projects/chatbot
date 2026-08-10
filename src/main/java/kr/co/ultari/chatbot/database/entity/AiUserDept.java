package kr.co.ultari.chatbot.database.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

/**
 * 사용자 → AI 부서(dept) 매핑 (앱 소유 DB). 인사DB(msg_user)는 건드리지 않고 여기에 저장한다.
 */
@Data
@Entity
@Table(name = "AI_USER_DEPT")
public class AiUserDept {

    @Id
    @Column(name = "USER_ID", length = 50)
    private String userId;

    /** 게이트웨이 라우팅 부서코드(dept-a/dept-b 등) */
    @Column(name = "AI_DEPT", length = 50)
    private String aiDept;
}
