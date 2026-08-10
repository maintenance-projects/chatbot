package kr.co.ultari.chatbot.admin.service;

import kr.co.ultari.chatbot.database.entity.AiDeptGrant;
import kr.co.ultari.chatbot.database.repository.AiDeptGrantRepository;
import kr.co.ultari.chatbot.hr.dto.HrPart;
import kr.co.ultari.chatbot.hr.dto.HrUser;
import kr.co.ultari.chatbot.hr.mapper.HrPartMapper;
import kr.co.ultari.chatbot.hr.mapper.HrUserMapper;
import lombok.RequiredArgsConstructor;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 사용자 부서 관리 서비스. 인사(HR) DB(msg_part/msg_user)를 조회해 조직도 트리를 제공하고,
 * dept별 접근 권한(조직/사용자, ALLOW/DENY)을 앱 AI_DEPT_GRANT에 저장한다.
 */
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final HrPartMapper hrPartMapper;
    private final HrUserMapper hrUserMapper;
    private final AiDeptGrantRepository grantRepository;

    /**
     * 조직도 트리 + 특정 dept의 부여 상태.
     * { parts:[{partId,partHigh,partName}], users:[{userId,userName,userHigh}],
     *   grants:{ parts:[partId..(ALLOW)], usersAllow:[userId..], usersDeny:[userId..] } }
     */
    public JSONObject tree(String dept) {
        JSONObject root = new JSONObject();

        JSONArray parts = new JSONArray();
        for (HrPart p : hrPartMapper.selectAll()) {
            parts.put(new JSONObject()
                    .put("partId", nz(p.getPartId()))
                    .put("partHigh", nz(p.getPartHigh()))
                    .put("partName", nz(p.getPartName())));
        }
        JSONArray users = new JSONArray();
        for (HrUser u : hrUserMapper.selectAll()) {
            users.put(new JSONObject()
                    .put("userId", nz(u.getUserId()))
                    .put("userName", nz(u.getUserName()))
                    .put("userHigh", nz(u.getUserHigh())));
        }

        JSONArray grantParts = new JSONArray();
        JSONArray usersAllow = new JSONArray();
        JSONArray usersDeny = new JSONArray();
        for (AiDeptGrant g : grantRepository.findByAiDept(dept)) {
            if (AiDeptGrant.TYPE_PART.equals(g.getTargetType())) {
                if (AiDeptGrant.MODE_ALLOW.equals(g.getMode())) grantParts.put(g.getTargetId());
            } else if (AiDeptGrant.TYPE_USER.equals(g.getTargetType())) {
                if (AiDeptGrant.MODE_DENY.equals(g.getMode())) usersDeny.put(g.getTargetId());
                else usersAllow.put(g.getTargetId());
            }
        }

        root.put("parts", parts);
        root.put("users", users);
        root.put("grants", new JSONObject()
                .put("parts", grantParts)
                .put("usersAllow", usersAllow)
                .put("usersDeny", usersDeny));
        return root;
    }

    /**
     * 권한 부여 적용. action: ALLOW | DENY | REMOVE.
     * (같은 대상+dept의 기존 행을 정리하고 해당 상태로 설정)
     */
    @Transactional
    public String applyGrant(String dept, String targetType, String targetId, String action) {
        List<AiDeptGrant> existing =
                grantRepository.findByTargetTypeAndTargetIdAndAiDept(targetType, targetId, dept);
        if (!existing.isEmpty()) grantRepository.deleteAll(existing);

        if ("REMOVE".equals(action)) return "ok";

        String mode = "DENY".equals(action) ? AiDeptGrant.MODE_DENY : AiDeptGrant.MODE_ALLOW;
        AiDeptGrant g = new AiDeptGrant();
        g.setTargetType(targetType);
        g.setTargetId(targetId);
        g.setAiDept(dept);
        g.setMode(mode);
        grantRepository.save(g);
        return "ok";
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }
}
