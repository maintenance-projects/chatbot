package kr.co.ultari.chatbot.common.dept;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * 현재 요청/세션 기준으로 부서(dept)를 결정하는 진입점.
 * <p>사용자가 여러 dept에 접근 가능하면 세션에 '선택된 dept'를 보관하고, 요청마다 그 값을
 * 허용 여부와 함께 검증해 라우팅한다(허용 아니면 단일이면 자동, 그 외 default-dept).
 */
@Component
@RequiredArgsConstructor
public class DeptContext {

    /** 챗봇 로그인 시 세션에 저장되는 사용자 아이디 키 (GenerateController와 동일) */
    public static final String SESSION_USER_ID = "chatbotUserId";
    /** 사용자가 선택한 dept를 세션에 보관하는 키 */
    public static final String SESSION_SELECTED_DEPT = "selectedDept";

    private final DeptResolver resolver;

    /** 세션 사용자 + 선택된 dept로 라우팅 부서를 결정한다. */
    public String resolve(HttpServletRequest request) {
        return resolver.resolve(sessionUserId(request), selectedDept(request));
    }

    /** ownerId 등 명시 사용자 기준 + 세션 선택 dept로 결정한다(PKB). */
    public String resolveForUser(String userId, HttpServletRequest request) {
        return resolver.resolve(userId, selectedDept(request));
    }

    /** 세션 사용자가 접근 가능한 dept 집합. */
    public Set<String> allowed(HttpServletRequest request) {
        return resolver.allowedDepts(sessionUserId(request));
    }

    /** dept 선택. 세션 사용자에게 허용된 dept면 세션에 저장하고 true. */
    public boolean select(HttpServletRequest request, String dept) {
        if (resolver.isAllowed(sessionUserId(request), dept)) {
            request.getSession().setAttribute(SESSION_SELECTED_DEPT, dept);
            return true;
        }
        return false;
    }

    private String sessionUserId(HttpServletRequest request) {
        Object v = request.getSession().getAttribute(SESSION_USER_ID);
        return v == null ? null : v.toString();
    }

    private String selectedDept(HttpServletRequest request) {
        Object v = request.getSession().getAttribute(SESSION_SELECTED_DEPT);
        return v == null ? null : v.toString();
    }
}
