package kr.co.ultari.chatbot.generate.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;

@Slf4j
@Controller
public class DefaultController {

    @Value("${ultari.ai.temp.path:tmp}")
    String tempPath;

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
        String ext = fileName.substring(fileName.lastIndexOf(".")+1).toLowerCase();

        Path path = Paths.get(tempPath + File.separator + sessionId + File.separator + "document", fileName);
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

        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        disposition + "; filename=\"" + fileName + "\"")
                .body(resource);
    }
}
