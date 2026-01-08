package kr.co.ultari.chatbot.generate.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

@RequestMapping("/chatbot")
@Controller
@Slf4j
public class GenerateController {

    @RequestMapping("/{key}")
    public String login(Model model, @PathVariable("key") String sessionId) {
        model.addAttribute("sessionId",sessionId);
        return "dialog";
    }

    /*@RequestMapping("/dialog")
    public String dialog() {
        return "dialog";
    }*/
}
