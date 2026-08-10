package kr.co.ultari.chatbot.pkb;

import jakarta.servlet.http.HttpServletRequest;
import kr.co.ultari.chatbot.common.dept.DeptContext;
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
 * 부서(dept)는 ownerId의 허용 범위 안에서 세션 선택 dept로 결정한다(서버-서버 인제스트는 세션 없음 → 자동/default).
 */
@GatewayApi
@RestController
@RequestMapping("/pkb/{ownerId}")
@RequiredArgsConstructor
public class PkbController {

    private final DeptContext deptContext;
    private final PkbService service;

    /** 8.1 첨부파일 인제스트 (AI 분석 포함) */
    @PostMapping(value = "/ingest", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter ingest(@PathVariable String ownerId,
                             @RequestParam("sender") String sender,
                             @RequestParam(value = "room_name", required = false) String roomName,
                             @RequestParam(value = "received_at", required = false) String receivedAt,
                             @RequestParam(value = "attachFile_name", required = false) String attachFileName,
                             @RequestParam("attachFile_bin") MultipartFile file,
                             HttpServletRequest request) {
        return service.ingest(dept(ownerId, request), ownerId, sender, roomName, receivedAt, attachFileName, file);
    }

    /** 8.2 내 파일 목록 조회 */
    @GetMapping("/files")
    public ResponseEntity<String> files(@PathVariable String ownerId,
                                        @RequestParam(required = false) String category,
                                        @RequestParam(required = false) String tag,
                                        HttpServletRequest request) {
        return GatewayForward.json(service.files(dept(ownerId, request), ownerId, category, tag));
    }

    /** 8.3 파일 상세 정보 */
    @GetMapping("/file/{fileHash}")
    public ResponseEntity<String> file(@PathVariable String ownerId, @PathVariable String fileHash,
                                       HttpServletRequest request) {
        return GatewayForward.json(service.file(dept(ownerId, request), ownerId, fileHash));
    }

    /** 8.4 파일 삭제 */
    @DeleteMapping("/file/{fileHash}")
    public ResponseEntity<String> delete(@PathVariable String ownerId, @PathVariable String fileHash,
                                         HttpServletRequest request) {
        return GatewayForward.json(service.delete(dept(ownerId, request), ownerId, fileHash));
    }

    /** 8.5 자연어 검색 */
    @PostMapping(value = "/search", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter search(@PathVariable String ownerId, @RequestParam("message") String message,
                             HttpServletRequest request) {
        return service.search(dept(ownerId, request), ownerId, message);
    }

    private String dept(String ownerId, HttpServletRequest request) {
        return deptContext.resolveForUser(ownerId, request);
    }
}
