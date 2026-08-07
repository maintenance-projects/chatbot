package kr.co.ultari.chatbot.pkb;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

/**
 * PKB(개인 지식 저장소) 화면 서빙. API(/pkb/{ownerId}/*)와 구분해 /mypkb/{ownerId}로 페이지를 제공한다.
 */
@Controller
public class PkbPageController {

    @GetMapping("/mypkb/{ownerId}")
    public String page(@PathVariable String ownerId, Model model) {
        model.addAttribute("ownerId", ownerId);
        return "pkb";
    }
}
