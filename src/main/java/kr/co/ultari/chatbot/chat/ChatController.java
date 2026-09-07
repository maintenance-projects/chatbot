package kr.co.ultari.chatbot.chat;

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
 * 챗봇 API (명세서 2·3장 대칭). 앱 자체 경로는 부서(dept)를 노출하지 않으며,
 * 서버가 세션에서 부서코드를 주입해 AI 서버({@code /{dept}/...})로 릴레이한다.
 * <p><b>보안</b>: 사용자 식별자(invokeId)는 URL/요청에 싣지 않고 <b>세션(로그인 시 확립)에서만</b> 사용한다.
 * → 노출·변조 소지 제거. 세션 신원이 없으면(미로그인) 거부.
 */
@GatewayApi
@RestController
@RequestMapping("/chat")
@RequiredArgsConstructor
public class ChatController {

    private final DeptContext deptContext;
    private final ChatService chatService;

    /** 2.1 문서 업로드 및 인덱싱 */
    @PostMapping(value = "/upload", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter upload(@RequestParam(value = "attachFile_name", required = false) String attachFileName,
                             @RequestParam("attachFile_bin") MultipartFile file,
                             HttpServletRequest request) {
        String uid = userId(request);
        if (uid == null || uid.isBlank()) return forbiddenSse();
        return chatService.upload(dept(request), uid, uid, attachFileName, file);
    }

    /** 3.1 통합 챗봇 (private/open 자동 라우팅) — target_filename 다중 지원 */
    @PostMapping(value = "/message", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter message(@RequestParam("message") String message,
                              @RequestParam(value = "target_filename", required = false) java.util.List<String> targetFilenames,
                              @RequestParam(value = "translate_to", required = false) String translateTo,
                              HttpServletRequest request) {
        String uid = userId(request);
        if (uid == null || uid.isBlank()) return forbiddenSse();
        return chatService.message(dept(request), uid, uid, message, targetFilenames, translateTo);
    }

    /** 2.2 Private 대화 — target_filename 다중 지원 */
    @PostMapping(value = "/message/private", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter messagePrivate(@RequestParam("message") String message,
                                     @RequestParam("target_filename") java.util.List<String> targetFilenames,
                                     @RequestParam(value = "translate_to", required = false) String translateTo,
                                     HttpServletRequest request) {
        String uid = userId(request);
        if (uid == null || uid.isBlank()) return forbiddenSse();
        return chatService.messagePrivate(dept(request), uid, uid, message, targetFilenames, translateTo);
    }

    /** 2.3 Open 대화 */
    @PostMapping(value = "/message/open", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter messageOpen(@RequestParam("message") String message,
                                  @RequestParam(value = "translate_to", required = false) String translateTo,
                                  HttpServletRequest request) {
        String uid = userId(request);
        if (uid == null || uid.isBlank()) return forbiddenSse();
        return chatService.messageOpen(dept(request), uid, uid, message, translateTo);
    }

    /** 2.6 문서 체계적 요약 — target_filename 다중(통합 요약) 지원 */
    @PostMapping(value = "/message/document-summary", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter documentSummary(@RequestParam("target_filename") java.util.List<String> targetFilenames,
                                      HttpServletRequest request) {
        String uid = userId(request);
        if (uid == null || uid.isBlank()) return forbiddenSse();
        return chatService.documentSummary(dept(request), uid, uid, targetFilenames);
    }

    /** 2.4 업로드 파일 목록 조회 */
    @GetMapping("/files")
    public ResponseEntity<String> files(HttpServletRequest request) {
        String uid = userId(request);
        if (uid == null || uid.isBlank()) return forbidden();
        return GatewayForward.json(chatService.files(dept(request), uid));
    }

    /** 2.5 대화 기록 조회 */
    @GetMapping("/history")
    public ResponseEntity<String> history(HttpServletRequest request) {
        String uid = userId(request);
        if (uid == null || uid.isBlank()) return forbidden();
        return GatewayForward.json(chatService.history(dept(request), uid));
    }

    // --- helpers ---
    private String dept(HttpServletRequest request) {
        return deptContext.resolve(request);
    }

    /** 사용자 식별자는 세션(로그인 시 확립)에서만 얻는다. 요청/URL 값은 신뢰하지 않는다. */
    private String userId(HttpServletRequest request) {
        Object uid = request.getSession().getAttribute(DeptContext.SESSION_USER_ID);
        return uid == null ? null : uid.toString();
    }

    private static SseEmitter forbiddenSse() {
        SseEmitter em = new SseEmitter();
        try {
            em.send(SseEmitter.event().data("{\"type\":\"error\",\"detail\":\"잘못된 접근입니다.\"}"));
        } catch (Exception ignore) { /* 클라이언트 조기 종료 무시 */ }
        em.complete();
        return em;
    }

    private static ResponseEntity<String> forbidden() {
        return ResponseEntity.status(org.springframework.http.HttpStatus.FORBIDDEN)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"type\":\"error\",\"detail\":\"잘못된 접근입니다.\"}");
    }
}
