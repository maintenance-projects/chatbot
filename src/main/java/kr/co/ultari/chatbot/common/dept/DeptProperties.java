package kr.co.ultari.chatbot.common.dept;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * 부서(dept) 라우팅 설정.
 * <p>로그인 아이디 → 부서코드 매핑을 설정으로 관리한다(테이블 변경 없이 멀티부서 대응).
 * 향후 JWT 인증 전환 시 부서코드가 토큰에서 추출되면 이 매핑은 제거된다.
 *
 * <pre>
 * ultari.dept.default-dept=dept-a
 * ultari.dept.mapping.alice=dept-a
 * ultari.dept.mapping.bob=dept-b
 * </pre>
 */
@Component
@Getter
@Setter
@ConfigurationProperties(prefix = "ultari.dept")
public class DeptProperties {

    /** 로그인 아이디 → 부서코드 매핑 */
    private Map<String, String> mapping = new HashMap<>();

    /** 매핑에 없는 사용자에게 적용할 기본 부서코드 */
    private String defaultDept = "dept-a";
}
