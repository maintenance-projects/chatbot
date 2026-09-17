package kr.co.ultari.chatbot.common.dept;

import kr.co.ultari.chatbot.common.gateway.AiGatewayClient;
import kr.co.ultari.chatbot.database.entity.AiPartitionGrant;
import kr.co.ultari.chatbot.database.repository.AiPartitionGrantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 사용자가 접근 가능한 AI 파티션(벡터DB 하위)을 해석한다.
 * <p>{@link DeptResolver}가 dept 단위로 하는 해석(조직 상속 ALLOW + 사용자 DENY, 기본 폐쇄)을
 * 파티션 단위({@link AiPartitionGrant})로 그대로 적용한다.
 * <ul>
 *   <li>{@link #accessibleNames(String, String)} — grant만으로 계산(게이트웨이 불필요, 선택 검증용)</li>
 *   <li>{@link #accessiblePartitions(String)} — 게이트웨이에 실제 존재하는 파티션 중 허용분만(라벨 포함, 드롭다운용)</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PartitionResolver {

    private final DeptResolver deptResolver;
    private final AiPartitionGrantRepository grantRepository;
    private final AiGatewayClient gateway;

    /** 드롭다운에 노출할, 접근 가능하고 실제 존재하는 파티션 목록(라벨 포함). */
    public List<AccessiblePartition> accessiblePartitions(String userId) {
        List<AccessiblePartition> out = new ArrayList<>();
        for (String dept : deptResolver.allowedDepts(userId)) {
            Set<String> allowedNames = accessibleNames(userId, dept);
            if (allowedNames.isEmpty()) continue;
            for (GwPartition p : listGatewayPartitions(dept)) {
                if (allowedNames.contains(p.name())) {
                    String label = StringUtils.hasText(p.description()) ? p.description() : p.name();
                    out.add(new AccessiblePartition(dept, p.name(), label));
                }
            }
        }
        return out;
    }

    /**
     * grant만으로 접근 가능한 파티션 name 집합(게이트웨이 조회 없음).
     * 허용부여 = (소속 조직들의 PART-ALLOW) ∪ (USER-ALLOW) − (USER-DENY). 기본 폐쇄.
     */
    public Set<String> accessibleNames(String userId, String dept) {
        if (!StringUtils.hasText(userId) || !StringUtils.hasText(dept)) {
            return Set.of();
        }
        Set<String> names = new LinkedHashSet<>();

        // 1) 조직(PART) 상속 ALLOW — dept 스코프로 조회
        Set<String> parts = deptResolver.userAncestorParts(userId);
        if (!parts.isEmpty()) {
            for (AiPartitionGrant g : grantRepository.findByTargetTypeAndTargetIdInAndModeAndAiDept(
                    AiPartitionGrant.TYPE_PART, parts, AiPartitionGrant.MODE_ALLOW, dept)) {
                names.add(g.getPartitionName());
            }
        }

        // 2) 사용자(USER) ALLOW/DENY — DENY는 상속분까지 제외
        Set<String> userDeny = new HashSet<>();
        for (AiPartitionGrant g : grantRepository.findByTargetTypeAndTargetIdAndAiDept(
                AiPartitionGrant.TYPE_USER, userId, dept)) {
            if (AiPartitionGrant.MODE_DENY.equals(g.getMode())) userDeny.add(g.getPartitionName());
            else names.add(g.getPartitionName());
        }
        names.removeAll(userDeny);
        return names;
    }

    /** 해당 사용자가 dept의 partition에 접근 가능한지(선택 반영 전 검증 — 게이트웨이 불필요). */
    public boolean isAccessible(String userId, String dept, String partition) {
        return StringUtils.hasText(partition) && accessibleNames(userId, dept).contains(partition);
    }

    /** 게이트웨이 파티션 목록({@code {code,partitions:[{name,description,seq}]}}) 조회. 실패 시 빈 목록. */
    private List<GwPartition> listGatewayPartitions(String dept) {
        try {
            ResponseEntity<String> res = gateway.get(dept, "/admin/partitions");
            if (res == null || !res.getStatusCode().is2xxSuccessful() || res.getBody() == null) {
                return List.of();
            }
            JSONObject env = new JSONObject(res.getBody());
            if (!"0000".equals(env.optString("code"))) return List.of();
            JSONArray arr = env.optJSONArray("partitions");
            if (arr == null) return List.of();

            List<GwPartition> list = new ArrayList<>();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.optJSONObject(i);
                if (o == null) continue;
                // 정렬 기준: order 우선(없으면 seq 폴백). 관리자 순서변경(reorder) 결과를 사용자 목록에도 반영.
                int ord = (o.has("order") && !o.isNull("order")) ? o.optInt("order") : o.optInt("seq", 0);
                list.add(new GwPartition(o.optString("name"), o.optString("description"), ord));
            }
            list.sort(Comparator.comparingInt(GwPartition::order));
            return list;
        } catch (Exception e) {
            log.debug("[partition] 게이트웨이 파티션 목록 조회 실패 dept={}: {}", dept, e.toString());
            return List.of();
        }
    }

    /** 사용자 노출용 접근 가능 파티션(벡터DB 코드 동반 — 선택 시 dept+partition 함께 세션에 핀). */
    public record AccessiblePartition(String dept, String name, String label) {}

    /** 게이트웨이 파티션 원소(내부). order=정렬순서(order 우선, 없으면 seq). */
    private record GwPartition(String name, String description, int order) {}
}
