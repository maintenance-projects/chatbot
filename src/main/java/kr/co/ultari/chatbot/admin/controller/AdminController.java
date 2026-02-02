package kr.co.ultari.chatbot.admin.controller;

import kr.co.ultari.chatbot.admin.datamodel.dto.AdminLoginRequest;
import kr.co.ultari.chatbot.admin.service.AdminAuthService;
import kr.co.ultari.chatbot.admin.session.AdminSession;
import kr.co.ultari.chatbot.admin.session.AdminSessionStore;
import kr.co.ultari.chatbot.database.entity.MsgAdmin;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.kafka.KafkaProperties;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpSession;

@Slf4j
@Controller
@RequestMapping("/admin")
public class AdminController {

    @Autowired
    AdminSessionStore sessionStore;

    private final AdminAuthService authService;

    public AdminController(AdminAuthService authService) {
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

        String clientIp = getClientIp(httpRequest);
        String rtn = authService.login(request.getAdminId(), request.getPassword(), clientIp);

        return ResponseEntity.ok(rtn);
    }

    @PostMapping("/logout")
    public ResponseEntity<String> logout(HttpServletRequest request, @RequestParam("adminId") String adminId) {
        authService.logout(adminId);
        return ResponseEntity.ok("ok");
    }

    @RequestMapping("/error")
    public String error() {
        return "admin/error";
    }

    @PostMapping("/storage")
    public String storageIndex(@RequestParam("adminId") String adminId, Model model) {
        AdminSession session = sessionStore.get(adminId);
        if(session==null) return "error";

        model.addAttribute("adminId",session.getAdminId());
        model.addAttribute("adminName", session.getAdminName());
        model.addAttribute("storage", session.isAuthStorage());
        model.addAttribute("statistics", session.isAuthStatistics());
        model.addAttribute("master",session.isAuthMaster());

        return "admin/storage";
    }

    @PostMapping("/statistics")
    public String statisticsIndex(@RequestParam("adminId") String adminId, Model model) {
        AdminSession session = sessionStore.get(adminId);
        if(session==null) return "error";

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
