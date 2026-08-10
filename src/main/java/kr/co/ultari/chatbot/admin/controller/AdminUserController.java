package kr.co.ultari.chatbot.admin.controller;

import kr.co.ultari.chatbot.admin.service.AdminUserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

/**
 * 사용자 부서 관리 API (관리자). 목록/검색/부서지정.
 */
@Slf4j
@Controller
@RequestMapping("/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final AdminUserService userService;

    @PostMapping("/list")
    @ResponseBody
    public String list(@RequestParam("adminId") String adminId) {
        log.debug("[users list] adminId={}", adminId);
        return userService.getUserList().toString();
    }

    @PostMapping("/search")
    @ResponseBody
    public String search(@RequestParam("adminId") String adminId,
                         @RequestParam("field") String field,
                         @RequestParam("keyword") String keyword) {
        log.debug("[users search] adminId={}, field={}, keyword={}", adminId, field, keyword);
        return userService.search(field, keyword).toString();
    }

    @PostMapping("/updateDept")
    @ResponseBody
    public String updateDept(@RequestParam("adminId") String adminId,
                             @RequestParam("userId") String userId,
                             @RequestParam("dept") String dept) {
        log.debug("[users updateDept] adminId={}, userId={}, dept={}", adminId, userId, dept);
        return userService.updateDept(userId, dept);
    }
}
