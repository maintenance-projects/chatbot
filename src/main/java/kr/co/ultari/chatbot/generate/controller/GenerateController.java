package kr.co.ultari.chatbot.generate.controller;

import lombok.extern.slf4j.Slf4j;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import kr.co.ultari.chatbot.user.service.UserAuthService;
import kr.co.ultari.chatbot.generate.service.AIRelayService;

import java.io.File;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import jakarta.servlet.http.HttpServletRequest;

@RequestMapping("/chatbot")
@Controller
@Slf4j
public class GenerateController {

    @Value("${ultari.ai.temp.path:tmp}")
    String tempPath;

    @Value("${ultari.interface-summary.url:}")
    String summaryUrl;

    private final UserAuthService userAuthService;

    private final AIRelayService relayService;

    private final kr.co.ultari.chatbot.generate.ChatbotMenuProperties menuProperties;

    private final kr.co.ultari.chatbot.generate.ChatbotLoginCrypto loginCrypto;

    public GenerateController(UserAuthService userAuthService, AIRelayService relayService,
                              kr.co.ultari.chatbot.generate.ChatbotMenuProperties menuProperties,
                              kr.co.ultari.chatbot.generate.ChatbotLoginCrypto loginCrypto) {
        this.userAuthService = userAuthService;
        this.relayService = relayService;
        this.menuProperties = menuProperties;
        this.loginCrypto = loginCrypto;
    }

    @GetMapping("")
    public String loginPage(@RequestParam(value = "key", required = false) String key,
                            @RequestParam(value = "error", required = false) String error,
                            Model model, HttpServletRequest request,
                            jakarta.servlet.http.HttpServletResponse response) {
        // 암호화 진입: /chatbot?key=... (쿼리 파라미터). 표준 Base64의 '/'(%2F)가 경로에선 톰캣에
        // 400으로 막히므로, key를 경로 대신 쿼리로 받는다. 로직은 /{key} 핸들러와 동일하게 재사용.
        if (StringUtils.hasText(key)) {
            return login(model, key, request, response);
        }
        model.addAttribute("error", error);
        return "chatbot-login";
    }

    @PostMapping("/login")
    @ResponseBody
    public String login(@RequestBody ChatbotLoginRequest request, HttpServletRequest httpRequest) {
        String rtn = userAuthService.login(request.getUserId(), request.getPassword());
        if ("ok".equals(rtn)) {
            httpRequest.getSession(true)
                    .setAttribute("chatbotUserId", request.getUserId());
        }
        return rtn;
    }

    @RequestMapping("/{key}")
    public String login(Model model, @PathVariable("key") String key, HttpServletRequest request,
                        jakarta.servlet.http.HttpServletResponse response) {
        // 암호화 로그인 활성 시 key=AES256(아이디|yyyyMMddHHmmss) → 복호화·시각(±5분,KST)검증 후 아이디.
        // 비활성 시 key=평문 아이디(기존 동작). 복호화/시각 검증 실패면 null → 접근 거부.
        String sessionId = loginCrypto.resolveUserId(key);
        if (!StringUtils.hasText(sessionId)) {
            log.debug("[chatbot access denied] invalid/expired token (encryptEnabled={})", loginCrypto.isEnabled());
            response.setStatus(jakarta.servlet.http.HttpServletResponse.SC_FORBIDDEN);
            return "error";
        }
        // 인사(HR) DB에 존재하는 사용자만 챗봇 화면 진입 허용. 없으면 '잘못된 접근' 안내.
        if (!userAuthService.exists(sessionId)) {
            log.debug("[chatbot access denied] unknown userId={}", sessionId);
            response.setStatus(jakarta.servlet.http.HttpServletResponse.SC_FORBIDDEN);
            return "error";
        }

        JSONArray templateList = new JSONArray();
        JSONObject templateObject = new JSONObject();

        templateList.put(createTemplate("A001", "template.hwpx", "결재보고","000001"));
        templateList.put(createTemplate("A002", "template2.hwpx", "공지사항","000002"));
        templateList.put(createTemplate("A003", "template3.hwpx", "회의록","000003"));

        log.debug(templateList.toString());
        // 화면 URL key로 세션 신원을 확립 → 로그인 세션 소실(재기동 등)에도 dept 스위처/라우팅 복구
        if (sessionId != null && !sessionId.isBlank()) {
            request.getSession(true).setAttribute("chatbotUserId", sessionId);
        }
        model.addAttribute("sessionId",sessionId);
        model.addAttribute("templateList", templateList.toString());
        // 하단 도구 메뉴 노출 제어(서버 환경설정 전용)
        model.addAttribute("menuUpload", menuProperties.isUpload());
        model.addAttribute("menuDocs", menuProperties.isDocs());
        model.addAttribute("menuTemplate", menuProperties.isTemplate());
        model.addAttribute("menuTranslate", menuProperties.isTranslate());
        model.addAttribute("menuPkb", menuProperties.isPkb());
        return "dialog";
    }

    @PostMapping("/csv/upload")
    public ResponseEntity<String> summaryPage(@RequestParam("file") MultipartFile file, @RequestParam("sessionId") String sessionId) {
        String original = file.getOriginalFilename();
        if (!StringUtils.hasText(original)) {
            JSONObject error = new JSONObject();
            error.put("responseCode", "1111");
            error.put("message", "업로드할 파일이 없습니다.");
            return ResponseEntity.ok(error.toString());
        }
        // 경로 탈출 방지: 파일명은 단일 세그먼트만
        String safeFilename = Paths.get(original).getFileName().toString();

        File f = new File(tempPath + File.separator + sessionId + File.separator + "dialog");
        if (!f.exists()) f.mkdirs();
        Path filePath = Paths.get(f.getPath()).resolve(safeFilename);

        try {
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);
            log.info("파일 저장 완료: {}", filePath);
        } catch (IOException e) {
            log.error("파일 저장 실패", e);
            throw new RuntimeException("파일 저장 중 오류가 발생했습니다.", e);
        }

        // 저장한 안전 파일명 기준으로 openUrl 구성(UTF-8 인코딩)
        String openUrl = summaryUrl
                + "?fileName=" + URLEncoder.encode(safeFilename, StandardCharsets.UTF_8)
                + "&sessionId=" + URLEncoder.encode(sessionId, StandardCharsets.UTF_8);

        JSONObject json = new JSONObject();
        json.put("responseCode", "0000");
        json.put("openUrl", openUrl);
        return ResponseEntity.ok(json.toString());
    }

    @PostMapping("/file/upload")
    @ResponseBody
    public ResponseEntity<String> fileUpload(@RequestParam("file") MultipartFile file, @RequestParam("sessionId") String sessionId) {
        String code = "0000";

        if(!StringUtils.hasText(file.getOriginalFilename()) || file.isEmpty()) {
            JSONObject error = new JSONObject();
            error.put("responseCode", "1111");
            error.put("message", "업로드할 파일이 없습니다.");
            return ResponseEntity.ok(error.toString());
        }

        try {
            // 메신저 첨부파일을 AI 게이트웨이에 사전 등록 (추론 없이 파일만 업로드)
            relayService.uploadFile(sessionId, file);
            log.info("AI 파일 업로드 완료: sessionId={}, fileName={}", sessionId, file.getOriginalFilename());
        } catch (Exception e) {
            code = "1111";
            log.error("AI 파일 업로드 실패: sessionId={}, fileName={}", sessionId, file.getOriginalFilename(), e);
        }

        JSONObject json = new JSONObject();
        json.put("responseCode", code);
        return ResponseEntity.ok(json.toString());
    }

    @PostMapping("/summary")
    public String summaryPage(@RequestParam(value = "fileName", required = false) String fileName, @RequestParam("sessionId") String sessionId, Model model) {
        log.debug("[summary debug] fileName={}, userId={}", fileName, sessionId);
        if(fileName == null || fileName.isEmpty()) fileName = "summary.csv";
        model.addAttribute("fileName", fileName);
        model.addAttribute("sessionId", sessionId);
        return "summary";
    }

    protected JSONObject createTemplate(String key, String fileName, String name, String sort) {
        JSONObject json = new JSONObject();
        json.put("key",key);
        json.put("fileName",fileName);
        json.put("name",name);
        json.put("sort",sort);
        return json;
    }

    // ?�스?�용
    @RequestMapping("/summary")
    public String summary() {
        return "summary";
    }
}
