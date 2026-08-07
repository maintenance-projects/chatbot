package kr.co.ultari.chatbot.docgen;

import jakarta.servlet.http.HttpServletRequest;
import kr.co.ultari.chatbot.common.dept.DeptContext;
import kr.co.ultari.chatbot.common.web.GatewayApi;
import kr.co.ultari.chatbot.common.web.GatewayForward;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 문서 자동화 API (명세서 5장 대칭). 부서(dept)는 세션에서 주입.
 */
@GatewayApi
@RestController
@RequiredArgsConstructor
public class DocGenController {

    private final DeptContext deptContext;
    private final DocGenService service;

    /** 5.1 HWPX 문서 자동 생성 */
    @PostMapping("/documents/generate-hwpx")
    public ResponseEntity<String> generateHwpx(@RequestParam("template_name") String templateName,
                                               @RequestParam("context_data") String contextData,
                                               @RequestParam(value = "expires_in", required = false) Integer expiresIn,
                                               @RequestParam(value = "one_time", required = false) Boolean oneTime,
                                               HttpServletRequest request) {
        return GatewayForward.json(
                service.generateHwpx(deptContext.resolve(request), templateName, contextData, expiresIn, oneTime));
    }

    /** 5.2 회의록 HWPX 생성 (SSE) */
    @PostMapping(value = "/documents/meeting-minutes/generate-from-text",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter meetingMinutes(@RequestParam(value = "raw_text", required = false) String rawText,
                                     @RequestParam(value = "file", required = false) MultipartFile file,
                                     @RequestParam(value = "expires_in", required = false) Integer expiresIn,
                                     @RequestParam(value = "one_time", required = false) Boolean oneTime,
                                     HttpServletRequest request) {
        return service.meetingMinutes(deptContext.resolve(request), rawText, file, expiresIn, oneTime);
    }

    /** 5.3 토큰 기반 파일 다운로드 */
    @GetMapping("/documents/download/{token}")
    public ResponseEntity<byte[]> download(@PathVariable String token, HttpServletRequest request) {
        ResponseEntity<byte[]> res = service.download(deptContext.resolve(request), token);
        HttpHeaders headers = new HttpHeaders();
        if (res.getHeaders().getContentType() != null) {
            headers.setContentType(res.getHeaders().getContentType());
        }
        if (res.getHeaders().getContentDisposition() != null) {
            headers.setContentDisposition(res.getHeaders().getContentDisposition());
        }
        return new ResponseEntity<>(res.getBody(), headers, res.getStatusCode());
    }
}
