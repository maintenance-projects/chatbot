package kr.co.ultari.chatbot.database.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

/**
 * AI 부서(dept) 표시 명칭 (앱 소유 DB).
 * dept 코드(dept-a 등)에 대응하는 사용자 노출용 명칭을 관리자 화면에서 지정한다.
 * 미지정 코드는 코드 자체를 명칭으로 사용한다.
 */
@Data
@Entity
@Table(name = "AI_DEPT_LABEL")
public class AiDeptLabel {

    /** 부서코드(dept-a/dept-b 등) */
    @Id
    @Column(name = "DEPT_CODE", length = 50)
    private String deptCode;

    /** 사용자 노출용 명칭 */
    @Column(name = "LABEL", length = 100)
    private String label;
}
