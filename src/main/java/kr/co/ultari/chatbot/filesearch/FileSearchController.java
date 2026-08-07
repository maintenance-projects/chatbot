package kr.co.ultari.chatbot.filesearch;

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
 * 첨부파일 검색 API (명세서 7장 대칭). 부서(dept)는 세션에서 주입.
 */
@GatewayApi
@RestController
@RequestMapping("/file-search")
@RequiredArgsConstructor
public class FileSearchController {

    private final DeptContext deptContext;
    private final FileSearchService service;

    /** 7.1 첨부파일 업로드 및 인덱싱 */
    @PostMapping(value = "/upload/{invokeId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter upload(@PathVariable String invokeId,
                             @RequestParam(value = "attachFile_name", required = false) String attachFileName,
                             @RequestParam("attachFile_bin") MultipartFile file,
                             HttpServletRequest request) {
        return service.upload(dept(request), userId(request), invokeId, attachFileName, file);
    }

    /** 7.2 첨부파일 내용 질문 */
    @PostMapping(value = "/ask/{invokeId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter ask(@PathVariable String invokeId,
                          @RequestParam("message") String message,
                          @RequestParam("target_filename") String targetFilename,
                          HttpServletRequest request) {
        return service.ask(dept(request), userId(request), invokeId, message, targetFilename);
    }

    /** 7.3 인덱싱된 파일 목록 조회 */
    @GetMapping("/files/{invokeId}")
    public ResponseEntity<String> files(@PathVariable String invokeId, HttpServletRequest request) {
        return GatewayForward.json(service.files(dept(request), invokeId));
    }

    private String dept(HttpServletRequest request) {
        return deptContext.resolve(request);
    }

    private String userId(HttpServletRequest request) {
        Object uid = request.getSession().getAttribute(DeptContext.SESSION_USER_ID);
        return uid == null ? null : uid.toString();
    }
}
