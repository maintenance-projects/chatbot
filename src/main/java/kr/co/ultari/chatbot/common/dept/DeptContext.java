package kr.co.ultari.chatbot.common.dept;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 현재 요청/세션 기준으로 부서코드를 얻는 진입점.
 * <p>모든 게이트웨이 URL 조립은 이 결과를 사용한다. JWT 인증으로 전환되면
 * {@link #resolve(HttpServletRequest)} 내부만 토큰 추출로 교체하면 된다.
 */
@Component
@RequiredArgsConstructor
public class DeptContext {

    /** 챗봇 로그인 시 세션에 저장되는 사용자 아이디 키 (GenerateController와 동일) */
    public static final String SESSION_USER_ID = "chatbotUserId";

    private final DeptResolver resolver;

    /** 세션의 로그인 아이디로 부서코드를 결정한다. */
    public String resolve(HttpServletRequest request) {
        Object userId = request.getSession().getAttribute(SESSION_USER_ID);
        return resolver.resolve(userId == null ? null : userId.toString());
    }

    /** 아이디를 직접 아는 경우(관리자 등) 부서코드를 결정한다. */
    public String resolveByUserId(String userId) {
        return resolver.resolve(userId);
    }
}
