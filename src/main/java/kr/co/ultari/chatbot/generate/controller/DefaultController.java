package kr.co.ultari.chatbot.generate.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Path;
import java.nio.file.Paths;

@Slf4j
@Controller
public class DefaultController {

    /** 업로드 문서 보관 경로(PDF 페이지 보기용). ChatService.upload와 동일 경로. */
    @Value("${ultari.ai.document.path:documents}")
    String documentPath;

    @RequestMapping("favicon.ico")
    @ResponseBody
    void favicon() {
        // 아무 처리 안 함
    }

    // 문서 다운로드(/documents/download/{token})는 dept-aware DocGenController로 이관됨.

    @GetMapping("/document/view/{sessionId}/{fileName}")
    public ResponseEntity<Resource> viewDocument(@PathVariable("fileName") String fileName, @PathVariable("sessionId") String sessionId) {

        log.debug(fileName);
        log.debug(sessionId);

        // 경로 탈출 방지: 파일명/세션ID는 단일 세그먼트만 허용(디렉터리 구분자·상위경로 제거) + base 하위 확인
        String safeName = Paths.get(fileName).getFileName().toString();
        String safeSid = Paths.get(sessionId).getFileName().toString();
        Path base = Paths.get(documentPath).toAbsolutePath().normalize();
        Path path = base.resolve(safeSid).resolve(safeName).normalize();
        if (!path.startsWith(base)) {
            log.debug("[document view] 잘못된 경로 접근: sessionId={}, fileName={}", sessionId, fileName);
            return ResponseEntity.badRequest().build();
        }
        if (!java.nio.file.Files.isRegularFile(path)) {
            return ResponseEntity.notFound().build();
        }

        String ext = safeName.substring(safeName.lastIndexOf(".") + 1).toLowerCase();
        Resource resource = new FileSystemResource(path);

        MediaType mediaType;
        String disposition = "attachment";

        switch (ext) {
            case "pdf":
                mediaType = MediaType.APPLICATION_PDF;
                disposition = "inline";
                break;

            case "txt":
                mediaType = MediaType.TEXT_PLAIN;
                disposition = "inline";
                break;

            case "csv":
                mediaType = MediaType.parseMediaType("text/csv");
                disposition = "inline";
                break;

            case "docx":
                mediaType = MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
                break;

            case "xlsx":
                mediaType = MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                break;

            case "pptx":
                mediaType = MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.presentationml.presentation");
                break;

            case "hwp":
            case "hwpx":
                mediaType = MediaType.APPLICATION_OCTET_STREAM;
                break;

            default:
                mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }

        // 한글 등 non-ASCII 파일명은 RFC 5987(filename*=UTF-8'')로 인코딩.
        // 원문 그대로 넣으면 Tomcat이 헤더를 ISO-8859-1로 인코딩하지 못해(UnmappableCharacterException)
        // Content-Disposition 헤더를 통째로 제거(WARN)하므로 반드시 인코딩해야 한다.
        ContentDisposition contentDisposition = ContentDisposition
                .builder(disposition)
                .filename(safeName, StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString())
                .body(resource);
    }
}
