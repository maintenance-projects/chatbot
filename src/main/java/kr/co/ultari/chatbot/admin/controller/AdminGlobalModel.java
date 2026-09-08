package kr.co.ultari.chatbot.admin.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ModelAttribute;

/**
 * 관리자 화면 공통 모델. GPU 모니터링 메뉴 노출 여부(gpu)를 모든 관리자 페이지에 주입한다.
 * (사이드바 {@code th:if="${gpu}"}) — 페이지별 컨트롤러 수정 없이 일괄 반영.
 */
@ControllerAdvice(basePackages = "kr.co.ultari.chatbot.admin")
public class AdminGlobalModel {

    @Value("${ultari.admin.gpu.enabled:true}")
    private boolean gpuEnabled;

    @ModelAttribute("gpu")
    public boolean gpu() {
        return gpuEnabled;
    }
}
