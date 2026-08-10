package kr.co.ultari.chatbot.common.dept;

import kr.co.ultari.chatbot.database.entity.AiUserDept;
import kr.co.ultari.chatbot.database.repository.AiUserDeptRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * 사용자 아이디로부터 부서코드를 결정한다.
 * <p>앱 소유 매핑 테이블 AI_USER_DEPT(관리자 화면에서 지정) 값을 사용하고,
 * 미지정(공백/매핑 없음)이면 기본 부서코드를 반환한다. 인사DB는 조회하지 않는다.
 */
@Component
@RequiredArgsConstructor
public class DeptResolver {

    private final DeptProperties props;
    private final AiUserDeptRepository deptRepository;

    public String resolve(String userId) {
        if (!StringUtils.hasText(userId)) {
            return props.getDefaultDept();
        }
        return deptRepository.findById(userId)
                .map(AiUserDept::getAiDept)
                .filter(StringUtils::hasText)
                .orElse(props.getDefaultDept());
    }
}
