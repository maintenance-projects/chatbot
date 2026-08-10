package kr.co.ultari.chatbot.admin.service;

import kr.co.ultari.chatbot.database.entity.AiUserDept;
import kr.co.ultari.chatbot.database.repository.AiUserDeptRepository;
import kr.co.ultari.chatbot.hr.dto.HrUser;
import kr.co.ultari.chatbot.hr.mapper.HrUserMapper;
import lombok.RequiredArgsConstructor;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 사용자 부서 관리 서비스.
 * <p>사용자 목록은 인사(HR) DB msg_user에서 조회(MyBatis, 읽기 전용)하고,
 * AI 부서 지정은 앱 소유 AI_USER_DEPT 테이블에 저장한다(인사DB는 쓰지 않음).
 */
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final HrUserMapper hrUserMapper;
    private final AiUserDeptRepository deptRepository;

    public JSONArray getUserList() {
        return merge(hrUserMapper.selectAll());
    }

    public JSONArray search(String field, String keyword) {
        return merge(hrUserMapper.search(field, keyword));
    }

    /** 사용자 → AI 부서 지정(upsert). dept가 비면 매핑 삭제. */
    @Transactional
    public String updateDept(String userId, String dept) {
        if (dept == null || dept.isBlank()) {
            deptRepository.deleteById(userId);
            return "ok";
        }
        AiUserDept m = deptRepository.findById(userId).orElseGet(() -> {
            AiUserDept n = new AiUserDept();
            n.setUserId(userId);
            return n;
        });
        m.setAiDept(dept);
        deptRepository.save(m);
        return "ok";
    }

    /** HR 사용자 목록에 앱 매핑(AI_USER_DEPT)의 부서값을 병합한다. */
    private JSONArray merge(List<HrUser> users) {
        Map<String, String> deptMap = new HashMap<>();
        for (AiUserDept d : deptRepository.findAll()) {
            deptMap.put(d.getUserId(), d.getAiDept());
        }
        JSONArray arr = new JSONArray();
        for (HrUser u : users) {
            JSONObject o = new JSONObject();
            o.put("userId", u.getUserId());
            o.put("userName", u.getUserName() == null ? "" : u.getUserName());
            o.put("userHigh", u.getUserHigh() == null ? "" : u.getUserHigh());
            o.put("dept", deptMap.getOrDefault(u.getUserId(), ""));
            arr.put(o);
        }
        return arr;
    }
}
