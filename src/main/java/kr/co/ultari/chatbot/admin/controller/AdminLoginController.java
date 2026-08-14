package kr.co.ultari.chatbot.admin.controller;

import kr.co.ultari.chatbot.admin.datamodel.dto.AdminLoginRequest;
import kr.co.ultari.chatbot.admin.service.AdminAuthService;
import kr.co.ultari.chatbot.admin.session.AdminSession;
import kr.co.ultari.chatbot.admin.session.AdminSessionStore;
import kr.co.ultari.chatbot.common.dept.DeptProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.util.ObjectUtils;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;
import java.util.UUID;

@Slf4j
@Controller
@RequestMapping("/at-i")
public class AdminLoginController {

    @Autowired
    AdminSessionStore sessionStore;

    @Autowired
    DeptProperties deptProperties;

    @Autowired
    kr.co.ultari.chatbot.common.dept.DeptLabelService deptLabelService;

    /** 통계 화면의 '통화요약' 표시 여부(미사용 납품처 대비). 기본 노출. */
    @org.springframework.beans.factory.annotation.Value("${ultari.statistics.audio-enabled:true}")
    boolean statsAudioEnabled;

    private final AdminAuthService authService;

    public AdminLoginController(AdminAuthService authService) {
        this.authService = authService;
    }

    @RequestMapping("")
    public String Login() {

        return "admin/login";
    }

    @PostMapping("/login")
    public ResponseEntity<String> login(
            @RequestBody AdminLoginRequest request,
            HttpServletRequest httpRequest
    ) {

        String uuid = UUID.randomUUID().toString();
        String clientIp = getClientIp(httpRequest);
        String rtn = authService.login(request.getAdminId(), request.getPassword(), clientIp, uuid);
        if ("ok".equals(rtn)) {
            long ttlSeconds = request.isRememberMe()
                    ? TimeUnit.HOURS.toSeconds(10)
                    : -1;
            AdminSession session = sessionStore.get(uuid);
            if (session != null) {
                sessionStore.save(uuid, session, ttlSeconds);
            }
            long effectiveTtl = ttlSeconds > 0 ? ttlSeconds : sessionStore.getDefaultTtlSeconds();
            jakarta.servlet.http.HttpSession httpSession = httpRequest.getSession(true);
            httpSession.setAttribute("sessionId", uuid);
            // HttpSession 수명을 관리자 세션 TTL과 정렬 — 기본 30분에 먼저 만료돼 타이머(1시간)와
            // 어긋나던 문제 방지. 이후 요청마다 슬라이딩 갱신된다.
            httpSession.setMaxInactiveInterval((int) effectiveTtl);
            log.info("[admin login] adminId={}, rememberMe={}, sessionTtlSeconds={}",
                    request.getAdminId(), request.isRememberMe(), effectiveTtl);
        }

        return ResponseEntity.ok(rtn);
    }

    @PostMapping("/changePassword")
    @ResponseBody
    public String changePassword(HttpServletRequest request,
                                 @RequestParam("adminId") String adminId,
                                 @RequestParam("currentPassword") String currentPassword,
                                 @RequestParam("newPassword") String newPassword) {
        String sessionId = (String) request.getSession().getAttribute("sessionId");
        if (sessionId == null || sessionStore.get(sessionId) == null) return "NoSession";
        return authService.changePassword(adminId, currentPassword, newPassword);
    }

    @PostMapping("/logout")
    public ResponseEntity<String> logout(HttpServletRequest request, @RequestParam("adminId") String adminId) {
        String sessionId = (String) request.getSession().getAttribute("sessionId");
        if (sessionId != null) {
            authService.logout(sessionId);
        }
        return ResponseEntity.ok("ok");
    }

    @PostMapping("/session/refresh")
    @ResponseBody
    public ResponseEntity<String> refreshSession(HttpServletRequest request) {
        String sessionId = (String) request.getSession().getAttribute("sessionId");
        if (!StringUtils.hasText(sessionId)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("NoSession");
        }
        AdminSession session = sessionStore.get(sessionId);
        if (session == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("NoSession");
        }
        long remainingSeconds = sessionStore.refresh(sessionId);
        return ResponseEntity.ok(String.valueOf(remainingSeconds));
    }

    @RequestMapping("/error")
    public String error() {
        return "admin/error";
    }

    @RequestMapping("/storage")
    public String storageIndex(HttpServletRequest request, Model model, @RequestParam(value="adminId", required = false) String a) {
        String sessionId = (String) request.getSession().getAttribute("sessionId");
        if(!StringUtils.hasText(sessionId)) return buildSessionExpiredRedirect();

        AdminSession session = sessionStore.get(sessionId);
        if(session==null) return buildSessionExpiredRedirect();

        String adminId = session.getAdminId();
        log.debug("[storage index] adminId={}, sessionId={}", adminId, sessionId);

        // 문서 카운트는 렌더 경로에서 제거하고 프론트에서 비동기(/admin/storage/count)로 로딩한다.
        // (AI 게이트웨이 지연이 로그인 직후 화면 전환을 막던 병목 제거)
        model.addAttribute("adminId",session.getAdminId());
        model.addAttribute("adminName", session.getAdminName());
        model.addAttribute("storage", session.isAuthStorage());
        model.addAttribute("statistics", session.isAuthStatistics());
        model.addAttribute("master",session.isAuthMaster());
        model.addAttribute("partition", session.isAuthPartition());
        model.addAttribute("sessionRemainingSeconds", sessionStore.refresh(sessionId)); // 활동(페이지 이동) 시 세션 연장
        model.addAttribute("deptCodes", deptProperties.getCodes());
        model.addAttribute("deptLabels", deptLabelService.labels());

        return "admin/storage";
    }

    @RequestMapping("/statistics")
    public String statisticsIndex(HttpServletRequest request, Model model, @RequestParam(value="adminId", required = false) String a) {
        String sessionId = (String) request.getSession().getAttribute("sessionId");
        if(!StringUtils.hasText(sessionId)) return buildSessionExpiredRedirect();

        AdminSession session = sessionStore.get(sessionId);
        if(session==null) return buildSessionExpiredRedirect();

        String adminId = session.getAdminId();
        log.debug("[statistics index] adminId={}, sessionId={}", adminId, sessionId);

        model.addAttribute("adminId",session.getAdminId());
        model.addAttribute("adminName", session.getAdminName());
        model.addAttribute("storage", session.isAuthStorage());
        model.addAttribute("statistics", session.isAuthStatistics());
        model.addAttribute("master",session.isAuthMaster());
        model.addAttribute("partition", session.isAuthPartition());
        model.addAttribute("sessionRemainingSeconds", sessionStore.refresh(sessionId)); // 활동(페이지 이동) 시 세션 연장
        model.addAttribute("audioEnabled", statsAudioEnabled);

        return "admin/statistics";
    }

    @RequestMapping("/master")
    public String masterIndex(HttpServletRequest request, Model model, @RequestParam(value="adminId", required = false) String a) {
        String sessionId = (String) request.getSession().getAttribute("sessionId");
        if(!StringUtils.hasText(sessionId)) return buildSessionExpiredRedirect();

        AdminSession session = sessionStore.get(sessionId);
        if(session==null) return buildSessionExpiredRedirect();

        String adminId = session.getAdminId();
        log.debug("[master index] adminId={}, sessionId={}", adminId, sessionId);

        model.addAttribute("adminId",session.getAdminId());
        model.addAttribute("adminName", session.getAdminName());
        model.addAttribute("storage", session.isAuthStorage());
        model.addAttribute("statistics", session.isAuthStatistics());
        model.addAttribute("master",session.isAuthMaster());
        model.addAttribute("partition", session.isAuthPartition());
        model.addAttribute("sessionRemainingSeconds", sessionStore.refresh(sessionId)); // 활동(페이지 이동) 시 세션 연장

        return "admin/master";
    }

    @RequestMapping("/guide")
    public String guideIndex(HttpServletRequest request, Model model, @RequestParam(value="adminId", required = false) String a) {
        String sessionId = (String) request.getSession().getAttribute("sessionId");
        if(!StringUtils.hasText(sessionId)) return buildSessionExpiredRedirect();

        AdminSession session = sessionStore.get(sessionId);
        if(session==null) return buildSessionExpiredRedirect();

        String adminId = session.getAdminId();
        log.debug("[guide index] adminId={}, sessionId={}", adminId, sessionId);

        model.addAttribute("adminId",session.getAdminId());
        model.addAttribute("adminName", session.getAdminName());
        model.addAttribute("storage", session.isAuthStorage());
        model.addAttribute("statistics", session.isAuthStatistics());
        model.addAttribute("master",session.isAuthMaster());
        model.addAttribute("partition", session.isAuthPartition());
        model.addAttribute("sessionRemainingSeconds", sessionStore.refresh(sessionId)); // 활동(페이지 이동) 시 세션 연장

        return "admin/guide";
    }

    @RequestMapping("/users")
    public String usersIndex(HttpServletRequest request, Model model) {
        String sessionId = (String) request.getSession().getAttribute("sessionId");
        if(!StringUtils.hasText(sessionId)) return buildSessionExpiredRedirect();

        AdminSession session = sessionStore.get(sessionId);
        if(session==null) return buildSessionExpiredRedirect();

        log.debug("[users index] adminId={}, sessionId={}", session.getAdminId(), sessionId);

        model.addAttribute("adminId", session.getAdminId());
        model.addAttribute("adminName", session.getAdminName());
        model.addAttribute("storage", session.isAuthStorage());
        model.addAttribute("statistics", session.isAuthStatistics());
        model.addAttribute("master", session.isAuthMaster());
        model.addAttribute("partition", session.isAuthPartition());
        model.addAttribute("sessionRemainingSeconds", sessionStore.refresh(sessionId)); // 활동(페이지 이동) 시 세션 연장
        model.addAttribute("deptCodes", deptProperties.getCodes());
        model.addAttribute("deptLabels", deptLabelService.labels());

        return "admin/users";
    }

    private String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isEmpty()) {
            return forwarded.split(",")[0];
        }
        return request.getRemoteAddr();
    }

    private String buildSessionExpiredRedirect() {
        String message;
        try {
            message = URLEncoder.encode("세션이 만료되었습니다. 다시 로그인해 주세요.", StandardCharsets.UTF_8.name());
        } catch (java.io.UnsupportedEncodingException e) {
            throw new IllegalStateException("UTF-8 encoding not supported", e);
        }
        return "redirect:/at-i/error?code=401&message=" + message;
    }


}
