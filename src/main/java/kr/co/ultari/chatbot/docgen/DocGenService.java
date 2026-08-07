package kr.co.ultari.chatbot.docgen;

import kr.co.ultari.chatbot.common.gateway.AiGatewayClient;
import kr.co.ultari.chatbot.common.sse.SseRelay;
import kr.co.ultari.chatbot.database.service.AIUsageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.util.UriUtils;
import reactor.core.publisher.Flux;

import java.nio.charset.StandardCharsets;

/**
 * 문서 자동화 도메인: AI 서버 문서 자동화 API(명세서 5장)로의 릴레이.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DocGenService {

    private final AiGatewayClient gateway;
    private final SseRelay sseRelay;
    private final AIUsageService aiUsageService;

    // 양식 데모용 기본 context_data (기존 백엔드 하드코딩 매핑 유지). 실제 값은 향후 대체.
    private static final String TEMPLATE_JSON_A001 = "{"
            + "\"doc_number\":\"신사복지 제2026-0042호\",\"draft_date\":\"2026. 01. 20.\","
            + "\"exec_date\":\"2026. 01. 21.\",\"via\":\"\",\"recipient\":\"내부결재\",\"reference\":\"\","
            + "\"title\":\"2026년 상반기 직원 교육 계획 보고\",\"retention\":\"3년\","
            + "\"sign_manager\":\"김철수\",\"sign_drafter\":\"이영희\",\"sign_coop\":\"\","
            + "\"doc_number_2\":\"신사복지 제2026-0042호\",\"exec_date_2\":\"2026. 01. 21.\","
            + "\"via_2\":\"\",\"recipient_2\":\"내부결재\",\"reference_2\":\"\","
            + "\"title_2\":\"2026년 상반기 직원 교육 계획 보고\","
            + "\"items\":[{\"text\":\"1. 교육 목적\",\"level\":1},"
            + "{\"text\":\"직원 역량 강화 및 서비스 품질 향상을 위한 정기 교육 실시\",\"level\":2},"
            + "{\"text\":\"2. 교육 일정\",\"level\":1},"
            + "{\"text\":\"2026년 2월 15일 ~ 2월 17일 (3일간)\",\"level\":2},"
            + "{\"text\":\"3. 교육 대상: 전 직원\",\"level\":1}],"
            + "\"has_attachment\":false}";

    private static final String TEMPLATE_JSON_A002 = "{"
            + "\"recipient\":\"각 부서장\",\"via\":\"경영지원팀\",\"title\":\"회의실 사용 안내\",\"attachment\":\"\","
            + "\"content_lines\":[\"안녕하십니까.\",\"\","
            + "\"2026년 1월 25일부터 3층 대회의실 리모델링 공사로 인해\","
            + "\"약 2주간 해당 회의실 사용이 제한됨을 알려드립니다.\"]}";

    /** 5.1 HWPX 문서 자동 생성 (JSON) */
    public ResponseEntity<String> generateHwpx(String dept, String templateName, String contextData,
                                               Integer expiresIn, Boolean oneTime) {
        MultipartBodyBuilder b = new MultipartBodyBuilder();
        b.part("template_name", templateName);
        b.part("context_data", contextData);
        if (expiresIn != null) b.part("expires_in", expiresIn);
        if (oneTime != null) b.part("one_time", oneTime);
        return gateway.postMultipart(dept, "/documents/generate-hwpx", b);
    }

    /** 5.2 회의록 HWPX 생성 (SSE, 커스텀 stage/percent 형식 — 투명 전달) */
    public SseEmitter meetingMinutes(String dept, String rawText, MultipartFile file,
                                     Integer expiresIn, Boolean oneTime) {
        MultipartBodyBuilder b = new MultipartBodyBuilder();
        if (StringUtils.hasText(rawText)) b.part("raw_text", rawText);
        if (file != null && !file.isEmpty()) {
            b.part("file", file.getResource()).filename(file.getOriginalFilename());
        }
        if (expiresIn != null) b.part("expires_in", expiresIn);
        if (oneTime != null) b.part("one_time", oneTime);
        return sseRelay.relay(() -> gateway.stream(dept, "/documents/meeting-minutes/generate-from-text", b));
    }

    /**
     * 양식 편의 엔드포인트: 프론트가 templateKey만 전달하면 서버가 명세서 5장 API로 매핑한다.
     * <p>A001/A002 → generate-hwpx(JSON) 결과를 단일 done SSE 프레임으로 감싸 전달,
     * A003 → meeting-minutes/generate-from-text(SSE) 투명 중계. 프론트는 두 경우 모두 동일 SSE로 처리.
     */
    public SseEmitter template(String dept, String userId, String templateKey, String message, MultipartFile file) {
        aiUsageService.increase(userId, userId, "TEMPLATE");

        if ("A003".equals(templateKey)) {
            MultipartBodyBuilder b = new MultipartBodyBuilder();
            if (StringUtils.hasText(message)) b.part("raw_text", message);
            if (file != null && !file.isEmpty()) {
                b.part("file", file.getResource()).filename(file.getOriginalFilename());
            }
            b.part("one_time", false);
            return sseRelay.relay(() -> gateway.stream(dept, "/documents/meeting-minutes/generate-from-text", b));
        }

        String templateName = "A002".equals(templateKey) ? "template2.hwpx" : "template.hwpx";
        String contextData = "A002".equals(templateKey) ? TEMPLATE_JSON_A002 : TEMPLATE_JSON_A001;
        // generate-hwpx는 JSON 단건 → 프론트 stage/done 파서가 data를 다운로드 정보로 쓰도록 감싼다.
        return sseRelay.relay(() -> {
            MultipartBodyBuilder b = new MultipartBodyBuilder();
            b.part("template_name", templateName);
            b.part("context_data", contextData);
            b.part("one_time", false);
            ResponseEntity<String> res = gateway.postMultipart(dept, "/documents/generate-hwpx", b);
            String body = (res != null && res.getBody() != null) ? res.getBody() : "{}";
            return Flux.just("{\"stage\":\"done\",\"percent\":100,\"data\":" + body + "}");
        });
    }

    /** 5.3 토큰 기반 파일 다운로드 (binary) */
    public ResponseEntity<byte[]> download(String dept, String token) {
        return gateway.download(dept, "/documents/download/"
                + UriUtils.encodePathSegment(token == null ? "" : token, StandardCharsets.UTF_8));
    }
}
