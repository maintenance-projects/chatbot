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
    private final DeptLabelService labelService;
    private final kr.co.ultari.chatbot.admin.service.AdminConfigService configService;
    private final kr.co.ultari.chatbot.admin.service.AppSettingService appSettingService;

    /** 개인문서 보관일수·업로드 개수 제한(사용자 화면 안내·게이팅용). 관리자 환경설정값을 그대로 노출. */
    @GetMapping("/me/doc-retention")
    public ResponseEntity<String> docRetention() {
        JSONObject o = new JSONObject();
        o.put("days", configService.getDocRetentionDays());
        o.put("maxDocs", appSettingService.getPersonalDocMaxCount()); // 0 = 무제한
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(o.toString());
    }

    /** 허용 dept 목록 + 현재 선택 + 표시명. 신원은 세션(로그인 시 확립)에서만 사용 — user 파라미터 불신(스푸핑 방지). */
    @GetMapping("/me/depts")
    public ResponseEntity<String> list(
            @RequestParam(value = "user", required = false) String user,
            HttpServletRequest request) {
        // (보안) 클라가 보낸 user로 세션 신원을 덮어쓰지 않는다. 신원은 /chatbot/{key} 로그인에서만 확립.
        Set<String> allowed = deptContext.allowed(request);
        JSONObject o = new JSONObject();
        o.put("depts", new JSONArray(allowed));
        // allowed를 재사용해 현재 dept 결정 — allowedDepts(HR 조회) 중복 계산 방지
        o.put("current", deptContext.resolveFrom(allowed, request));
        o.put("labels", new JSONObject(labelService.labels()));
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(o.toString());
    }

    /** dept 선택(허용된 경우만 세션 반영) */
    @PostMapping("/me/depts")
    public ResponseEntity<String> select(@RequestParam("dept") String dept,
            @RequestParam(value = "user", required = false) String user,
            HttpServletRequest request) {
        // (보안) user 파라미터로 세션 신원 재바인딩하지 않음. 세션 사용자에게 허용된 dept만 선택 반영.
        boolean ok = deptContext.select(request, dept);
        JSONObject o = new JSONObject();
        o.put("ok", ok);
        o.put("current", deptContext.resolve(request));
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(o.toString());
    }

    /**
     * 접근 권한이 있는 파티션 목록 + 현재 선택. 사용자 화면 드롭다운용.
     * 신원은 세션에서만 사용(user 파라미터 불신). 게이트웨이가 내려가 있으면 파티션 목록은 빈 배열.
     */
    @GetMapping("/me/partitions")
    public ResponseEntity<String> listPartitions(
            @RequestParam(value = "user", required = false) String user,
            HttpServletRequest request) {
        java.util.List<PartitionResolver.AccessiblePartition> parts = deptContext.accessiblePartitions(request);

        JSONArray arr = new JSONArray();
        for (PartitionResolver.AccessiblePartition p : parts) {
            JSONObject po = new JSONObject();
            po.put("dept", p.dept());
            po.put("name", p.name());
            po.put("label", p.label());
            arr.put(po);
        }

        // 현재 선택: 세션값이 목록에 있으면 그것, 아니면 첫 항목(없으면 빈 객체)
        String selDept = deptContext.selectedDept(request);
        String selName = deptContext.selectedPartition(request);
        PartitionResolver.AccessiblePartition chosen = null;
        for (PartitionResolver.AccessiblePartition p : parts) {
            if (p.dept().equals(selDept) && p.name().equals(selName)) { chosen = p; break; }
        }
        if (chosen == null && !parts.isEmpty()) chosen = parts.get(0);

        // 세션에 선택 파티션이 아직 없으면 현재(기본) 파티션으로 초기화 — 드롭다운을 안 거치는
        // 단일 파티션 사용자도 이후 질의가 파티션 스코프(partition=name)로 나가도록 보장.
        if (chosen != null && (selName == null || selName.isBlank())) {
            deptContext.selectPartition(request, chosen.dept(), chosen.name());
        }

        JSONObject cur = new JSONObject();
        if (chosen != null) {
            cur.put("dept", chosen.dept());
            cur.put("name", chosen.name());
            cur.put("label", chosen.label());
        }

        JSONObject o = new JSONObject();
        o.put("partitions", arr);
        o.put("current", cur);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(o.toString());
    }

    /** 파티션 선택(접근 허용된 경우만 세션에 dept+partition 반영) */
    @PostMapping("/me/partition")
    public ResponseEntity<String> selectPartition(
            @RequestParam("dept") String dept,
            @RequestParam("partition") String partition,
            HttpServletRequest request) {
        boolean ok = deptContext.selectPartition(request, dept, partition);
        JSONObject o = new JSONObject();
        o.put("ok", ok);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(o.toString());
    }
}
