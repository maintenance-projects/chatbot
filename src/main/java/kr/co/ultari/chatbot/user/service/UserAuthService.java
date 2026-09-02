package kr.co.ultari.chatbot.user.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.annotation.PostConstruct;
import kr.co.ultari.chatbot.hr.dto.HrUser;
import kr.co.ultari.chatbot.hr.mapper.HrUserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * 챗봇 로그인 — 인사(HR) DB msg_user 조회로 검증한다.
 */
@Service
@RequiredArgsConstructor
public class UserAuthService {

    private final HrUserMapper hrUserMapper;

    /**
     * 존재확인(exists) 결과 캐시 TTL(초). 챗봇 화면 접근마다 원격 인사DB를 조회하던 것을 캐시.
     * {@code 0 이하}면 비활성. 기본 300초.
     */
    @Value("${ultari.chatbot.login.exists-cache-ttl-seconds:300}")
    private long existsCacheTtlSeconds;

    /** userId → 존재여부. TTL 캐시(원격 HR 조회 절감). */
    private Cache<String, Boolean> existsCache;

    @PostConstruct
    void initCache() {
        if (existsCacheTtlSeconds > 0) {
            existsCache = Caffeine.newBuilder()
                    .expireAfterWrite(Duration.ofSeconds(existsCacheTtlSeconds))
                    .maximumSize(10_000)
                    .build();
        }
    }

    public String login(String userId, String password) {
        HrUser user = hrUserMapper.selectById(userId);
        if (user == null) return "NoUser";
        if (user.getPassword() == null || !user.getPassword().equals(password)) return "NoPassword";
        return "ok";
    }

    /** 인사(HR) DB에 해당 사용자 계정이 존재하는지. 챗봇 화면 직접 접근 검증용(TTL 캐시). */
    public boolean exists(String userId) {
        if (userId == null || userId.isBlank()) return false;
        Cache<String, Boolean> c = existsCache;
        if (c == null) {
            return hrUserMapper.selectById(userId) != null;
        }
        return Boolean.TRUE.equals(c.get(userId, id -> hrUserMapper.selectById(id) != null));
    }
}
