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

    @PostMapping("/v2/generate")
    @ResponseBody
    public String generate(@RequestBody RequestDTO dto) {
        return generateService.request(dto);
    }

    @PostMapping("/generate")
    @ResponseBody
    public String generateTest(@RequestBody String dto) throws Exception {
        log.info(dto);
        JSONObject json = new JSONObject(dto);
        json.put("model","qwen2.5:7b");
        json.put("stream",false);
        JSONObject rtn = new JSONObject(generateService.requestTest(json));
        log.info(rtn.toString());
        return rtn.toString();
    }

    @RequestMapping("/dialog")
    public String dialog() {
        return "dialog";
    }
}
