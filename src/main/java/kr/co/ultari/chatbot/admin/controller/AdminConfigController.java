package kr.co.ultari.chatbot.admin.controller;

import kr.co.ultari.chatbot.admin.service.AdminConfigService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import java.nio.charset.StandardCharsets;

/**
 * 관리자 환경설정 — 게이트웨이 {@code /admin/settings} 프록시.
 * 프론트와 게이트웨이가 동일 JSON 계약({@code file_ttl_days, temperature, system_prompt})을 공유한다.
 */
@Slf4j
@Controller
@RequestMapping("/at-i/config")
public class AdminConfigController {

    private final AdminConfigService configService;

    public AdminConfigController(AdminConfigService configService) {
        this.configService = configService;
    }

    /** application/json;charset=UTF-8 — 게이트웨이 응답에 charset이 없어 브라우저가 오해석하지 않도록 명시. */
    private static final MediaType JSON_UTF8 = new MediaType(MediaType.APPLICATION_JSON, StandardCharsets.UTF_8);

    /** 설정 조회 — 게이트웨이 응답을 상태코드·본문째 통과(Content-Type만 UTF-8 명시). */
    @PostMapping("/load")
    @ResponseBody
    public ResponseEntity<String> load() {
        return withUtf8(configService.getSettings());
    }

    /** 설정 저장 — 프론트 JSON을 게이트웨이로 전달, 응답 통과(Content-Type UTF-8 명시). */
    @PostMapping("/save")
    @ResponseBody
    public ResponseEntity<String> save(@RequestBody(required = false) String jsonBody) {
        log.debug("[config save] body={}", jsonBody);
        return withUtf8(configService.saveSettings(jsonBody));
    }

    /** 게이트웨이 응답의 상태코드·본문은 유지하고 Content-Type을 UTF-8로 명시해 재포장. */
    private ResponseEntity<String> withUtf8(ResponseEntity<String> res) {
        return ResponseEntity.status(res.getStatusCode())
                .contentType(JSON_UTF8)
                .body(res.getBody());
    }
}
