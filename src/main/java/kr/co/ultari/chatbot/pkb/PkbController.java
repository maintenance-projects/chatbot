package kr.co.ultari.chatbot.pkb;

import kr.co.ultari.chatbot.common.web.GatewayApi;
import kr.co.ultari.chatbot.common.web.GatewayForward;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * PKB API (명세서 8장 대칭). 개인 지식 저장소로 소유자(ownerId)를 경로로 받고,
 * 파티션(dept)과 무관하게 처리한다(게이트웨이도 /pkb/{ownerId}/... dept-less로 서빙).
 */
@GatewayApi
@RestController
@RequestMapping("/pkb/{ownerId}")
@RequiredArgsConstructor
public class PkbController {

    private final PkbService service;

    /** 8.1 첨부파일 인제스트 (AI 분석 포함) */
    @PostMapping(value = "/ingest", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter ingest(@PathVariable String ownerId,
                             @RequestParam("sender") String sender,
                             @RequestParam(value = "room_name", required = false) String roomName,
                             @RequestParam(value = "received_at", required = false) String receivedAt,
                             @RequestParam(value = "attachFile_name", required = false) String attachFileName,
                             @RequestParam("attachFile_bin") MultipartFile file) {
        return service.ingest(ownerId, sender, roomName, receivedAt, attachFileName, file);
    }

    /** PKB 첨부파일 보관일수(PKB_DOC_TTL) 조회 */
    @GetMapping("/ttl")
    public ResponseEntity<String> ttl(@PathVariable String ownerId) {
        return GatewayForward.json(service.ttl());
    }

    /** 8.2 내 파일 목록 조회 */
    @GetMapping("/files")
    public ResponseEntity<String> files(@PathVariable String ownerId,
                                        @RequestParam(required = false) String category,
                                        @RequestParam(required = false) String tag) {
        return GatewayForward.json(service.files(ownerId, category, tag));
    }

    /** 8.3 파일 상세 정보 */
    @GetMapping("/file/{fileHash}")
    public ResponseEntity<String> file(@PathVariable String ownerId, @PathVariable String fileHash) {
        return GatewayForward.json(service.file(ownerId, fileHash));
    }

    /** 8.4 파일 삭제 */
    @DeleteMapping("/file/{fileHash}")
    public ResponseEntity<String> delete(@PathVariable String ownerId, @PathVariable String fileHash) {
        return GatewayForward.json(service.delete(ownerId, fileHash));
    }

    /** 8.5 자연어 검색 */
    @PostMapping(value = "/search", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter search(@PathVariable String ownerId, @RequestParam("message") String message) {
        return service.search(ownerId, message);
    }
}
