package kr.co.ultari.chatbot.generate.controller;

import lombok.extern.slf4j.Slf4j;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;

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

    @RequestMapping("/csv/upload")
    public String summaryPage(@RequestParam("file") MultipartFile file, @RequestParam("sessionId") String sessionId, Model model) {
        if(StringUtils.hasText(file.getOriginalFilename())) {
            String safeFilename = Paths.get(file.getOriginalFilename()).getFileName().toString();

            // 2. 저장 경로
            Path dirPath = Paths.get(tempPath);
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
                log.error("파일 저장 실패", e);
                throw new RuntimeException("파일 저장 중 오류가 발생했습니다.", e);
            }

        }

        model.addAttribute("fileName", file.getOriginalFilename());
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

    // 테스트용
    @RequestMapping("/summary")
    public String summary() {
        return "summary";
    }
}
