package kr.co.ultari.chatbot.database.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

/**
 * AI 환경설정(앱 소유 DB). 단일 행(ID=1)으로 관리자 화면에서 설정한다.
 * - temperature: AI 응답 창의성(0~10). ※ 게이트웨이 전송은 API 확정 후 연결(현재는 값 보관).
 * - userPrompt: 사용자(system) 프롬프트. ※ 마찬가지로 현재는 값 보관.
 * - docRetentionDays: 개인문서(업로드 파일) 보관일수. 챗봇 서버 PDF 미리보기 사본 보존 및 사용자 표시에 사용.
 */
@Data
@Entity
@Table(name = "AI_CONFIG")
public class AiConfig {

    /** 단일 행 고정 키(항상 1) */
    @Id
    @Column(name = "CONFIG_ID")
    private Integer configId;

    /** AI 응답 창의성 0~10 */
    @Column(name = "TEMPERATURE")
    private Integer temperature;

    /** 사용자(system) 프롬프트 */
    @Column(name = "USER_PROMPT", columnDefinition = "TEXT")
    private String userPrompt;

    /** 개인문서 보관일수(일) */
    @Column(name = "DOC_RETENTION_DAYS")
    private Integer docRetentionDays;
}
