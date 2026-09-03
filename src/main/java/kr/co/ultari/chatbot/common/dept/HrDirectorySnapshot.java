package kr.co.ultari.chatbot.common.dept;

import kr.co.ultari.chatbot.hr.dto.HrPart;
import kr.co.ultari.chatbot.hr.dto.HrUser;
import kr.co.ultari.chatbot.hr.mapper.HrPartMapper;
import kr.co.ultari.chatbot.hr.mapper.HrUserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * HR(인사) 사용자 디렉터리 인메모리 스냅샷.
 * <p>원격 HR DB(오라클/DB링크)를 요청마다 조회하면 느리므로(특히 링크 원격 조회),
 * 주기 배치로 <b>전체 사용자를 한 번에 메모리에 적재</b>하고 접속/로그인/부서해석은 메모리에서 처리한다.
 * 느린 원격 조회는 이 백그라운드 배치에서만 발생하며 사용자 요청을 절대 블로킹하지 않는다.
 * <p>정책(미스=거부): 스냅샷이 정상 적재된 뒤엔 <b>맵에 없는 userId는 '없음'</b>으로 본다.
 * 신규/변경은 다음 갱신(기본 1시간) 또는 관리자 수동 새로고침으로 반영된다.
 * 단 <b>아직 미적재(기동 직후/배치 실패)일 때만</b> 호출측이 DB로 폴백하도록 {@link #isLoaded()}를 제공한다
 * (전원 잠김 방지).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class HrDirectorySnapshot {

    private final HrUserMapper hrUserMapper;
    private final HrPartMapper hrPartMapper;

    /** 사용자 1명 = 이름 + 비번(로그인 검증용) + 소속부서(겸직/소스중복 시 복수) */
    public record UserEntry(String userName, String password, List<String> partIds) {}

    /** true면 이 스냅샷으로만 조회. false면 기존처럼 매 요청 DB 조회(킬 스위치). */
    @Value("${ultari.hr.directory.enabled:true}")
    private boolean enabled;

    /** null = 아직 미적재(기동 직후/배치 실패). 적재 후엔 이 맵만으로 조회(미스=없음). */
    private volatile Map<String, UserEntry> users;
    /** 조직도 전체(관리자 트리 렌더용, partName 포함). users와 같은 배치로 적재. */
    private volatile List<HrPart> parts;
    private final AtomicBoolean refreshing = new AtomicBoolean(false);

    /** 앱 준비 완료 시 1회 즉시 적재(첫 사용자 지연 제거). */
    @EventListener(ApplicationReadyEvent.class)
    public void warmUp() {
        refresh();
    }

    /** 주기 갱신(기본 1시간). 워밍업과 겹치지 않도록 첫 실행은 한 주기 뒤. */
    @Scheduled(fixedRateString = "${ultari.hr.directory.refresh-ms:3600000}",
            initialDelayString = "${ultari.hr.directory.refresh-ms:3600000}")
    public void scheduled() {
        refresh();
    }

    /**
     * 전체 사용자 벌크 로드 → 원자적 스왑. 실패 시 이전 스냅샷 유지(링크 죽어도 서비스 지속).
     * 관리자 수동 새로고침에서도 호출. 반환: 적재된 사용자 수.
     */
    public int refresh() {
        if (!enabled) {
            log.debug("[hr-dir] 비활성(enabled=false) — 스냅샷 미사용, 매 요청 DB 조회");
            return 0;
        }
        if (!refreshing.compareAndSet(false, true)) {
            log.debug("[hr-dir] 갱신 이미 진행 중 — 건너뜀");
            return size();
        }
        try {
            List<HrUser> rows = hrUserMapper.selectAllWithAuth();
            Map<String, UserEntry> map = new HashMap<>();
            for (HrUser u : rows) {
                String id = u.getUserId();
                if (!StringUtils.hasText(id)) continue;
                UserEntry e = map.computeIfAbsent(id,
                        k -> new UserEntry(u.getUserName(), u.getPassword(), new ArrayList<>()));
                String high = u.getUserHigh();
                if (StringUtils.hasText(high) && !e.partIds().contains(high)) {
                    e.partIds().add(high);
                }
            }
            // 조직도(parts)도 같은 배치로 적재(관리자 트리 렌더용). 실패 시 아래 catch로 이전값 유지.
            List<HrPart> ps = hrPartMapper.selectAll();
            parts = Collections.unmodifiableList(new ArrayList<>(ps));

            users = Collections.unmodifiableMap(map);
            log.info("[hr-dir] HR 디렉터리 스냅샷 갱신 완료: 사용자 {}명, 조직 {}건", map.size(), parts.size());
            return map.size();
        } catch (Exception ex) {
            log.warn("[hr-dir] HR 디렉터리 스냅샷 갱신 실패(기존 유지): {}", ex.getMessage());
            return size();
        } finally {
            refreshing.set(false);
        }
    }

    /** 스냅샷이 적재되어 있는가(미적재면 호출측이 DB 폴백). */
    public boolean isLoaded() {
        return users != null;
    }

    public int size() {
        Map<String, UserEntry> m = users;
        return m == null ? 0 : m.size();
    }

    public boolean contains(String userId) {
        Map<String, UserEntry> m = users;
        return m != null && userId != null && m.containsKey(userId);
    }

    public UserEntry get(String userId) {
        Map<String, UserEntry> m = users;
        return (m == null || userId == null) ? null : m.get(userId);
    }

    /** 사용자 소속 부서(partId) 목록. 미존재면 빈 리스트(불변). */
    public List<String> partIdsOf(String userId) {
        UserEntry e = get(userId);
        return e == null ? Collections.emptyList() : Collections.unmodifiableList(e.partIds());
    }

    /** 조직도 전체(관리자 트리용). 미적재면 빈 리스트. */
    public List<HrPart> partList() {
        List<HrPart> p = parts;
        return p == null ? Collections.emptyList() : p;
    }

    /** 전체 사용자 맵(관리자 트리용). 미적재면 빈 맵. */
    public Map<String, UserEntry> userMap() {
        Map<String, UserEntry> m = users;
        return m == null ? Collections.emptyMap() : m;
    }
}
