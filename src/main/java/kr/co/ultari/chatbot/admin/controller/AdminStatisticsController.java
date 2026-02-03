package kr.co.ultari.chatbot.admin.controller;

import kr.co.ultari.chatbot.admin.session.AdminSession;
import kr.co.ultari.chatbot.admin.session.AdminSessionStore;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Slf4j
@Controller
@RequestMapping("/admin/statistics")
public class AdminStatisticsController {

    @Autowired
    AdminSessionStore sessionStore;
}
