package kr.co.ultari.chatbot.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * 공통 보안 응답 헤더. HTTP 운영·웹뷰 임베드 환경을 깨지 않는 안전한 헤더만 설정한다.
 * <ul>
 *   <li>{@code X-Content-Type-Options: nosniff} — MIME 스니핑 차단</li>
 *   <li>{@code Referrer-Policy: same-origin} — 외부로 Referer 누출 최소화</li>
 * </ul>
 * ※ 클릭재킹 방지({@code X-Frame-Options}/{@code CSP frame-ancestors})와 쿠키 SameSite는
 *   웹뷰/iframe 임베드(교차 출처)를 깨뜨릴 수 있어, 임베드 구조 확인 후 별도 적용한다.
 */
@Component
public class SecurityHeadersFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("Referrer-Policy", "same-origin");
        chain.doFilter(request, response);
    }
}
