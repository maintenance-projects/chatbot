package kr.co.ultari.chatbot.admin.service;

import kr.co.ultari.chatbot.common.dept.DeptResolver;
import kr.co.ultari.chatbot.common.dept.HrDirectorySnapshot;
import kr.co.ultari.chatbot.database.entity.AiDeptGrant;
import kr.co.ultari.chatbot.database.entity.AiPartitionGrant;
import kr.co.ultari.chatbot.database.repository.AiDeptGrantRepository;
import kr.co.ultari.chatbot.database.repository.AiPartitionGrantRepository;
import kr.co.ultari.chatbot.hr.dto.HrPart;
import kr.co.ultari.chatbot.hr.dto.HrUser;
import kr.co.ultari.chatbot.hr.mapper.HrPartMapper;
import kr.co.ultari.chatbot.hr.mapper.HrUserMapper;
import lombok.RequiredArgsConstructor;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Map;

/**
 * 사용자 권한 관리 서비스. 인사(HR) DB(msg_part/msg_user)를 조회해 조직도 트리를 제공하고,
 * 벡터DB(dept)별 접근 권한(조직/사용자, ALLOW/DENY)을 앱 AI_DEPT_GRANT에 저장한다.
 */
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final HrPartMapper hrPartMapper;
    private final HrUserMapper hrUserMapper;
    private final AiDeptGrantRepository grantRepository;
    private final AiPartitionGrantRepository partitionGrantRepository;
    private final DeptResolver deptResolver;
    private final HrDirectorySnapshot hrDirectory;

    /**
     * 조직도 트리 + 부여 상태. partition이 비면 벡터DB 접근 권한(AI_DEPT_GRANT),
     * 값이 있으면 그 파티션 접근 권한(AI_PARTITION_GRANT) 기준으로 grants를 구성한다.
     * { parts:[{partId,partHigh,partName}], users:[{userId,userName,userHigh}],
     *   grants:{ parts:[partId..(ALLOW)], usersAllow:[userId..], usersDeny:[userId..] } }
     */
    public JSONObject tree(String dept, String partition) {
        JSONObject root = new JSONObject();

        JSONArray parts = new JSONArray();
        JSONArray users = new JSONArray();
        // 조직도·사용자는 인메모리 스냅샷에서 구성(원격 HR 조회 회피). 미적재 시에만 DB 폴백.
        if (hrDirectory.isLoaded()) {
            for (HrPart p : hrDirectory.partList()) {
                parts.put(new JSONObject()
                        .put("partId", nz(p.getPartId()))
                        .put("partHigh", nz(p.getPartHigh()))
                        .put("partName", nz(p.getPartName())));
            }
            // 사용자는 소속부서(겸직/복수)별로 한 행씩 펼쳐 기존 DB 목록과 동일한 형태로 구성
            for (Map.Entry<String, HrDirectorySnapshot.UserEntry> e : hrDirectory.userMap().entrySet()) {
                String uid = e.getKey();
                HrDirectorySnapshot.UserEntry ue = e.getValue();
                List<String> pids = ue.partIds();
                if (pids == null || pids.isEmpty()) {
                    users.put(new JSONObject()
                            .put("userId", nz(uid)).put("userName", nz(ue.userName())).put("userHigh", ""));
                } else {
                    for (String pid : pids) {
                        users.put(new JSONObject()
                                .put("userId", nz(uid)).put("userName", nz(ue.userName())).put("userHigh", nz(pid)));
                    }
                }
            }
        } else {
            for (HrPart p : hrPartMapper.selectAll()) {
                parts.put(new JSONObject()
                        .put("partId", nz(p.getPartId()))
                        .put("partHigh", nz(p.getPartHigh()))
                        .put("partName", nz(p.getPartName())));
            }
            for (HrUser u : hrUserMapper.selectAll()) {
                users.put(new JSONObject()
                        .put("userId", nz(u.getUserId()))
                        .put("userName", nz(u.getUserName()))
                        .put("userHigh", nz(u.getUserHigh())));
            }
        }

        JSONArray grantParts = new JSONArray();
        JSONArray usersAllow = new JSONArray();
        JSONArray usersDeny = new JSONArray();
        if (StringUtils.hasText(partition)) {
            // 파티션 접근 권한(AI_PARTITION_GRANT)
            for (AiPartitionGrant g : partitionGrantRepository.findByAiDeptAndPartitionName(dept, partition)) {
                if (AiPartitionGrant.TYPE_PART.equals(g.getTargetType())) {
                    if (AiPartitionGrant.MODE_ALLOW.equals(g.getMode())) grantParts.put(g.getTargetId());
                } else if (AiPartitionGrant.TYPE_USER.equals(g.getTargetType())) {
                    if (AiPartitionGrant.MODE_DENY.equals(g.getMode())) usersDeny.put(g.getTargetId());
                    else usersAllow.put(g.getTargetId());
                }
            }
        } else {
            // 벡터DB 접근 권한(AI_DEPT_GRANT)
            for (AiDeptGrant g : grantRepository.findByAiDept(dept)) {
                if (AiDeptGrant.TYPE_PART.equals(g.getTargetType())) {
                    if (AiDeptGrant.MODE_ALLOW.equals(g.getMode())) grantParts.put(g.getTargetId());
                } else if (AiDeptGrant.TYPE_USER.equals(g.getTargetType())) {
                    if (AiDeptGrant.MODE_DENY.equals(g.getMode())) usersDeny.put(g.getTargetId());
                    else usersAllow.put(g.getTargetId());
                }
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
     * partition이 비면 벡터DB 접근 권한(AI_DEPT_GRANT), 값이 있으면 파티션 권한(AI_PARTITION_GRANT).
     * (같은 대상+dept(+파티션)의 기존 행을 정리하고 해당 상태로 설정)
     */
    @Transactional
    public String applyGrant(String dept, String partition, String targetType, String targetId, String action) {
        if (StringUtils.hasText(partition)) {
            return applyPartitionGrant(dept, partition, targetType, targetId, action);
        }

        List<AiDeptGrant> existing =
                grantRepository.findByTargetTypeAndTargetIdAndAiDept(targetType, targetId, dept);
        if (!existing.isEmpty()) grantRepository.deleteAll(existing);

        if ("REMOVE".equals(action)) {
            deptResolver.invalidateAll(); // 권한 회수 즉시 반영
            return "ok";
        }

        String mode = "DENY".equals(action) ? AiDeptGrant.MODE_DENY : AiDeptGrant.MODE_ALLOW;
        AiDeptGrant g = new AiDeptGrant();
        g.setTargetType(targetType);
        g.setTargetId(targetId);
        g.setAiDept(dept);
        g.setMode(mode);
        grantRepository.save(g);
        deptResolver.invalidateAll(); // 권한 변경 즉시 반영(캐시 무효화)
        return "ok";
    }

    /** 파티션 접근 권한 부여/회수(AI_PARTITION_GRANT). 벡터DB 권한과 동일한 정리→설정 흐름. */
    private String applyPartitionGrant(String dept, String partition,
                                       String targetType, String targetId, String action) {
        List<AiPartitionGrant> existing =
                partitionGrantRepository.findByTargetTypeAndTargetIdAndAiDeptAndPartitionName(
                        targetType, targetId, dept, partition);
        if (!existing.isEmpty()) partitionGrantRepository.deleteAll(existing);

        if ("REMOVE".equals(action)) return "ok";

        String mode = "DENY".equals(action) ? AiPartitionGrant.MODE_DENY : AiPartitionGrant.MODE_ALLOW;
        AiPartitionGrant g = new AiPartitionGrant();
        g.setTargetType(targetType);
        g.setTargetId(targetId);
        g.setAiDept(dept);
        g.setPartitionName(partition);
        g.setMode(mode);
        partitionGrantRepository.save(g);
        return "ok";
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }
}
