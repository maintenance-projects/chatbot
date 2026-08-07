package kr.co.ultari.chatbot.pkb;

import kr.co.ultari.chatbot.common.dept.DeptResolver;
import kr.co.ultari.chatbot.common.web.GatewayApi;
import kr.co.ultari.chatbot.common.web.GatewayForward;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * PKB API (명세서 8장 대칭). 개인 저장소이므로 소유자(ownerId)를 경로로 받고,
 * 부서(dept)는 ownerId로부터 설정 매핑으로 해결한다(서버-서버 인제스트도 수용).
 */
@GatewayApi
@RestController
@RequestMapping("/pkb/{ownerId}")
@RequiredArgsConstructor
public class PkbController {

    private final DeptResolver deptResolver;
    private final PkbService service;

    /** 8.1 첨부파일 인제스트 (AI 분석 포함) */
    @PostMapping(value = "/ingest", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter ingest(@PathVariable String ownerId,
                             @RequestParam("sender") String sender,
                             @RequestParam(value = "room_name", required = false) String roomName,
                             @RequestParam(value = "received_at", required = false) String receivedAt,
                             @RequestParam(value = "attachFile_name", required = false) String attachFileName,
                             @RequestParam("attachFile_bin") MultipartFile file) {
        return service.ingest(dept(ownerId), ownerId, sender, roomName, receivedAt, attachFileName, file);
    }

    /** 8.2 내 파일 목록 조회 */
    @GetMapping("/files")
    public ResponseEntity<String> files(@PathVariable String ownerId,
                                        @RequestParam(required = false) String category,
                                        @RequestParam(required = false) String tag) {
        return GatewayForward.json(service.files(dept(ownerId), ownerId, category, tag));
    }

    /** 8.3 파일 상세 정보 */
    @GetMapping("/file/{fileHash}")
    public ResponseEntity<String> file(@PathVariable String ownerId, @PathVariable String fileHash) {
        return GatewayForward.json(service.file(dept(ownerId), ownerId, fileHash));
    }

    /** 8.4 파일 삭제 */
    @DeleteMapping("/file/{fileHash}")
    public ResponseEntity<String> delete(@PathVariable String ownerId, @PathVariable String fileHash) {
        return GatewayForward.json(service.delete(dept(ownerId), ownerId, fileHash));
    }

    /** 8.5 자연어 검색 */
    @PostMapping(value = "/search", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter search(@PathVariable String ownerId, @RequestParam("message") String message) {
        return service.search(dept(ownerId), ownerId, message);
    }

    private String dept(String ownerId) {
        return deptResolver.resolve(ownerId);
    }
}
