package kr.co.ultari.chatbot.generate.controller;

import kr.co.ultari.chatbot.generate.datamodel.dto.RequestDTO;
import kr.co.ultari.chatbot.generate.service.GenerateService;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

@RequestMapping("/chatbot")
@Controller
@Slf4j
public class GenerateController {

    @Autowired
    GenerateService generateService;

    @PostMapping("/generate")
    @ResponseBody
    public String generate(@RequestBody RequestDTO dto) {
        return generateService.request(dto);
    }

    @PostMapping("/test/generate")
    @ResponseBody
    public String generateTest(@RequestBody String dto) throws Exception {
        log.info(dto);
        JSONObject json = new JSONObject(generateService.requestTest(new JSONObject(dto)));
        log.info(json.toString());
        return json.toString();
    }

    @RequestMapping("/dialog")
    public String dialog() {
        return "dialog";
    }
}
