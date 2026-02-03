package kr.co.ultari.chatbot.config;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import javax.servlet.*;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

@Component
public class AdminMethodFilter implements Filter {

    @Override
    public void doFilter(
            ServletRequest req,
            ServletResponse res,
            FilterChain chain
    ) throws IOException, ServletException {

        HttpServletRequest request = (HttpServletRequest) req;
        HttpServletResponse response = (HttpServletResponse) res;

        /*
        if ((request.getRequestURI().startsWith("/admin/storage") || request.getRequestURI().startsWith("/admin/statistics"))
                && !"POST".equalsIgnoreCase(request.getMethod())) {
            request.setAttribute("status", HttpServletResponse.SC_METHOD_NOT_ALLOWED);
            request.getRequestDispatcher("/admin/error")
                    .forward(request, response);
            return;
        }
        */
        chain.doFilter(req, res);
    }
}
