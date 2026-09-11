package kr.co.ultari.chatbot.admin.service;

import kr.co.ultari.chatbot.database.entity.AppSetting;
import kr.co.ultari.chatbot.database.repository.AppSettingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 앱 로컬 설정(게이트웨이에 없는 우리쪽 전용 설정) 키-값 저장/조회.
 * 예: 개인문서 업로드 개수 제한.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AppSettingService {

    /** 개인문서 업로드 개수 제한 키. 값 0 또는 미설정 = 무제한. */
    public static final String KEY_PERSONAL_DOC_MAX_COUNT = "personal.doc.max-count";

    private final AppSettingRepository repository;

    /** 정수 설정 조회(없거나 파싱 실패 시 기본값). */
    @Transactional(readOnly = true)
    public int getInt(String key, int def) {
        try {
            return repository.findById(key)
                    .map(AppSetting::getSettingValue)
                    .filter(v -> v != null && !v.isBlank())
                    .map(v -> {
                        try { return Integer.parseInt(v.trim()); }
                        catch (NumberFormatException e) { return def; }
                    })
                    .orElse(def);
        } catch (Exception e) {
            log.warn("[app-setting] {} 조회 실패, 기본값({}) 사용: {}", key, def, e.getMessage());
            return def;
        }
    }

    /** 정수 설정 저장. */
    @Transactional
    public void setInt(String key, int value) {
        AppSetting e = repository.findById(key).orElseGet(() -> {
            AppSetting n = new AppSetting();
            n.setSettingKey(key);
            return n;
        });
        e.setSettingValue(Integer.toString(value));
        repository.save(e);
    }

    /** 개인문서 업로드 개수 제한(0=무제한). */
    public int getPersonalDocMaxCount() {
        return Math.max(0, getInt(KEY_PERSONAL_DOC_MAX_COUNT, 0));
    }

    /** 개인문서 업로드 개수 제한 저장(0=무제한, 음수는 0으로). */
    public void setPersonalDocMaxCount(int value) {
        setInt(KEY_PERSONAL_DOC_MAX_COUNT, Math.max(0, value));
    }
}
