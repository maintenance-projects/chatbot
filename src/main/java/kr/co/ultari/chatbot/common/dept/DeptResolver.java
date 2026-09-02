package kr.co.ultari.chatbot.common.dept;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.annotation.PostConstruct;
import kr.co.ultari.chatbot.database.entity.AiDeptGrant;
import kr.co.ultari.chatbot.database.repository.AiDeptGrantRepository;
import kr.co.ultari.chatbot.hr.mapper.HrUserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
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
@Slf4j
@Component
@RequiredArgsConstructor
public class DeptResolver {

    private final DeptProperties props;
    private final AiDeptGrantRepository grantRepository;
    private final HrUserMapper hrUserMapper;
    private final HrPartParentCache hrPartParentCache;

    /**
     * 사용자별 허용 dept 집합 캐시. 요청마다 인사DB(msg_user)+앱DB(AI_DEPT_GRANT)를 재조회하던 것을
     * TTL 동안 재사용한다. 권한 변경(관리자 저장) 시 {@link #invalidateAll()}로 즉시 무효화한다.
     * TTL {@code 0 이하}면 비활성(cache=null → 매번 조회).
     */
    private Cache<String, Set<String>> grantCache;

    @PostConstruct
    void initCache() {
        long ttl = props.getGrantCacheTtlSeconds();
        if (ttl > 0) {
            grantCache = Caffeine.newBuilder()
                    .expireAfterWrite(Duration.ofSeconds(ttl))
                    .maximumSize(10_000)
                    .build();
        }
        log.info("[dept] allowedDepts 캐시 {} (TTL {}s)", ttl > 0 ? "활성" : "비활성", ttl);
    }

    /** 사용자가 접근 가능한 부서 집합. TTL 캐시 적용(관리자 권한 변경 시 무효화). */
    public Set<String> allowedDepts(String userId) {
        if (!StringUtils.hasText(userId)) {
            return Collections.emptySet();
        }
        Cache<String, Set<String>> c = grantCache;
        if (c == null) {
            return computeAllowedDepts(userId);
        }
        return c.get(userId, this::computeAllowedDepts);
    }

    /** 권한 전체 캐시 무효화. 관리자 AI 파티션 권한 부여/회수 후 호출. */
    public void invalidateAll() {
        Cache<String, Set<String>> c = grantCache;
        if (c != null) c.invalidateAll();
    }

    /** 특정 사용자 캐시 무효화. */
    public void invalidate(String userId) {
        Cache<String, Set<String>> c = grantCache;
        if (c != null && StringUtils.hasText(userId)) c.invalidate(userId);
    }

    /** 실제 조회(캐시 미스 시). 인사DB 소속부서 + 앱DB 부여를 합쳐 허용 dept를 계산. */
    private Set<String> computeAllowedDepts(String userId) {
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
        // 캐시에 저장/공유되므로 호출자 변경으로부터 보호(불변)
        return Collections.unmodifiableSet(depts);
    }

    public boolean isAllowed(String userId, String dept) {
        return StringUtils.hasText(dept) && allowedDepts(userId).contains(dept);
    }

    /**
     * 요청 dept를 검증해 라우팅 부서를 결정한다.
     * 요청값이 허용되면 그대로, 아니면 허용이 1개면 자동, 그 외엔 default-dept.
     */
    public String resolve(String userId, String requestedDept) {
        return resolveFrom(allowedDepts(userId), requestedDept);
    }

    /**
     * 이미 계산된 허용 dept 집합으로 라우팅 부서를 결정한다(allowedDepts 재조회 방지).
     * 요청값이 허용되면 그대로, 아니면 허용이 1개면 자동, 그 외엔 default-dept.
     */
    public String resolveFrom(Set<String> allowed, String requestedDept) {
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

        // 조직도 부모맵은 캐시 사용(요청마다 인사DB 전체조회 방지)
        Map<String, String> parent = hrPartParentCache.parentMap();
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

