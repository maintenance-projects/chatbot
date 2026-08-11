package kr.co.ultari.chatbot.generate;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 챗봇 하단 도구 메뉴 노출 제어(서버 환경설정 전용, 관리자 UI 없음).
 * <pre>
 * ultari.chatbot.menu.upload=true      # 문서 업로드
 * ultari.chatbot.menu.docs=true        # 개인 문서함
 * ultari.chatbot.menu.template=true    # 양식 선택
 * ultari.chatbot.menu.translate=true   # 번역
 * </pre>
 * 미설정 시 전부 노출(true). {@code false}면 해당 버튼을 렌더에서 제외한다.
 */
@Component
@Getter
@Setter
@ConfigurationProperties(prefix = "ultari.chatbot.menu")
public class ChatbotMenuProperties {

    /** 문서 업로드 버튼 노출 */
    private boolean upload = true;

    /** 개인 문서함 버튼 노출 */
    private boolean docs = true;

    /** 양식 선택 버튼 노출 */
    private boolean template = true;

    /** 번역 버튼 노출 */
    private boolean translate = true;
}
