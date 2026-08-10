package kr.co.ultari.chatbot.database.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.Data;

/**
 * AI 부서(dept) 접근 권한 부여 (앱 소유 DB).
 * 조직(PART) 또는 사용자(USER) 대상에 dept를 부여(ALLOW)하거나, 상속된 권한에서 제외(DENY)한다.
 * 한 대상이 여러 dept를 가질 수 있다(복합 PK로 중복 허용). 인사DB는 건드리지 않는다.
 */
@Data
@Entity
@Table(name = "AI_DEPT_GRANT")
@IdClass(AiDeptGrantId.class)
public class AiDeptGrant {

    /** 대상 유형: PART(조직) | USER(사용자) */
    @Id
    @Column(name = "TARGET_TYPE", length = 10)
    private String targetType;

    /** 대상 식별자: PART_ID 또는 USER_ID */
    @Id
    @Column(name = "TARGET_ID", length = 100)
    private String targetId;

    /** 부서코드(dept-a/dept-b 등) */
    @Id
    @Column(name = "AI_DEPT", length = 50)
    private String aiDept;

    /** ALLOW(부여) | DENY(사용자 예외 제외) */
    @Column(name = "GRANT_MODE", length = 10)
    private String mode;

    public static final String TYPE_PART = "PART";
    public static final String TYPE_USER = "USER";
    public static final String MODE_ALLOW = "ALLOW";
    public static final String MODE_DENY = "DENY";
}
