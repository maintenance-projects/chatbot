package kr.co.ultari.chatbot.user.service;

import kr.co.ultari.chatbot.common.dept.HrDirectorySnapshot;
import kr.co.ultari.chatbot.hr.dto.HrUser;
import kr.co.ultari.chatbot.hr.mapper.HrUserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 챗봇 로그인/접근 검증 — 사용자 정보는 {@link HrDirectorySnapshot}(인메모리)에서 조회한다.
 * 스냅샷이 아직 미적재(기동 직후/배치 실패)일 때만 원격 HR DB로 폴백한다.
 */
@Service
@RequiredArgsConstructor
public class UserAuthService {

    private final HrUserMapper hrUserMapper;
    private final HrDirectorySnapshot directory;

    public String login(String userId, String password) {
        if (directory.isLoaded()) {
            HrDirectorySnapshot.UserEntry e = directory.get(userId);
            if (e == null) return "NoUser";
            if (e.password() == null || !e.password().equals(password)) return "NoPassword";
            return "ok";
        }
        // 스냅샷 미적재 시에만 DB 폴백
        HrUser user = hrUserMapper.selectById(userId);
        if (user == null) return "NoUser";
        if (user.getPassword() == null || !user.getPassword().equals(password)) return "NoPassword";
        return "ok";
    }

    /** 인사(HR)에 해당 사용자 계정이 존재하는지. 챗봇 화면 직접 접근 검증용(인메모리 스냅샷). */
    public boolean exists(String userId) {
        if (userId == null || userId.isBlank()) return false;
        if (directory.isLoaded()) return directory.contains(userId);
        // 스냅샷 미적재 시에만 DB 폴백
        return hrUserMapper.selectById(userId) != null;
    }
}
