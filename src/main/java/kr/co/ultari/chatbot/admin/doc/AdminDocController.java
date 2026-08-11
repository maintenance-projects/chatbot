package kr.co.ultari.chatbot.admin.doc;

import kr.co.ultari.chatbot.common.dept.DeptProperties;
import kr.co.ultari.chatbot.common.web.GatewayApi;
import kr.co.ultari.chatbot.common.web.GatewayForward;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * 관리자 문서관리 API (명세서 4장 대칭). 관리자는 전체 파티션(dept)에 접근 가능하므로
 * 화면이 선택한 dept를 파라미터로 받아(설정 코드 검증) 해당 파티션으로 라우팅한다.
 * 앱 자체 경로는 {@code /admin/documents/*}, {@code /admin/profanity/reload}.
 */
@GatewayApi
@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminDocController {

    private final DeptProperties deptProperties;
    private final AdminDocService service;

    /** 4.1 문서 등록 (key/adminName은 서버가 채움 — 프론트는 adminId+file만) */
    @PostMapping("/documents")
    public ResponseEntity<String> add(@RequestParam String adminId,
                                      @RequestParam(value = "dept", required = false) String dept,
                                      @RequestParam("file") MultipartFile file) {
        return GatewayForward.json(service.add(resolveDept(dept), adminId, file));
    }

    /** 4.2 문서 삭제 */
    @DeleteMapping("/documents/{key}")
    public ResponseEntity<String> delete(@PathVariable String key, @RequestParam String adminId,
                                         @RequestParam(value = "dept", required = false) String dept) {
        return GatewayForward.json(service.delete(resolveDept(dept), key));
    }

    /** 4.3 문서 목록 조회 */
    @GetMapping("/documents")
    public ResponseEntity<String> list(@RequestParam String adminId,
                                       @RequestParam(value = "dept", required = false) String dept,
                                       @RequestParam(defaultValue = "1") int page,
                                       @RequestParam(defaultValue = "10") int size,
                                       @RequestParam(defaultValue = "registDate") String orderType,
                                       @RequestParam(defaultValue = "desc") String order) {
        return GatewayForward.json(service.list(resolveDept(dept), page, size, orderType, order));
    }

    /** 4.4 문서 검색 */
    @GetMapping("/documents/search")
    public ResponseEntity<String> search(@RequestParam String adminId,
                                         @RequestParam(value = "dept", required = false) String dept,
                                         @RequestParam(defaultValue = "fileName") String searchType,
                                         @RequestParam(defaultValue = "") String searchTerm,
                                         @RequestParam(defaultValue = "1") int page,
                                         @RequestParam(defaultValue = "10") int size,
                                         @RequestParam(defaultValue = "registDate") String orderType,
                                         @RequestParam(defaultValue = "desc") String order) {
        return GatewayForward.json(service.search(resolveDept(dept), searchType, searchTerm, page, size, orderType, order));
    }

    /** 4.5 문서 사용여부 토글 */
    @PatchMapping("/documents/{key}/toggle")
    public ResponseEntity<String> toggle(@PathVariable String key, @RequestParam String adminId,
                                         @RequestParam(value = "dept", required = false) String dept) {
        return GatewayForward.json(service.toggle(resolveDept(dept), key));
    }

    /** 4.6 문서 통계 조회 */
    @GetMapping("/documents/count")
    public ResponseEntity<String> count(@RequestParam String adminId,
                                        @RequestParam(value = "dept", required = false) String dept) {
        return GatewayForward.json(service.count(resolveDept(dept)));
    }

    /** 4.7 금칙어 목록 재로드 */
    @PostMapping("/profanity/reload")
    public ResponseEntity<String> reloadProfanity(@RequestParam String adminId,
                                                  @RequestParam(value = "dept", required = false) String dept) {
        return GatewayForward.json(service.reloadProfanity(resolveDept(dept)));
    }

    /** 관리자는 전체 파티션 접근 가능 → 설정된 코드면 그대로, 아니면 기본 dept. */
    private String resolveDept(String requested) {
        if (StringUtils.hasText(requested) && deptProperties.getCodes().contains(requested)) {
            return requested;
        }
        return deptProperties.getDefaultDept();
    }
}
