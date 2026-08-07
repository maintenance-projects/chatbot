package kr.co.ultari.chatbot.common.dept;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * 로그인 아이디로부터 부서코드를 결정한다.
 * 매핑에 없거나 아이디가 없으면 기본 부서코드를 반환한다.
 */
@Component
@RequiredArgsConstructor
public class DeptResolver {

    private final DeptProperties props;

    public String resolve(String userId) {
        if (!StringUtils.hasText(userId)) {
            return props.getDefaultDept();
        }
        return props.getMapping().getOrDefault(userId, props.getDefaultDept());
    }
}
