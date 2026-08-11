package kr.co.ultari.chatbot.common.dept;

import kr.co.ultari.chatbot.database.entity.AiDeptLabel;
import kr.co.ultari.chatbot.database.repository.AiDeptLabelRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * dept 코드 → 표시 명칭 매핑. 관리자 화면에서 지정하고 챗봇/스위처에서 노출한다.
 * 미지정 코드는 코드 자체를 명칭으로 사용한다(안전 폴백).
 */
@Service
@RequiredArgsConstructor
public class DeptLabelService {

    private final DeptProperties deptProperties;
    private final AiDeptLabelRepository repository;

    /** 설정된 모든 dept 코드의 표시명(설정 순서 유지, 미지정은 코드 자체). */
    @Transactional(readOnly = true)
    public Map<String, String> labels() {
        Map<String, String> saved = new HashMap<>();
        repository.findAll().forEach(l -> saved.put(l.getDeptCode(), l.getLabel()));

        Map<String, String> out = new LinkedHashMap<>();
        for (String code : deptProperties.getCodes()) {
            out.put(code, display(code, saved.get(code)));
        }
        // 설정 목록 밖(default 등)이라도 저장돼 있으면 포함
        saved.forEach((code, label) -> out.putIfAbsent(code, display(code, label)));
        return out;
    }

    /** 단일 코드의 표시명(없으면 코드). */
    @Transactional(readOnly = true)
    public String label(String code) {
        if (code == null || code.isBlank()) return code;
        return repository.findById(code).map(AiDeptLabel::getLabel)
                .filter(s -> s != null && !s.isBlank()).orElse(code);
    }

    /** 명칭 저장(빈 값이면 코드 폴백을 위해 빈 문자열 저장). */
    @Transactional
    public void save(String code, String label) {
        if (code == null || code.isBlank()) return;
        AiDeptLabel e = repository.findById(code).orElseGet(() -> {
            AiDeptLabel n = new AiDeptLabel();
            n.setDeptCode(code);
            return n;
        });
        e.setLabel(label == null ? "" : label.trim());
        repository.save(e);
    }

    private String display(String code, String label) {
        return (label != null && !label.isBlank()) ? label : code;
    }
}
