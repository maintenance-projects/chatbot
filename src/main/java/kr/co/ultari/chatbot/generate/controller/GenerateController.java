package kr.co.ultari.chatbot.generate.controller;

import lombok.extern.slf4j.Slf4j;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

@RequestMapping("/chatbot")
@Controller
@Slf4j
public class GenerateController {

    @RequestMapping("/{key}")
    public String login(Model model, @PathVariable("key") String sessionId) {
        JSONArray templateList = new JSONArray();
        JSONObject templateObject = new JSONObject();

        templateList.put(createTemplate("A001", "template.hwpx", "결재보고","000001"));
        templateList.put(createTemplate("A002", "template2.hwpx", "공지사항","000002"));

        model.addAttribute("sessionId",sessionId);
        model.addAttribute("templateList", templateList);
        return "dialog";
    }

    protected JSONObject createTemplate(String key, String fileName, String name, String sort) {
        JSONObject json = new JSONObject();
        json.put("key",key);
        json.put("fileName",fileName);
        json.put("name",name);
        json.put("sort",sort);
        return json;
    }

    /*@RequestMapping("/dialog")
    public String dialog() {
        return "dialog";
    }*/
}
