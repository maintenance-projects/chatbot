package kr.co.ultari.chatbot.attach;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.multipart.MultipartResolver;
import org.springframework.web.multipart.support.StandardServletMultipartResolver;
import org.springframework.web.servlet.DispatcherServlet;

/**
 * 멀티파트 리졸버 커스터마이즈(롤백 안전 토글).
 * <p>{@code ultari.chatbot.attach.lenient-multipart=true} 이면 {@code /chatbot/attach} 요청만
 * 서블릿(Tomcat) 멀티파트 파싱을 <b>건너뛴다</b>(isMultipart=false) → 컨트롤러가 raw 바디를
 * {@link LenientMultipartParser} 로 직접 파싱해 bare LF 멀티파트도 수용.
 * <p>false(기본)면 완전히 표준 {@link StandardServletMultipartResolver} 동작(원복).
 * 다른 모든 경로/엔드포인트는 어떤 값이든 표준 그대로.
 */
@Configuration
public class AttachMultipartConfig {

    static final String ATTACH_URI = "/chatbot/attach";

    @Value("${ultari.chatbot.attach.lenient-multipart:false}")
    private boolean lenient;

    @Bean(name = DispatcherServlet.MULTIPART_RESOLVER_BEAN_NAME)
    public MultipartResolver multipartResolver() {
        return new StandardServletMultipartResolver() {
            @Override
            public boolean isMultipart(HttpServletRequest request) {
                if (lenient && ATTACH_URI.equals(request.getRequestURI())) {
                    return false; // attach 만 서블릿 파싱 skip → 컨트롤러가 raw 파싱
                }
                return super.isMultipart(request);
            }
        };
    }
}
