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

    /** 파티션 안내문구 기본값 키. 파티션 전용값이 없을 때 폴백으로 쓰인다. */
    public static final String KEY_PARTITION_GUIDE_DEFAULT = "partition.guide.__default__";

    /** 안내문구 최대 길이(SETTING_VALUE 컬럼과 동일). */
    public static final int GUIDE_MAX_LEN = 2000;

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

    /** 문자열 설정 조회(없거나 빈 값이면 기본값). */
    @Transactional(readOnly = true)
    public String getString(String key, String def) {
        try {
            return repository.findById(key)
                    .map(AppSetting::getSettingValue)
                    .filter(v -> v != null && !v.isBlank())
                    .orElse(def);
        } catch (Exception e) {
            log.warn("[app-setting] {} 조회 실패, 기본값 사용: {}", key, e.getMessage());
            return def;
        }
    }

    /** 문자열 설정 저장(2000자 초과분은 절단). */
    @Transactional
    public void setString(String key, String value) {
        String v = value == null ? "" : value;
        if (v.length() > GUIDE_MAX_LEN) v = v.substring(0, GUIDE_MAX_LEN);
        final String val = v;
        AppSetting e = repository.findById(key).orElseGet(() -> {
            AppSetting n = new AppSetting();
            n.setSettingKey(key);
            return n;
        });
        e.setSettingValue(val);
        repository.save(e);
    }

    // ── 파티션 안내문구 ───────────────────────────────────────────────
    // 저장 규약: partition.guide.{dept}.{name} (파티션별), partition.guide.__default__ (기본).

    /** 파티션 안내문구 키. */
    public static String partitionGuideKey(String dept, String name) {
        return "partition.guide." + dept + "." + name;
    }

    /** 파티션 전용 안내문구 raw 조회(폴백 없음, 관리자 편집용). 미설정이면 "". */
    public String getPartitionGuideRaw(String dept, String name) {
        return getString(partitionGuideKey(dept, name), "");
    }

    /** 기본 안내문구 raw 조회(관리자 편집용). 미설정이면 "". */
    public String getDefaultGuideRaw() {
        return getString(KEY_PARTITION_GUIDE_DEFAULT, "");
    }

    /** 파티션 전용 안내문구 저장(빈 값=미설정으로 비움). */
    public void setPartitionGuide(String dept, String name, String text) {
        setString(partitionGuideKey(dept, name), text == null ? "" : text.trim());
    }

    /** 기본 안내문구 저장(빈 값=미설정으로 비움). */
    public void setDefaultGuide(String text) {
        setString(KEY_PARTITION_GUIDE_DEFAULT, text == null ? "" : text.trim());
    }

    /**
     * 사용자 화면 표시용 안내문구 해석: 파티션 전용값 → 기본값 → "".
     * 빈 문자열이면 인사말을 띄우지 않는다는 의미.
     */
    public String resolvePartitionGuide(String dept, String name) {
        String own = getPartitionGuideRaw(dept, name);
        if (own != null && !own.isBlank()) return own;
        String def = getDefaultGuideRaw();
        return (def != null && !def.isBlank()) ? def : "";
    }
}
