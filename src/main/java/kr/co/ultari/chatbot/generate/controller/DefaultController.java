package kr.co.ultari.chatbot.generate.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;

@Slf4j
@Controller
public class DefaultController {

    @Value("${ultari.ai.temp.path:tmp}")
    String tempPath;

    @Value("${ultari.ai-gateway.download-url:http://10.0.0.111:8000/documents/download}")
    String AI_DOWNLOAD_URL;

    @RequestMapping("favicon.ico")
    @ResponseBody
    void favicon() {
        // 아무 처리 안 함
    }

    @RequestMapping("/documents/download/{key}")
    public ResponseEntity<Resource> download(@PathVariable String key) {

        log.info(key);
        String targetUrl = AI_DOWNLOAD_URL + "/" + key;

        RestTemplate restTemplate = new RestTemplate();

        ResponseEntity<byte[]> response =
                restTemplate.getForEntity(targetUrl, byte[].class);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(
                response.getHeaders().getContentType()
        );
        headers.setContentDisposition(
                response.getHeaders().getContentDisposition()
        );

        return new ResponseEntity<>(
                new ByteArrayResource(response.getBody()),
                headers,
                HttpStatus.OK
        );
    }

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
