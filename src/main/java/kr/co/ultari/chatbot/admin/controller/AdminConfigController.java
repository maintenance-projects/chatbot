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

    /** 파티션별 설정 조회 — 게이트웨이 GET /{dept}/admin/partitions/{partition}/settings 통과. */
    @PostMapping("/partition/load")
    @ResponseBody
    public ResponseEntity<String> partitionLoad(@RequestParam(value = "dept", required = false) String dept,
                                                @RequestParam(value = "partition", required = false) String partition) {
        String d = resolveDept(dept);
        if (d == null || !validPartition(partition)) return badRequest();
        return withUtf8(configService.getPartitionSettings(d, partition.trim()));
    }

    /** 파티션별 설정 저장 — temperature·system_prompt만 게이트웨이로 전달. */
    @PostMapping("/partition/save")
    @ResponseBody
    public ResponseEntity<String> partitionSave(@RequestParam(value = "dept", required = false) String dept,
                                                @RequestParam(value = "partition", required = false) String partition,
                                                @RequestBody(required = false) String jsonBody) {
        String d = resolveDept(dept);
        if (d == null || !validPartition(partition)) return badRequest();
        log.debug("[config partition save] dept={}, partition={}, body={}", d, partition, jsonBody);
        return withUtf8(configService.savePartitionSettings(d, partition.trim(), jsonBody));
    }

    /** 파티션별 설정 초기화 — 게이트웨이 DELETE /{dept}/admin/partitions/{partition}/settings(개별 설정 삭제→전체 상속). */
    @org.springframework.web.bind.annotation.DeleteMapping("/partition/settings")
    @ResponseBody
    public ResponseEntity<String> partitionReset(@RequestParam(value = "dept", required = false) String dept,
                                                 @RequestParam(value = "partition", required = false) String partition) {
        String d = resolveDept(dept);
        if (d == null || !validPartition(partition)) return badRequest();
        log.debug("[config partition reset] dept={}, partition={}", d, partition);
        return withUtf8(configService.resetPartitionSettings(d, partition.trim()));
    }

    /** 파티션 식별자(name) 검증 — 게이트웨이 경로 주입 방지(게이트웨이 채번: 예 documents_1). */
    private boolean validPartition(String partition) {
        return partition != null && partition.trim().matches("[A-Za-z0-9._-]+");
    }

    /** 개인문서 보관기간 조회(전역) — 게이트웨이 GET /admin/file-ttl 통과. */
    @PostMapping("/ttl/load")
    @ResponseBody
    public ResponseEntity<String> ttlLoad() {
        return withUtf8(configService.getFileTtl());
    }

    /** 개인문서 보관기간 저장(전역) — file_ttl_days(1 이상)만 게이트웨이 POST /admin/file-ttl 로 전달. */
    @PostMapping("/ttl/save")
    @ResponseBody
    public ResponseEntity<String> ttlSave(@RequestBody(required = false) String jsonBody) {
        int days;
        try {
            days = new JSONObject(jsonBody == null ? "{}" : jsonBody).optInt("file_ttl_days", 0);
        } catch (Exception e) {
            return badRequest();
        }
        if (days < 1) return badRequest();
        log.debug("[config ttl save] file_ttl_days={}", days);
        return withUtf8(configService.saveFileTtl("{\"file_ttl_days\":" + days + "}"));
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
     * 파티션 안내문구 조회(로컬, 게이트웨이 무관). partition 비면 기본값(__default__) raw 반환.
     * 사용자 화면 인사말로 쓰이는 문구를 관리자가 파티션별로 편집하기 위한 raw 조회(폴백 없음).
     */
    @PostMapping("/partition-guide/load")
    @ResponseBody
    public ResponseEntity<String> partitionGuideLoad(@RequestParam(value = "dept", required = false) String dept,
                                                     @RequestParam(value = "partition", required = false) String partition) {
        String d = resolveDept(dept);
        if (d == null) return badRequest();
        boolean isDefault = !StringUtils.hasText(partition);
        if (!isDefault && !validPartition(partition)) return badRequest();
        String guide = isDefault
                ? appSettingService.getDefaultGuideRaw()
                : appSettingService.getPartitionGuideRaw(d, partition.trim());
        return ResponseEntity.ok().contentType(JSON_UTF8)
                .body(new JSONObject().put("guide", guide).toString());
    }

    /**
     * 파티션 안내문구 저장(로컬). partition 비면 기본값(__default__) 저장. 빈 guide=미설정으로 비움.
     * 2000자 초과는 서비스에서 절단.
     */
    @PostMapping("/partition-guide/save")
    @ResponseBody
    public ResponseEntity<String> partitionGuideSave(@RequestParam(value = "dept", required = false) String dept,
                                                     @RequestParam(value = "partition", required = false) String partition,
                                                     @RequestBody(required = false) String jsonBody) {
        String d = resolveDept(dept);
        if (d == null) return badRequest();
        boolean isDefault = !StringUtils.hasText(partition);
        if (!isDefault && !validPartition(partition)) return badRequest();
        String guide;
        try {
            guide = new JSONObject(jsonBody == null ? "{}" : jsonBody).optString("guide", "");
        } catch (Exception e) {
            return badRequest();
        }
        if (isDefault) appSettingService.setDefaultGuide(guide);
        else appSettingService.setPartitionGuide(d, partition.trim(), guide);
        log.debug("[config partition-guide save] dept={}, partition={}, len={}", d, partition,
                guide == null ? 0 : guide.length());
        return ResponseEntity.ok().contentType(JSON_UTF8).body("{\"ok\":true}");
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
                .body("{\"error\":\"invalid request\"}");
    }

    /** 게이트웨이 응답의 상태코드·본문은 유지하고 Content-Type을 UTF-8로 명시해 재포장. */
    private ResponseEntity<String> withUtf8(ResponseEntity<String> res) {
        return ResponseEntity.status(res.getStatusCode())
                .contentType(JSON_UTF8)
                .body(res.getBody());
    }
}
