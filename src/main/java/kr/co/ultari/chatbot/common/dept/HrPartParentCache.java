package kr.co.ultari.chatbot.common.dept;

import kr.co.ultari.chatbot.hr.dto.HrPart;
import kr.co.ultari.chatbot.hr.mapper.HrPartMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 조직도 부모맵({@code partId -> 상위부서(partHigh)}) 캐시.
 * <p>{@link DeptResolver}가 dept 접근권한을 계산할 때 소속부서의 조상까지 확장하려면 부모맵이 필요한데,
 * 이를 위해 인사DB(msg_part) 전체를 조회한다. 챗봇 진입/요청마다 반복되면 부담이므로
 * TTL 동안 결과를 캐시한다. 조직도(msg_part)는 외부 인사DB에서 관리되고 자주 바뀌지 않으므로
 * 짧은 TTL로 충분하다(기본 300초).
 * <p><b>기동 워밍업</b>: 앱 준비 완료 시 1회 미리 로드해 첫 사용자가 전체조회 비용을 안 물게 한다.
 * <p><b>refresh-ahead</b>: TTL이 지나면 <i>오래된 값을 즉시 반환</i>하고 백그라운드에서 갱신한다.
 * 사용자 요청이 원격 인사DB 전체조회로 블로킹되지 않도록. (최초 1회만, 캐시가 비어있을 때 동기 로드)
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
    /** 백그라운드 갱신 진행 중 플래그(중복 갱신 방지) */
    private final AtomicBoolean refreshing = new AtomicBoolean(false);

    /** 앱 준비 완료 시 부모맵을 미리 로드(첫 사용자 지연 제거). 실패해도 기동은 막지 않음. */
    @EventListener(ApplicationReadyEvent.class)
    public void warmUp() {
        if (props.getPartCacheTtlSeconds() <= 0) return;
        try {
            Map<String, String> m = load();
            cached = m;
            loadedAt = System.currentTimeMillis();
            log.info("[dept] 조직도 부모맵 기동 워밍업 완료: {}건", m.size());
        } catch (Exception e) {
            log.warn("[dept] 조직도 부모맵 기동 워밍업 실패(첫 요청 시 재시도): {}", e.getMessage());
        }
    }

    /** {@code partId -> partHigh(부모)} 맵. 신선하면 캐시, 만료면 stale 반환 + 배경 갱신, 없으면 동기 로드. */
    public Map<String, String> parentMap() {
        long ttlMs = props.getPartCacheTtlSeconds() * 1000L;
        if (ttlMs <= 0) {
            return load(); // 캐시 비활성: 매번 조회(구버전 동작)
        }
        Map<String, String> c = cached;
        if (c != null) {
            if ((System.currentTimeMillis() - loadedAt) >= ttlMs) {
                triggerAsyncRefresh(); // 만료: stale 즉시 반환하고 백그라운드 갱신
            }
            return c;
        }
        return reloadSync(ttlMs); // 최초(캐시 비어있음)만 동기 로드
    }

    /** 만료 시 백그라운드 갱신 1건만 수행(사용자 요청은 stale로 즉시 응답). */
    private void triggerAsyncRefresh() {
        if (!refreshing.compareAndSet(false, true)) return;
        CompletableFuture.runAsync(() -> {
            try {
                Map<String, String> m = load();
                cached = m;
                loadedAt = System.currentTimeMillis();
                log.debug("[dept] 조직도 부모맵 배경 갱신: {}건", m.size());
            } catch (Exception e) {
                log.warn("[dept] 조직도 부모맵 배경 갱신 실패(기존값 유지): {}", e.getMessage());
            } finally {
                refreshing.set(false);
            }
        });
    }

    private synchronized Map<String, String> reloadSync(long ttlMs) {
        // 락 대기 중 다른 스레드가 이미 채웠다면 재사용
        Map<String, String> c = cached;
        if (c != null && (System.currentTimeMillis() - loadedAt) < ttlMs) {
            return c;
        }
        Map<String, String> m = load();
        cached = m;
        loadedAt = System.currentTimeMillis();
        log.debug("[dept] 조직도 부모맵 갱신: {}건 (TTL {}s)", m.size(), props.getPartCacheTtlSeconds());
        return m;
    }

    /** 인사DB msg_part 전체조회 → 불변 부모맵. */
    private Map<String, String> load() {
        Map<String, String> m = new HashMap<>();
        for (HrPart p : hrPartMapper.selectAll()) {
            m.put(p.getPartId(), p.getPartHigh());
        }
        return Collections.unmodifiableMap(m);
    }

    /** 캐시 강제 무효화(조직도 변경을 즉시 반영해야 할 때 수동 호출). */
    public void invalidate() {
        cached = null;
        loadedAt = 0L;
    }
}
