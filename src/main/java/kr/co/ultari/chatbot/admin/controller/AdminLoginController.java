package kr.co.ultari.chatbot.admin.controller;

import kr.co.ultari.chatbot.admin.datamodel.dto.AdminLoginRequest;
import kr.co.ultari.chatbot.admin.service.AdminAuthService;
import kr.co.ultari.chatbot.admin.service.AdminStorageService;
import kr.co.ultari.chatbot.admin.session.AdminSession;
import kr.co.ultari.chatbot.admin.session.AdminSessionStore;
import lombok.extern.slf4j.Slf4j;
import oracle.jrockit.jfr.StringConstantPool;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.util.ObjectUtils;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.util.UUID;

@Slf4j
@Controller
@RequestMapping("/admin")
public class AdminLoginController {

    @Autowired
    AdminSessionStore sessionStore;

    @Autowired
    AdminStorageService storageService;

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
            httpRequest.getSession(true)
                    .setAttribute("sessionId", uuid);
        }

        return ResponseEntity.ok(rtn);
    }

    @PostMapping("/logout")
    public ResponseEntity<String> logout(HttpServletRequest request, @RequestParam("adminId") String adminId) {
        String sessionId = (String) request.getSession().getAttribute("sessionId");
        authService.logout(sessionId);
        return ResponseEntity.ok("ok");
    }

    @RequestMapping("/error")
    public String error() {
        return "admin/error";
    }

    @RequestMapping("/storage")
    public String storageIndex(HttpServletRequest request, Model model, @RequestParam(value="adminId", required = false) String a) {
        String sessionId = (String) request.getSession().getAttribute("sessionId");
        if(!StringUtils.hasText(sessionId)) return "redirect:/admin/error";

        AdminSession session = sessionStore.get(sessionId);
        if(session==null) return "redirect:/admin/error";

        String adminId = session.getAdminId();
        log.debug("[storage index] adminId={}, sessionId={}", adminId, sessionId);

        JSONArray arr = storageService.getCountList(adminId);

        model.addAttribute("adminId",session.getAdminId());
        model.addAttribute("adminName", session.getAdminName());
        model.addAttribute("storage", session.isAuthStorage());
        model.addAttribute("statistics", session.isAuthStatistics());
        model.addAttribute("master",session.isAuthMaster());
        model.addAttribute("countList",arr.toString());

        return "admin/storage";
    }

    @RequestMapping("/statistics")
    public String statisticsIndex(HttpServletRequest request, Model model, @RequestParam(value="adminId", required = false) String a) {
        String sessionId = (String) request.getSession().getAttribute("sessionId");
        if(!StringUtils.hasText(sessionId)) return "redirect:/admin/error";

        AdminSession session = sessionStore.get(sessionId);
        if(session==null) return "admin/error";

        String adminId = session.getAdminId();
        log.debug("[statistics index] adminId={}, sessionId={}", adminId, sessionId);

        model.addAttribute("adminId",session.getAdminId());
        model.addAttribute("adminName", session.getAdminName());
        model.addAttribute("storage", session.isAuthStorage());
        model.addAttribute("statistics", session.isAuthStatistics());
        model.addAttribute("master",session.isAuthMaster());

        return "admin/statistics";
    }

    private String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isEmpty()) {
            return forwarded.split(",")[0];
        }
        return request.getRemoteAddr();
    }


}
