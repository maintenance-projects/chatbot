package kr.co.ultari.chatbot.database.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.Data;

/**
 * AI 콜렉션(dept 하위 partition) 접근 권한 부여 (앱 소유 DB).
 * dept 접근 권한({@link AiDeptGrant})과 별개 축으로, dept 안의 특정 콜렉션 단위 접근을 제어한다.
 * <p>기본 폐쇄: 콜렉션 grant가 명시된 대상만 해당 콜렉션에 접근한다(2차 질의 연동 시 적용).
 * 조직(PART) 부여는 하위에 상속, 사용자(USER) DENY로 예외 제외 — dept 권한과 동일한 해석 규칙.
 */
@Data
@Entity
@Table(name = "AI_COLLECTION_GRANT")
@IdClass(AiCollectionGrantId.class)
public class AiCollectionGrant {

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

    /** 콜렉션 식별자(게이트웨이 채번 name, 예: documents_1) */
    @Id
    @Column(name = "COLLECTION_NAME", length = 100)
    private String collectionName;

    /** ALLOW(부여) | DENY(사용자 예외 제외) */
    @Column(name = "GRANT_MODE", length = 10)
    private String mode;

    public static final String TYPE_PART = "PART";
    public static final String TYPE_USER = "USER";
    public static final String MODE_ALLOW = "ALLOW";
    public static final String MODE_DENY = "DENY";
}
