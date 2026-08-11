package kr.co.ultari.chatbot.admin.controller;

import kr.co.ultari.chatbot.admin.service.AdminUserService;
import kr.co.ultari.chatbot.common.dept.DeptLabelService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

/**
 * 사용자 부서 관리 API (관리자). 조직도 트리 조회 + dept별 접근 권한 부여.
 */
@Slf4j
@Controller
@RequestMapping("/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final AdminUserService userService;
    private final DeptLabelService labelService;

    /** 조직도 트리 + 특정 dept 부여 상태 */
    @PostMapping("/tree")
    @ResponseBody
    public String tree(@RequestParam("adminId") String adminId,
                       @RequestParam("dept") String dept) {
        log.debug("[users tree] adminId={}, dept={}", adminId, dept);
        return userService.tree(dept).toString();
    }

    /** 권한 부여 적용 (action: ALLOW | DENY | REMOVE) */
    @PostMapping("/grant")
    @ResponseBody
    public String grant(@RequestParam("adminId") String adminId,
                        @RequestParam("dept") String dept,
                        @RequestParam("targetType") String targetType,
                        @RequestParam("targetId") String targetId,
                        @RequestParam("action") String action) {
        log.debug("[users grant] adminId={}, dept={}, {}:{} {}", adminId, dept, targetType, targetId, action);
        return userService.applyGrant(dept, targetType, targetId, action);
    }

    /** dept 표시 명칭 저장(빈 값이면 코드 폴백) */
    @PostMapping("/dept-label")
    @ResponseBody
    public String deptLabel(@RequestParam("adminId") String adminId,
                            @RequestParam("dept") String dept,
                            @RequestParam(value = "label", required = false) String label) {
        log.debug("[users dept-label] adminId={}, dept={}, label={}", adminId, dept, label);
        labelService.save(dept, label);
        return "ok";
    }
}
