package kr.co.ultari.chatbot.common.dept;

import kr.co.ultari.chatbot.hr.dto.HrPart;
import kr.co.ultari.chatbot.hr.mapper.HrPartMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * 조직도 부모맵({@code partId -> 상위부서(partHigh)}) 캐시.
 * <p>{@link DeptResolver}가 dept 접근권한을 계산할 때 소속부서의 조상까지 확장하려면 부모맵이 필요한데,
 * 이를 위해 인사DB(msg_part) 전체를 조회한다. 챗봇 진입/요청마다 반복되면 부담이므로
 * TTL 동안 결과를 캐시한다. 조직도(msg_part)는 외부 인사DB에서 관리되고 자주 바뀌지 않으므로
 * 짧은 TTL로 충분하다(기본 300초). TTL이 지나면 다음 조회 시 자동 갱신한다.
 * <p>TTL은 {@code ultari.dept.part-cache-ttl-seconds}로 조정하며, {@code 0 이하}면 캐시를 끄고 매번 조회한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class HrPartParentCache {

    private final HrPartMapper hrPartMapper;
    private final DeptProperties props;

    private volatile Map<String, String> cached;
    private volatile long loadedAt;

    /** {@code partId -> partHigh(부모)} 맵. TTL 유효하면 캐시, 아니면 갱신. 불변맵 반환. */
    public Map<String, String> parentMap() {
        long ttlMs = props.getPartCacheTtlSeconds() * 1000L;
        if (ttlMs > 0) {
            Map<String, String> c = cached;
            if (c != null && (System.currentTimeMillis() - loadedAt) < ttlMs) {
                return c;
            }
        }
        return reload(ttlMs);
    }

    private synchronized Map<String, String> reload(long ttlMs) {
        // 락 획득 대기 중 다른 스레드가 이미 갱신했다면 재사용
        if (ttlMs > 0 && cached != null && (System.currentTimeMillis() - loadedAt) < ttlMs) {
            return cached;
        }
        Map<String, String> m = new HashMap<>();
        for (HrPart p : hrPartMapper.selectAll()) {
            m.put(p.getPartId(), p.getPartHigh());
        }
        Map<String, String> immutable = Collections.unmodifiableMap(m);
        cached = immutable;
        loadedAt = System.currentTimeMillis();
        log.debug("[dept] 조직도 부모맵 갱신: {}건 (TTL {}s)", m.size(), props.getPartCacheTtlSeconds());
        return immutable;
    }

    /** 캐시 강제 무효화(조직도 변경을 즉시 반영해야 할 때 수동 호출). */
    public void invalidate() {
        cached = null;
        loadedAt = 0L;
    }
}
