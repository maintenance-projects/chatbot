package kr.co.ultari.chatbot.common.dept;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Set;

/**
 * 현재 사용자의 AI 파티션(dept) 선택 스위처.
 * 프론트(챗봇/PKB)가 허용 dept를 조회해 여러 개면 선택 UI를 노출하고, 선택을 세션에 저장한다.
 */
@RestController
@RequiredArgsConstructor
public class DeptSwitchController {

    private final DeptContext deptContext;

    /** 허용 dept 목록 + 현재 선택(자동 결정 포함). user=화면이 아는 사용자 id로 세션 신원 확립. */
    @GetMapping("/me/depts")
    public ResponseEntity<String> list(
            @RequestParam(value = "user", required = false) String user,
            HttpServletRequest request) {
        deptContext.bindUser(request, user);
        Set<String> allowed = deptContext.allowed(request);
        JSONObject o = new JSONObject();
        o.put("depts", new JSONArray(allowed));
        o.put("current", deptContext.resolve(request));
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(o.toString());
    }

    /** dept 선택(허용된 경우만 세션 반영) */
    @PostMapping("/me/depts")
    public ResponseEntity<String> select(@RequestParam("dept") String dept,
            @RequestParam(value = "user", required = false) String user,
            HttpServletRequest request) {
        deptContext.bindUser(request, user);
        boolean ok = deptContext.select(request, dept);
        JSONObject o = new JSONObject();
        o.put("ok", ok);
        o.put("current", deptContext.resolve(request));
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(o.toString());
    }
}
