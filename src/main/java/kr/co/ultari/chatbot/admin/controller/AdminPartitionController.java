package kr.co.ultari.chatbot.admin.controller;

import kr.co.ultari.chatbot.admin.service.AdminPartitionService;
import kr.co.ultari.chatbot.common.dept.DeptProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import java.nio.charset.StandardCharsets;

/**
 * AI 파티션 관리 — 게이트웨이 {@code /{dept}/admin/partitions} 프록시(파티션 하위).
 * "AI 파티션 권한" 화면(users)의 파티션 섹션에서 호출한다.
 * dept는 화이트리스트 검증(게이트웨이 경로 주입 방지), name은 식별자 문자만 허용한다.
 */
@Slf4j
@Controller
@RequestMapping("/at-i/partitions")
public class AdminPartitionController {

    private final AdminPartitionService partitionService;
    private final DeptProperties deptProperties;

    public AdminPartitionController(AdminPartitionService partitionService, DeptProperties deptProperties) {
        this.partitionService = partitionService;
        this.deptProperties = deptProperties;
    }

    /** application/json;charset=UTF-8 — 게이트웨이 응답에 charset이 없어 브라우저 오해석 방지. */
    private static final MediaType JSON_UTF8 = new MediaType(MediaType.APPLICATION_JSON, StandardCharsets.UTF_8);

    /** 파티션 목록 조회 — 게이트웨이 응답 통과. */
    @PostMapping("/list")
    @ResponseBody
    public ResponseEntity<String> list(@RequestParam(value = "dept", required = false) String dept) {
        String d = resolveDept(dept);
        if (d == null) return badRequest("invalid dept");
        return withUtf8(partitionService.list(d));
    }

    /** 파티션 생성 — description(사용자 입력 이름)만 전달. */
    @PostMapping("/create")
    @ResponseBody
    public ResponseEntity<String> create(@RequestParam(value = "dept", required = false) String dept,
                                         @RequestParam(value = "description", required = false) String description) {
        String d = resolveDept(dept);
        if (d == null) return badRequest("invalid dept");
        String desc = description == null ? "" : description.trim();
        if (desc.isEmpty() || desc.length() > 100) return badRequest("invalid description");
        log.debug("[partition create] dept={}, description={}", d, desc);
        return withUtf8(partitionService.create(d, desc));
    }

    /** 파티션 이름 변경 — name(식별자)은 유지, description(표시명)만 갱신. */
    @PostMapping("/rename")
    @ResponseBody
    public ResponseEntity<String> rename(@RequestParam(value = "dept", required = false) String dept,
                                         @RequestParam(value = "name", required = false) String name,
                                         @RequestParam(value = "description", required = false) String description) {
        String d = resolveDept(dept);
        if (d == null) return badRequest("invalid dept");
        String n = name == null ? "" : name.trim();
        if (n.isEmpty() || !n.matches("[A-Za-z0-9._-]+")) return badRequest("invalid name");
        String desc = description == null ? "" : description.trim();
        if (desc.isEmpty() || desc.length() > 100) return badRequest("invalid description");
        log.debug("[partition rename] dept={}, name={}, description={}", d, n, desc);
        return withUtf8(partitionService.rename(d, n, desc));
    }

    /** 파티션 삭제 — 목록 응답의 name(식별자)을 경로로 전달. */
    @PostMapping("/delete")
    @ResponseBody
    public ResponseEntity<String> delete(@RequestParam(value = "dept", required = false) String dept,
                                         @RequestParam(value = "name", required = false) String name) {
        String d = resolveDept(dept);
        if (d == null) return badRequest("invalid dept");
        String n = name == null ? "" : name.trim();
        // 게이트웨이 경로 주입 방지 — 식별자 문자만 허용(name은 게이트웨이 채번: 예 documents_1)
        if (n.isEmpty() || !n.matches("[A-Za-z0-9._-]+")) return badRequest("invalid name");
        log.debug("[partition delete] dept={}, name={}", d, n);
        return withUtf8(partitionService.delete(d, n));
    }

    /** 파티션 순서 변경 — body=[{"name":"documents_1","order":1},...] JSON을 게이트웨이로 그대로 전달. */
    @PostMapping("/reorder")
    @ResponseBody
    public ResponseEntity<String> reorder(@RequestParam(value = "dept", required = false) String dept,
                                          @org.springframework.web.bind.annotation.RequestBody(required = false) String jsonBody) {
        String d = resolveDept(dept);
        if (d == null) return badRequest("invalid dept");
        if (!StringUtils.hasText(jsonBody)) return badRequest("empty body");
        log.debug("[partition reorder] dept={}, body={}", d, jsonBody);
        return withUtf8(partitionService.reorder(d, jsonBody));
    }

    /**
     * dept 화이트리스트 검증 — 설정된 코드 목록 또는 기본 dept만 허용(게이트웨이 경로 주입 방지).
     * 빈 값이면 기본 dept로 폴백. 미허용 코드는 null.
     */
    private String resolveDept(String dept) {
        String def = deptProperties.getDefaultDept();
        if (!StringUtils.hasText(dept)) return def;
        String d = dept.trim();
        if (d.equals(def) || deptProperties.getCodes().contains(d)) return d;
        return null;
    }

    private ResponseEntity<String> badRequest(String msg) {
        return ResponseEntity.badRequest().contentType(JSON_UTF8)
                .body("{\"code\":\"4000\",\"message\":\"" + msg + "\"}");
    }

    /** 게이트웨이 응답의 상태코드·본문은 유지하고 Content-Type을 UTF-8로 명시해 재포장. */
    private ResponseEntity<String> withUtf8(ResponseEntity<String> res) {
        return ResponseEntity.status(res.getStatusCode())
                .contentType(JSON_UTF8)
                .body(res.getBody());
    }
}
