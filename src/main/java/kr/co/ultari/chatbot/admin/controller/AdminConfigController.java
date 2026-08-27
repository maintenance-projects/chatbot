package kr.co.ultari.chatbot.admin.controller;

import kr.co.ultari.chatbot.admin.service.AdminConfigService;
import kr.co.ultari.chatbot.database.entity.AiConfig;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

@Slf4j
@Controller
@RequestMapping("/at-i/config")
public class AdminConfigController {

    private final AdminConfigService configService;

    public AdminConfigController(AdminConfigService configService) {
        this.configService = configService;
    }

    @PostMapping("/load")
    @ResponseBody
    public String load() {
        AiConfig c = configService.getConfig();
        JSONObject obj = new JSONObject();
        obj.put("temperature", c.getTemperature() != null ? c.getTemperature() : 5);
        obj.put("userPrompt", c.getUserPrompt() != null ? c.getUserPrompt() : "");
        obj.put("docRetentionDays", c.getDocRetentionDays() != null ? c.getDocRetentionDays() : 7);
        return obj.toString();
    }

    @PostMapping("/save")
    @ResponseBody
    public String save(@RequestParam("temperature") int temperature,
                       @RequestParam(value = "userPrompt", defaultValue = "") String userPrompt,
                       @RequestParam("docRetentionDays") int docRetentionDays) {
        log.debug("[config save] temperature={}, docRetentionDays={}", temperature, docRetentionDays);
        configService.save(temperature, userPrompt, docRetentionDays);
        return "ok";
    }
}
