package kr.co.ultari.chatbot.filesearch;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

/**
 * 첨부파일 검색 화면 서빙. API(/file-search/*)와 구분해 /filesearch/{invokeId}로 페이지를 제공한다.
 */
@Controller
public class FileSearchPageController {

    @GetMapping("/filesearch/{invokeId}")
    public String page(@PathVariable String invokeId, Model model) {
        model.addAttribute("invokeId", invokeId);
        return "filesearch";
    }
}
