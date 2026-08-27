package kr.co.ultari.chatbot.admin.service;

import kr.co.ultari.chatbot.database.entity.AiConfig;
import kr.co.ultari.chatbot.database.repository.AiConfigRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * AI 환경설정(단일 행) 로드/저장. 행이 없으면 기본값으로 생성한다.
 * 기본 보관일수는 기존 정적 설정(ultari.ai.document.cleanup.retention-hours)에서 유도해 정합을 맞춘다.
 */
@Slf4j
@Service
public class AdminConfigService {

    static final int CONFIG_ID = 1;
    static final int DEFAULT_TEMPERATURE = 5;

    private final AiConfigRepository repository;

    /** 개인문서 사본 보존시간(시간). /24 하여 기본 보관일수(일)로 사용. */
    @Value("${ultari.ai.document.cleanup.retention-hours:168}")
    int defaultRetentionHours;

    public AdminConfigService(AiConfigRepository repository) {
        this.repository = repository;
    }

    /** 설정 조회. 없으면 기본값으로 생성 후 반환. */
    public AiConfig getConfig() {
        return repository.findById(CONFIG_ID).orElseGet(() -> {
            AiConfig c = new AiConfig();
            c.setConfigId(CONFIG_ID);
            c.setTemperature(DEFAULT_TEMPERATURE);
            c.setUserPrompt("");
            c.setDocRetentionDays(Math.max(1, defaultRetentionHours / 24));
            return repository.save(c);
        });
    }

    /** 설정 저장. 값은 유효범위로 보정(temperature 0~10, 보관일수 1 이상). */
    public void save(int temperature, String userPrompt, int docRetentionDays) {
        AiConfig c = getConfig();
        c.setTemperature(clamp(temperature, 0, 10));
        c.setUserPrompt(userPrompt != null ? userPrompt : "");
        c.setDocRetentionDays(Math.max(1, docRetentionDays));
        repository.save(c);
        log.info("[config save] temperature={}, docRetentionDays={}, promptLen={}",
                c.getTemperature(), c.getDocRetentionDays(), c.getUserPrompt().length());
    }

    /** 개인문서 보관일수(사용자 표시/공개 조회용). */
    public int getDocRetentionDays() {
        Integer d = getConfig().getDocRetentionDays();
        return (d != null && d > 0) ? d : Math.max(1, defaultRetentionHours / 24);
    }

    private int clamp(int v, int min, int max) {
        return Math.max(min, Math.min(max, v));
    }
}
