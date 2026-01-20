package kr.co.ultari.chatbot.generate.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.client.RestTemplate;

@Slf4j
@Controller
public class DefaultController {
    @RequestMapping("favicon.ico")
    @ResponseBody
    void favicon() {
        // 아무 처리 안 함
    }

    @RequestMapping("/documents/download/{key}")
    public ResponseEntity<Resource> download(@PathVariable String key) {

        log.info(key);
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
}
