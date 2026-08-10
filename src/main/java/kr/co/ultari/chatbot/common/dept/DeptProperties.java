package kr.co.ultari.chatbot.common.dept;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * 부서(dept) 라우팅 설정.
 * <p>사용자의 부서는 MSG_USER.DEPT 컬럼(관리자 화면에서 지정)으로 결정한다.
 * 미지정 사용자에게는 {@code defaultDept}를 적용한다.
 *
 * <pre>
 * ultari.dept.default-dept=dept-a
 * ultari.dept.codes=dept-a,dept-b   # 관리자 화면 드롭다운 목록
 * </pre>
 */
@Component
@Getter
@Setter
@ConfigurationProperties(prefix = "ultari.dept")
public class DeptProperties {

    /** 부서 미지정 사용자에게 적용할 기본 부서코드 */
    private String defaultDept = "dept-a";

    /** 관리자 화면 부서 드롭다운에 표시할 부서코드 목록 */
    private List<String> codes = new ArrayList<>();
}
