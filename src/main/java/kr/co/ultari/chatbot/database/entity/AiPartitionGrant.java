package kr.co.ultari.chatbot.database.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.Data;

/**
 * AI 파티션(벡터DB 하위) 접근 권한 부여 (앱 소유 DB).
 * 벡터DB 접근 권한({@link AiDeptGrant})과 별개 축으로, 벡터DB 안의 특정 파티션 단위 접근을 제어한다.
 * <p>기본 폐쇄: 파티션 grant가 명시된 대상만 해당 파티션에 접근한다(2차 질의 연동 시 적용).
 * 조직(PART) 부여는 하위에 상속, 사용자(USER) DENY로 예외 제외 — 벡터DB 권한과 동일한 해석 규칙.
 */
@Data
@Entity
@Table(name = "AI_PARTITION_GRANT")
@IdClass(AiPartitionGrantId.class)
public class AiPartitionGrant {

    /** 대상 유형: PART(조직) | USER(사용자) */
    @Id
    @Column(name = "TARGET_TYPE", length = 10)
    private String targetType;

    /** 대상 식별자: PART_ID 또는 USER_ID */
    @Id
    @Column(name = "TARGET_ID", length = 100)
    private String targetId;

    /** 벡터DB 코드(dept-a/dept-b 등) */
    @Id
    @Column(name = "AI_DEPT", length = 50)
    private String aiDept;

    /** 파티션 식별자(게이트웨이 채번 name, 예: documents_1) */
    @Id
    @Column(name = "PARTITION_NAME", length = 100)
    private String partitionName;

    /** ALLOW(부여) | DENY(사용자 예외 제외) */
    @Column(name = "GRANT_MODE", length = 10)
    private String mode;

    public static final String TYPE_PART = "PART";
    public static final String TYPE_USER = "USER";
    public static final String MODE_ALLOW = "ALLOW";
    public static final String MODE_DENY = "DENY";
}
