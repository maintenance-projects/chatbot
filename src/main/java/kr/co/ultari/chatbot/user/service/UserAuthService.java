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
}
