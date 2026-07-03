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
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import javax.servlet.http.HttpServletRequest;

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

    public GenerateController(UserAuthService userAuthService, AIRelayService relayService) {
        this.userAuthService = userAuthService;
        this.relayService = relayService;
    }

    @GetMapping("")
    public String loginPage(@RequestParam(value = "error", required = false) String error, Model model) {
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
    public String login(Model model, @PathVariable("key") String sessionId, HttpServletRequest request) {
        JSONArray templateList = new JSONArray();
        JSONObject templateObject = new JSONObject();

        templateList.put(createTemplate("A001", "template.hwpx", "결재보고","000001"));
        templateList.put(createTemplate("A002", "template2.hwpx", "공지사항","000002"));
        templateList.put(createTemplate("A003", "template3.hwpx", "회의록","000003"));

        log.debug(templateList.toString());
        model.addAttribute("sessionId",sessionId);
        model.addAttribute("templateList", templateList.toString());
        return "dialog";
    }

    @RequestMapping("/csv/upload")
    public ResponseEntity<String> summaryPage(@RequestParam("file") MultipartFile file, @RequestParam("sessionId") String sessionId) {
        String code = "0000";
        if(StringUtils.hasText(file.getOriginalFilename())) {
            String safeFilename = Paths.get(file.getOriginalFilename()).getFileName().toString();

            File f = new File(tempPath + File.separator + sessionId + File.separator + "dialog");
            if(!f.exists()) f.mkdirs();
            // 2. 저장 경로
            Path dirPath = Paths.get(f.getPath());
            Path filePath = dirPath.resolve(safeFilename);

            try {
                // 3. 파일 저장 (덮어쓰기)
                Files.copy(
                        file.getInputStream(),
                        filePath,
                        StandardCopyOption.REPLACE_EXISTING
                );

                log.info("파일 저장 완료: {}", filePath);

            } catch (IOException e) {
                code="1111";
                log.error("파일 저장 실패", e);
                throw new RuntimeException("파일 저장 중 오류가 발생했습니다.", e);
            }

        }

        //model.addAttribute("fileName", file.getOriginalFilename());
        //model.addAttribute("sessionId", sessionId);

        String openUrl = summaryUrl+"?fileName="+URLEncoder.encode(file.getOriginalFilename())+"&sessionId="+URLEncoder.encode(sessionId);

        JSONObject json = new JSONObject();
        json.put("responseCode",code);
        if(code.equals("0000")) {
            json.put("openUrl", openUrl);
        }
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
    public String summaryPage(@RequestParam("fileName") String fileName, @RequestParam("sessionId") String sessionId, Model model) {
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
