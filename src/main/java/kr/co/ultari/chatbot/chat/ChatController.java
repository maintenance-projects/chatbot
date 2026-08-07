package kr.co.ultari.chatbot.chat;

import jakarta.servlet.http.HttpServletRequest;
import kr.co.ultari.chatbot.common.dept.DeptContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 챗봇 API (명세서 2·3장 대칭). 앱 자체 경로는 부서(dept)를 노출하지 않으며,
 * 서버가 세션에서 부서코드를 주입해 AI 서버({@code /{dept}/...})로 릴레이한다.
 */
@RestController
@RequestMapping("/chat")
@RequiredArgsConstructor
public class ChatController {

    private final DeptContext deptContext;
    private final ChatService chatService;

    /** 2.1 문서 업로드 및 인덱싱 */
    @PostMapping(value = "/upload/{invokeId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter upload(@PathVariable String invokeId,
                             @RequestParam(value = "attachFile_name", required = false) String attachFileName,
                             @RequestParam("attachFile_bin") MultipartFile file,
                             HttpServletRequest request) {
        return chatService.upload(dept(request), userId(request), invokeId, attachFileName, file);
    }

    /** 3.1 통합 챗봇 (private/open 자동 라우팅) */
    @PostMapping(value = "/message/{invokeId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter message(@PathVariable String invokeId,
                              @RequestParam("message") String message,
                              @RequestParam(value = "target_filename", required = false) String targetFilename,
                              @RequestParam(value = "translate_to", required = false) String translateTo,
                              HttpServletRequest request) {
        return chatService.message(dept(request), userId(request), invokeId, message, targetFilename, translateTo);
    }

    /** 2.2 Private 대화 */
    @PostMapping(value = "/message/private/{invokeId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter messagePrivate(@PathVariable String invokeId,
                                     @RequestParam("message") String message,
                                     @RequestParam("target_filename") String targetFilename,
                                     @RequestParam(value = "translate_to", required = false) String translateTo,
                                     HttpServletRequest request) {
        return chatService.messagePrivate(dept(request), userId(request), invokeId, message, targetFilename, translateTo);
    }

    /** 2.3 Open 대화 */
    @PostMapping(value = "/message/open/{invokeId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter messageOpen(@PathVariable String invokeId,
                                  @RequestParam("message") String message,
                                  @RequestParam(value = "translate_to", required = false) String translateTo,
                                  HttpServletRequest request) {
        return chatService.messageOpen(dept(request), userId(request), invokeId, message, translateTo);
    }

    /** 2.6 문서 체계적 요약 */
    @PostMapping(value = "/message/document-summary/{invokeId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter documentSummary(@PathVariable String invokeId,
                                      @RequestParam("target_filename") String targetFilename,
                                      HttpServletRequest request) {
        return chatService.documentSummary(dept(request), userId(request), invokeId, targetFilename);
    }

    /** 2.4 업로드 파일 목록 조회 */
    @GetMapping("/files/{invokeId}")
    public ResponseEntity<String> files(@PathVariable String invokeId, HttpServletRequest request) {
        return json(chatService.files(dept(request), invokeId));
    }

    /** 2.5 대화 기록 조회 */
    @GetMapping("/history/{invokeId}")
    public ResponseEntity<String> history(@PathVariable String invokeId, HttpServletRequest request) {
        return json(chatService.history(dept(request), invokeId));
    }

    // --- helpers ---
    private String dept(HttpServletRequest request) {
        return deptContext.resolve(request);
    }

    private String userId(HttpServletRequest request) {
        Object uid = request.getSession().getAttribute(DeptContext.SESSION_USER_ID);
        return uid == null ? null : uid.toString();
    }

    private ResponseEntity<String> json(String body) {
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(body);
    }
}
