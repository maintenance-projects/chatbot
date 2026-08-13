package kr.co.ultari.chatbot.attach;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * 메신저 첨부파일 등록 API. 메신저 클라이언트가 로컬 파일을 직접 multipart POST 하면
 * 개인(dept-less) 게이트웨이 업로드로 릴레이한다.
 * <p><b>접수 후 비동기(옵션 C)</b>: 파일을 접수(서버 임시 적재)하면 즉시 202를 반환하고,
 * 게이트웨이 릴레이는 백그라운드에서 수행한다(완료를 기다리지 않음).
 * <p>인증/신원 검증은 후속 보안 작업에서 추가한다(현재 ownerId를 파라미터로 신뢰).
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class AttachController {

    private final AttachService attachService;

    /** 메신저 첨부 등록: 접수 즉시 202 반환, 릴레이는 백그라운드 */
    @PostMapping(value = "/chatbot/attach", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> attach(@RequestParam("ownerId") String ownerId,
                                         @RequestParam(value = "attachFile_name", required = false) String attachFileName,
                                         @RequestParam("attachFile_bin") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body("{\"responseCode\":\"1111\",\"message\":\"업로드할 파일이 없습니다.\"}");
        }
        try {
            attachService.registerAsync(ownerId, attachFileName, file);
        } catch (Exception e) {
            log.error("[attach] 접수 실패 ownerId={}, file={}", ownerId, file.getOriginalFilename(), e);
            return ResponseEntity.internalServerError()
                    .body("{\"responseCode\":\"1111\",\"message\":\"파일 접수 중 오류가 발생했습니다.\"}");
        }
        // 202 Accepted — 접수 완료(게이트웨이 등록은 백그라운드 진행)
        return ResponseEntity.accepted().body("{\"responseCode\":\"0000\"}");
    }
}
