package kr.co.ultari.chatbot.generate.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

@Controller
public class DefaultController {
    @RequestMapping("favicon.ico")
    @ResponseBody
    void favicon() {
        // 아무 처리 안 함
    }
}
