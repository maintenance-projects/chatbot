package kr.co.ultari.chatbot.generate.controller;

import lombok.extern.slf4j.Slf4j;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.nio.file.Path;
import java.nio.file.Paths;

@RequestMapping("/chatbot")
@Controller
@Slf4j
public class GenerateController {

    @Value("${ultari.ai.temp.path:tmp}")
    String tempPath;

    @RequestMapping("/{key}")
    public String login(Model model, @PathVariable("key") String sessionId) {
        JSONArray templateList = new JSONArray();
        JSONObject templateObject = new JSONObject();

        templateList.put(createTemplate("A001", "template.hwpx", "결재보고","000001"));
        templateList.put(createTemplate("A002", "template2.hwpx", "공지사항","000002"));

        log.debug(templateList.toString());
        model.addAttribute("sessionId",sessionId);
        model.addAttribute("templateList", templateList.toString());
        return "dialog";
    }

    @GetMapping("/document/view/{fileName}")
    public ResponseEntity<Resource> viewDocument(@PathVariable String fileName) {

        log.debug(fileName);
        String ext = fileName.substring(fileName.lastIndexOf(".")+1).toLowerCase();

        Path path = Paths.get(tempPath, fileName);
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

    protected JSONObject createTemplate(String key, String fileName, String name, String sort) {
        JSONObject json = new JSONObject();
        json.put("key",key);
        json.put("fileName",fileName);
        json.put("name",name);
        json.put("sort",sort);
        return json;
    }

    @RequestMapping("/documents/download/{key}")
    public ResponseEntity<Resource> download(@PathVariable String key) {

        String targetUrl = "http://10.0.0.92:8000/documents/download/" + key;

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

    /*@RequestMapping("/dialog")
    public String dialog() {
        return "dialog";
    }*/
}
