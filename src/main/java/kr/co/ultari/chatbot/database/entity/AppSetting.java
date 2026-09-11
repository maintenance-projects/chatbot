package kr.co.ultari.chatbot.database.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

/**
 * 앱 로컬 설정 키-값 저장소(앱 소유 DB). 게이트웨이에 없는 로컬 전용 설정을 관리자 화면에서 지정한다.
 * 예: 개인문서 업로드 개수 제한(personal.doc.max-count).
 */
@Data
@Entity
@Table(name = "APP_SETTING")
public class AppSetting {

    /** 설정 키(예: personal.doc.max-count) */
    @Id
    @Column(name = "SETTING_KEY", length = 100)
    private String settingKey;

    /** 설정 값(문자열 보관, 사용처에서 형변환) */
    @Column(name = "SETTING_VALUE", length = 500)
    private String settingValue;
}
