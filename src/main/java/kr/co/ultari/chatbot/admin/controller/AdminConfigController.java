package kr.co.ultari.chatbot.admin.controller;

import kr.co.ultari.chatbot.admin.service.AdminConfigService;
import kr.co.ultari.chatbot.admin.service.AppSettingService;
import kr.co.ultari.chatbot.common.dept.DeptProperties;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import java.nio.charset.StandardCharsets;

/**
 * 관리자 환경설정 — 게이트웨이 {@code /admin/settings/{dept}} 프록시(파티션별).
 * 프론트와 게이트웨이가 동일 JSON 계약({@code file_ttl_days, temperature, system_prompt})을 공유한다.
 */
@Slf4j
@Controller
@RequestMapping("/at-i/config")
public class AdminConfigController {

    private final AdminConfigService configService;
    private final DeptProperties deptProperties;
    private final AppSettingService appSettingService;

    public AdminConfigController(AdminConfigService configService, DeptProperties deptProperties,
                                 AppSettingService appSettingService) {
        this.configService = configService;
        this.deptProperties = deptProperties;
        this.appSettingService = appSettingService;
    }

    /** application/json;charset=UTF-8 — 게이트웨이 응답에 charset이 없어 브라우저가 오해석하지 않도록 명시. */
    private static final MediaType JSON_UTF8 = new MediaType(MediaType.APPLICATION_JSON, StandardCharsets.UTF_8);

    /** 설정 조회 — 게이트웨이 응답을 상태코드·본문째 통과(Content-Type만 UTF-8 명시). */
    @PostMapping("/load")
    @ResponseBody
    public ResponseEntity<String> load(@RequestParam(value = "dept", required = false) String dept) {
        String d = resolveDept(dept);
        if (d == null) return badRequest();
        return withUtf8(configService.getSettings(d));
    }

    /** 설정 저장 — 프론트 JSON을 게이트웨이로 전달, 응답 통과(Content-Type UTF-8 명시). */
    @PostMapping("/save")
    @ResponseBody
    public ResponseEntity<String> save(@RequestParam(value = "dept", required = false) String dept,
                                       @RequestBody(required = false) String jsonBody) {
        String d = resolveDept(dept);
        if (d == null) return badRequest();
        log.debug("[config save] dept={}, body={}", d, jsonBody);
        return withUtf8(configService.saveSettings(d, jsonBody));
    }

    /** 로컬 설정 조회(게이트웨이 무관) — 개인문서 업로드 개수 제한 등. */
    @PostMapping("/local/load")
    @ResponseBody
    public ResponseEntity<String> localLoad() {
        JSONObject o = new JSONObject();
        o.put("maxDocs", appSettingService.getPersonalDocMaxCount()); // 0 = 무제한
        return ResponseEntity.ok().contentType(JSON_UTF8).body(o.toString());
    }

    /** 로컬 설정 저장 — 개인문서 업로드 개수 제한(0=무제한, 음수 거부). */
    @PostMapping("/local/save")
    @ResponseBody
    public ResponseEntity<String> localSave(@RequestBody(required = false) String jsonBody) {
        int maxDocs;
        try {
            maxDocs = new JSONObject(jsonBody == null ? "{}" : jsonBody).optInt("maxDocs", 0);
        } catch (Exception e) {
            return badRequest();
        }
        if (maxDocs < 0) return badRequest();
        appSettingService.setPersonalDocMaxCount(maxDocs);
        log.debug("[config local save] maxDocs={}", maxDocs);
        return ResponseEntity.ok().contentType(JSON_UTF8).body("{\"ok\":true,\"maxDocs\":" + maxDocs + "}");
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

    private ResponseEntity<String> badRequest() {
        return ResponseEntity.badRequest().contentType(JSON_UTF8)
                .body("{\"error\":\"invalid dept\"}");
    }

    /** 게이트웨이 응답의 상태코드·본문은 유지하고 Content-Type을 UTF-8로 명시해 재포장. */
    private ResponseEntity<String> withUtf8(ResponseEntity<String> res) {
        return ResponseEntity.status(res.getStatusCode())
                .contentType(JSON_UTF8)
                .body(res.getBody());
    }
}
