package kr.co.ultari.chatbot.user.service;

import kr.co.ultari.chatbot.hr.dto.HrUser;
import kr.co.ultari.chatbot.hr.mapper.HrUserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 챗봇 로그인 — 인사(HR) DB msg_user 조회로 검증한다.
 */
@Service
@RequiredArgsConstructor
public class UserAuthService {

    private final HrUserMapper hrUserMapper;

    public String login(String userId, String password) {
        HrUser user = hrUserMapper.selectById(userId);
        if (user == null) return "NoUser";
        if (user.getPassword() == null || !user.getPassword().equals(password)) return "NoPassword";
        return "ok";
    }

    /** 인사(HR) DB에 해당 사용자 계정이 존재하는지. 챗봇 화면 직접 접근 검증용. */
    public boolean exists(String userId) {
        return userId != null && !userId.isBlank() && hrUserMapper.selectById(userId) != null;
    }
}
