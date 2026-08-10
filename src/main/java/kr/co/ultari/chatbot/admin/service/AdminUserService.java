package kr.co.ultari.chatbot.admin.service;

import kr.co.ultari.chatbot.database.entity.AiDeptGrant;
import kr.co.ultari.chatbot.database.repository.AiDeptGrantRepository;
import kr.co.ultari.chatbot.hr.dto.HrUser;
import kr.co.ultari.chatbot.hr.mapper.HrUserMapper;
import lombok.RequiredArgsConstructor;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 사용자 부서 관리 서비스(간이).
 * <p>사용자 목록은 인사(HR) DB msg_user(MyBatis, 읽기 전용)에서 조회하고,
 * 부서 부여는 앱 AI_DEPT_GRANT(USER 대상)에 저장한다. 조직 단위/트리는 Phase 2에서 확장.
 */
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final HrUserMapper hrUserMapper;
    private final AiDeptGrantRepository grantRepository;

    public JSONArray getUserList() {
        return merge(hrUserMapper.selectAll());
    }

    public JSONArray search(String field, String keyword) {
        return merge(hrUserMapper.search(field, keyword));
    }

    /** 사용자 직접(USER) 부여 갱신 — 기존 USER 부여 제거 후 신규 ALLOW 추가(빈값이면 제거만). */
    @Transactional
    public String updateDept(String userId, String dept) {
        List<AiDeptGrant> existing = grantRepository.findByTargetTypeAndTargetId(AiDeptGrant.TYPE_USER, userId);
        if (!existing.isEmpty()) grantRepository.deleteAll(existing);
        if (dept != null && !dept.isBlank()) {
            AiDeptGrant g = new AiDeptGrant();
            g.setTargetType(AiDeptGrant.TYPE_USER);
            g.setTargetId(userId);
            g.setAiDept(dept);
            g.setMode(AiDeptGrant.MODE_ALLOW);
            grantRepository.save(g);
        }
        return "ok";
    }

    /** HR 사용자 목록에 사용자 직접(USER-ALLOW) 부서 부여를 병합(첫 값 표시). */
    private JSONArray merge(List<HrUser> users) {
        Map<String, List<String>> userDepts = new HashMap<>();
        for (AiDeptGrant g : grantRepository.findByTargetTypeAndMode(AiDeptGrant.TYPE_USER, AiDeptGrant.MODE_ALLOW)) {
            userDepts.computeIfAbsent(g.getTargetId(), k -> new ArrayList<>()).add(g.getAiDept());
        }
        JSONArray arr = new JSONArray();
        for (HrUser u : users) {
            List<String> depts = userDepts.get(u.getUserId());
            JSONObject o = new JSONObject();
            o.put("userId", u.getUserId());
            o.put("userName", u.getUserName() == null ? "" : u.getUserName());
            o.put("userHigh", u.getUserHigh() == null ? "" : u.getUserHigh());
            o.put("dept", (depts == null || depts.isEmpty()) ? "" : depts.get(0));
            arr.put(o);
        }
        return arr;
    }
}
