package kr.co.ultari.chatbot.common.dept;

import kr.co.ultari.chatbot.database.entity.MsgUser;
import kr.co.ultari.chatbot.database.repository.MsgUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * 사용자 아이디로부터 부서코드를 결정한다.
 * <p>MSG_USER.DEPT 컬럼(관리자 화면에서 지정) 값을 사용하고,
 * 미지정(공백/사용자 없음)이면 기본 부서코드를 반환한다.
 */
@Component
@RequiredArgsConstructor
public class DeptResolver {

    private final DeptProperties props;
    private final MsgUserRepository userRepository;

    public String resolve(String userId) {
        if (!StringUtils.hasText(userId)) {
            return props.getDefaultDept();
        }
        return userRepository.findById(userId)
                .map(MsgUser::getDept)
                .filter(StringUtils::hasText)
                .orElse(props.getDefaultDept());
    }
}
