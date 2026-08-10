package kr.co.ultari.chatbot.common.dept;

import kr.co.ultari.chatbot.database.entity.AiDeptGrant;
import kr.co.ultari.chatbot.database.repository.AiDeptGrantRepository;
import kr.co.ultari.chatbot.hr.dto.HrPart;
import kr.co.ultari.chatbot.hr.mapper.HrPartMapper;
import kr.co.ultari.chatbot.hr.mapper.HrUserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 사용자의 AI 부서(dept) 접근 권한을 해석한다.
 * <p>허용부서 = (사용자 소속 조직들의 PART-ALLOW) ∪ (USER-ALLOW) − (USER-DENY).
 * 소속 조직은 인사DB(msg_user, 겸직 포함)에서 조회하고, 부여는 앱 AI_DEPT_GRANT에서 조회한다.
 */
@Component
@RequiredArgsConstructor
public class DeptResolver {

    private final DeptProperties props;
    private final AiDeptGrantRepository grantRepository;
    private final HrUserMapper hrUserMapper;
    private final HrPartMapper hrPartMapper;

    /** 사용자가 접근 가능한 부서 집합. */
    public Set<String> allowedDepts(String userId) {
        if (!StringUtils.hasText(userId)) {
            return Collections.emptySet();
        }
        Set<String> depts = new LinkedHashSet<>();

        // 1) 조직(PART) 상속 ALLOW — 사용자의 소속 부서 + 상위(조상) 부서까지 확장
        List<String> directParts = hrUserMapper.selectPartIdsByUser(userId);
        Set<String> parts = expandAncestors(directParts);
        if (!parts.isEmpty()) {
            for (AiDeptGrant g : grantRepository.findByTargetTypeAndTargetIdInAndMode(
                    AiDeptGrant.TYPE_PART, parts, AiDeptGrant.MODE_ALLOW)) {
                depts.add(g.getAiDept());
            }
        }

        // 2) 사용자(USER) ALLOW/DENY — DENY는 상속분까지 제외
        Set<String> userDeny = new HashSet<>();
        for (AiDeptGrant g : grantRepository.findByTargetTypeAndTargetId(AiDeptGrant.TYPE_USER, userId)) {
            if (AiDeptGrant.MODE_DENY.equals(g.getMode())) userDeny.add(g.getAiDept());
            else depts.add(g.getAiDept());
        }
        depts.removeAll(userDeny);
        return depts;
    }

    public boolean isAllowed(String userId, String dept) {
        return StringUtils.hasText(dept) && allowedDepts(userId).contains(dept);
    }

    /**
     * 요청 dept를 검증해 라우팅 부서를 결정한다.
     * 요청값이 허용되면 그대로, 아니면 허용이 1개면 자동, 그 외엔 default-dept.
     */
    public String resolve(String userId, String requestedDept) {
        Set<String> allowed = allowedDepts(userId);
        if (StringUtils.hasText(requestedDept) && allowed.contains(requestedDept)) {
            return requestedDept;
        }
        if (allowed.size() == 1) {
            return allowed.iterator().next();
        }
        return props.getDefaultDept();
    }

    /** 하위호환: 요청 dept 없이 단일 부서 결정. */
    public String resolve(String userId) {
        return resolve(userId, null);
    }

    /** 부서 집합을 상위(조상) 부서까지 확장한다(하위 상속: 상위 조직 부여가 하위에 적용되도록). */
    private Set<String> expandAncestors(Collection<String> parts) {
        Set<String> result = new HashSet<>();
        if (parts == null || parts.isEmpty()) return result;

        Map<String, String> parent = new HashMap<>();
        for (HrPart p : hrPartMapper.selectAll()) {
            parent.put(p.getPartId(), p.getPartHigh());
        }
        for (String start : new ArrayList<>(parts)) {
            String cur = start;
            int guard = 0;
            // cur가 새로 추가되는 동안 상위로 이동(순환/공유 조상 시 중단)
            while (StringUtils.hasText(cur) && result.add(cur) && guard++ < 100) {
                cur = parent.get(cur);
            }
        }
        return result;
    }
}

