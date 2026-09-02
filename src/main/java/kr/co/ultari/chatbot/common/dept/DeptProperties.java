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

    /**
     * 조직도 부모맵(msg_part) 캐시 TTL(초). 챗봇 진입/요청마다 인사DB 전체조회를 피하기 위한 캐시.
     * 조직도는 자주 안 바뀌므로 짧은 TTL로 충분. {@code 0 이하}면 캐시 비활성(매번 조회, 구버전 동작).
     */
    private long partCacheTtlSeconds = 300;

    /**
     * dept 접근권한(allowedDepts) 캐시 TTL(초). 요청마다 인사DB(msg_user)+앱DB(AI_DEPT_GRANT)를
     * 재조회하던 것을 사용자별로 캐시. 권한은 자주 안 바뀌고 관리자 저장 시 즉시 무효화하므로
     * 짧은 TTL로 충분. {@code 0 이하}면 캐시 비활성(매번 조회).
     */
    private long grantCacheTtlSeconds = 300;
}
