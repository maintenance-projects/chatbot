package kr.co.ultari.chatbot.generate.service;

import kr.co.ultari.chatbot.database.service.AIUsageService;
import kr.co.ultari.chatbot.generate.datamodel.dto.RequestDTO;
import kr.co.ultari.chatbot.utils.StringUtilsCustom;
import kr.co.ultari.chatbot.utils.WebUtilsCustom;
import lombok.extern.slf4j.Slf4j;
import lombok.var;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.util.ObjectUtils;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.Disposable;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Service
public class AIRelayService {
    private static final long SSE_TIMEOUT_MS = 300_000L;

    @Value("${ultari.ai-gateway.chat-default-url:}")
    private String AI_CHAT_DEFAULT_URL;

    @Value("${ultari.ai-gateway.chat-open-url:}")
    private String AI_CHAT_OPEN_URL;

    @Value("${ultari.ai-gateway.upload-url:}")
    private String AI_UPLOAD_URL;

    @Value("${ultari.ai-gateway.template-url:}")
    private String AI_TEMPLATE_URL;

    @Value("${ultari.ai-gateway.meeting-template-url:}")
    private String AI_MEETING_TEMPLATE_URL;

    @Value("${ultari.ai-gateway.call-summary-url:}")
    private String AI_CALL_SUMMARY_URL;

    @Value("${ultari.ai-gateway.files-url:}")
    private String AI_FILES_URL;

    @Value("${ultari.ai-gateway.chat-private-url:}")
    private String AI_CHAT_PRIVATE_URL;

    @Value("${ultari.ai-gateway.doc-summary-url:}")
    private String AI_DOC_SUMMARY_URL;

    @Value("${ultari.ai-gateway.chat-history-url:http://10.0.0.31:8000/history}")
    private String AI_CHAT_HISTORY_URL;

    @Autowired
    AIUsageService aiUsageService;

    @Autowired
    RestTemplate restTemplate;

    @Autowired
    CachedService cachedService;

    private final AIRelayClientService aiClientService;

    private final Executor aiExecutor;

    public AIRelayService(AIRelayClientService aiClientService, @Qualifier("aiExecutor") Executor aiExecutor) {
        this.aiClientService = aiClientService;
        this.aiExecutor = aiExecutor;
    }

    public String ChatRelayService(RequestDTO requestDTO) {
        JSONObject body = new JSONObject();
        body.put("message",requestDTO.getMessage());
        body.put("attachFile_name","");
        body.put("attachFile_extension","");
        body.put("attachFile_bin","");
        body.put("deepResearch",requestDTO.isDeepResearch());
        if(!StringUtils.isEmpty(requestDTO.getTranslate_to())) body.put("translate_to", requestDTO.getTranslate_to());

        //요청 횟수 증가
        aiUsageService.increase(
                requestDTO.getSessionId(),
                requestDTO.getSessionId(),
                "CHAT"
        );

        CompletableFuture<String> future =
                CompletableFuture.supplyAsync(() -> {
                    try {
                        return WebUtilsCustom.requestMultipart(AI_CHAT_OPEN_URL, requestDTO.getSessionId(), body);
                    } catch (Exception e) {
                        log.error("",e);
                        return "AI 서버 연결에 실패하였습니다... 😥";
                    }
                }, aiExecutor);

        try {
            return future.get(180, TimeUnit.SECONDS);
        } catch (Exception e) {
            log.error("", e);
            return "AI 서버 응답이 지연되고 있습니다. 다시 시도해 주시기 바랍니다... 😥";
        }
    }

    public String DocumentRelayService(String sessionId, MultipartFile file, String message, boolean deep) {
        if(file.isEmpty()) return "요약이 불가능한 파일입니다.";
        String originalFileName = file.getOriginalFilename();
        String fileName = originalFileName.substring(0,originalFileName.lastIndexOf("."));
        String ext = originalFileName.substring(originalFileName.lastIndexOf(".")+1);

        if(log.isDebugEnabled()) {
            log.debug("message={}, originalFileName={}, fileName={}, ext={}",message ,originalFileName, fileName, ext);
        }

        //요청 횟수 증가
        aiUsageService.increase(
                sessionId,
                sessionId,
                "DOCUMENT"
        );

        CompletableFuture<String> future =
                CompletableFuture.supplyAsync(() -> {
                    MultipartBodyBuilder builder = new MultipartBodyBuilder();
                    //builder.part("message", "문서 파일명 : "+originalFileName+", 이 문서를 요약해줘.");
                    builder.part("message", message);
                    builder.part("attachFile_name", fileName);
                    builder.part("attachFile_extension", ext);
                    builder.part("attachFile_bin", file.getResource())
                            .filename(originalFileName)
                            .contentType(MediaType.APPLICATION_OCTET_STREAM);
                    builder.part("deepResearch", deep);

                    try {
                        String response = aiClientService.callAI(AI_CHAT_OPEN_URL, sessionId, builder);
                        JSONObject res = new JSONObject(response);
                        return StringUtilsCustom.removeThinkTag(res.getJSONArray("choices")
                                .getJSONObject(0)
                                .getJSONObject("message")
                                .getString("content"));
                    } catch (Exception e) {
                        log.error("",e);
                        return "AI 서버 연결에 실패하였습니다... 😥";
                    }

                }, aiExecutor);

        try {
            return future.get(180, TimeUnit.SECONDS);
        } catch (Exception e) {
            log.error("", e);
            return "AI 서버 응답이 지연되고 있습니다. 다시 시도해 주시기 바랍니다... 😥";
        }
    }

    public SseEmitter ChatRelayServiceStream(RequestDTO requestDTO, MultipartFile file) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        AtomicBoolean completed = new AtomicBoolean(false);

        aiUsageService.increase(
                requestDTO.getSessionId(),
                requestDTO.getSessionId(),
                "DOCUMENT"
        );

        // AI Gateway로 보낼 multipart 구성 (기존 ChatRelayService의 JSON과 동일 필드)
        MultipartBodyBuilder builder = setMultiPartBuilder(requestDTO, file);

        // 클라이언트가 끊으면 subscription 정리
        final Disposable[] disposableHolder = new Disposable[1];
        emitter.onCompletion(() -> {
            completed.set(true);
            if (disposableHolder[0] != null) disposableHolder[0].dispose();
        });
        emitter.onTimeout(() -> {
            completed.set(true);
            if (disposableHolder[0] != null) disposableHolder[0].dispose();
        });
        emitter.onError(e -> {
            completed.set(true);
            if (disposableHolder[0] != null) disposableHolder[0].dispose();
        });

        try {
            emitter.send(SseEmitter.event().name("start").data(""));
        } catch (IOException ignored) {}

        // 진짜 스트리밍: AI Gateway 스트림(Flux)을 subscribe 해서 emitter로 바로 흘림
        try {
            disposableHolder[0] = aiClientService
                    .callAIStream(AI_UPLOAD_URL, requestDTO, builder)
                    .subscribe(
                            rawChunk -> {
                                if (completed.get()) return;
                                // rawChunk는 게이트웨이 구현에 따라
                                // - 이미 "data: {...}\n\n" 같은 SSE 조각일 수도 있고
                                // - 그냥 JSON 문자열 조각일 수도 있음
                                // 아래는 OpenAI 스타일 SSE(data: {...})를 최대한 content(delta)로 뽑는 파서
                                String delta = SseDeltaExtractor.extractDelta(rawChunk);
                                log.debug("delta={}", delta);
                                // 뽑히면 delta로 보내고, 아니면 rawChunk를 그대로 보냄(최소 동작 보장)
                                String payload = (delta != null && !delta.isEmpty()) ? delta : rawChunk;

                                try {
                                    emitter.send(SseEmitter.event().name("delta").data(payload));
                                } catch (IOException e) {
                                    completed.set(true);
                                    if (disposableHolder[0] != null) disposableHolder[0].dispose();
                                }
                            },
                            err -> {
                                if (completed.get()) return;
                                try {
                                    emitter.send(SseEmitter.event().name("error").data("AI 서버 연결에 실패하였습니다... 😥"));
                                } catch (IOException ignored) {}
                                emitter.complete();
                            },
                            () -> {
                                cachedService.FilesCacheClear(requestDTO.getSessionId());
                                if (completed.get()) return;
                                try {
                                    emitter.send(SseEmitter.event().name("done").data(""));
                                } catch (IOException ignored) {}
                                emitter.complete();
                            }
                    );
        } catch (Exception e) {
            try {
                emitter.send(SseEmitter.event().name("error").data("AI 서버 연결에 실패하였습니다... 😥"));
            } catch (IOException ignored) {}
            emitter.completeWithError(e);
        }

        return emitter;
    }

    public SseEmitter ChatRelayServiceAudioStream(RequestDTO requestDTO, MultipartFile file) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        AtomicBoolean completed = new AtomicBoolean(false);

        aiUsageService.increase(
                requestDTO.getSessionId(),
                requestDTO.getSessionId(),
                "AUDIO"
        );

        // AI Gateway로 보낼 multipart 구성 (기존 ChatRelayService의 JSON과 동일 필드)
        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        builder.part("audio", file.getResource());

        // 클라이언트가 끊으면 subscription 정리
        final Disposable[] disposableHolder = new Disposable[1];
        emitter.onCompletion(() -> {
            completed.set(true);
            if (disposableHolder[0] != null) disposableHolder[0].dispose();
        });
        emitter.onTimeout(() -> {
            completed.set(true);
            if (disposableHolder[0] != null) disposableHolder[0].dispose();
        });
        emitter.onError(e -> {
            completed.set(true);
            if (disposableHolder[0] != null) disposableHolder[0].dispose();
        });

        try {
            emitter.send(SseEmitter.event().name("start").data(""));
        } catch (IOException ignored) {}

        // 진짜 스트리밍: AI Gateway 스트림(Flux)을 subscribe 해서 emitter로 바로 흘림
        try {
            disposableHolder[0] = aiClientService
                    .callAIStream(AI_CALL_SUMMARY_URL, requestDTO, builder)
                    .subscribe(
                            rawChunk -> {
                                if (completed.get()) return;

                                // rawChunk는 게이트웨이 구현에 따라
                                // - 이미 "data: {...}\n\n" 같은 SSE 조각일 수도 있고
                                // - 그냥 JSON 문자열 조각일 수도 있음
                                // 아래는 OpenAI 스타일 SSE(data: {...})를 최대한 content(delta)로 뽑는 파서
                                String delta = SseDeltaExtractor.extractDelta(rawChunk);
                                log.debug("delta={}", delta);
                                // 뽑히면 delta로 보내고, 아니면 rawChunk를 그대로 보냄(최소 동작 보장)
                                String payload = (delta != null && !delta.isEmpty()) ? delta : rawChunk;

                                try {
                                    emitter.send(SseEmitter.event().name("delta").data(payload));
                                } catch (IOException e) {
                                    completed.set(true);
                                    if (disposableHolder[0] != null) disposableHolder[0].dispose();
                                }
                            },
                            err -> {
                                if (completed.get()) return;
                                try {
                                    emitter.send(SseEmitter.event().name("error").data("AI 서버 연결에 실패하였습니다... 😥"));
                                } catch (IOException ignored) {}
                                emitter.complete();
                            },
                            () -> {
                                if (completed.get()) return;
                                try {
                                    emitter.send(SseEmitter.event().name("done").data(""));
                                } catch (IOException ignored) {}
                                emitter.complete();
                            }
                    );
        } catch (Exception e) {
            try {
                emitter.send(SseEmitter.event().name("error").data("AI 서버 연결에 실패하였습니다... 😥"));
            } catch (IOException ignored) {}
            emitter.completeWithError(e);
        }

        return emitter;
    }

    public SseEmitter ChatRelayServiceStream(RequestDTO requestDTO) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        AtomicBoolean completed = new AtomicBoolean(false);

        // 요청 횟수 증가(기존과 동일) :contentReference[oaicite:6]{index=6}
        aiUsageService.increase(
                requestDTO.getSessionId(),
                requestDTO.getSessionId(),
                "CHAT"
        );

        // AI Gateway로 보낼 multipart 구성 (기존 ChatRelayService의 JSON과 동일 필드)
        MultipartBodyBuilder builder = setBuilder(requestDTO);

        // 클라이언트가 끊으면 subscription 정리
        final Disposable[] disposableHolder = new Disposable[1];
        emitter.onCompletion(() -> {
            completed.set(true);
            if (disposableHolder[0] != null) disposableHolder[0].dispose();
        });
        emitter.onTimeout(() -> {
            completed.set(true);
            if (disposableHolder[0] != null) disposableHolder[0].dispose();
        });
        emitter.onError(e -> {
            completed.set(true);
            if (disposableHolder[0] != null) disposableHolder[0].dispose();
        });

        try {
            emitter.send(SseEmitter.event().name("start").data(""));
        } catch (IOException ignored) {}

        // 진짜 스트리밍: AI Gateway 스트림(Flux)을 subscribe 해서 emitter로 바로 흘림
        try {
            disposableHolder[0] = aiClientService
                    //.callAIStream(StringUtils.hasText(requestDTO.getTargetFileName())?AI_CHAT_PRIVATE_URL:AI_CHAT_OPEN_URL, requestDTO, builder) 20260410
                    .callAIStream(AI_CHAT_DEFAULT_URL, requestDTO, builder)
                    .subscribe(
                            rawChunk -> {
                                if (completed.get()) return;

                                // rawChunk는 게이트웨이 구현에 따라
                                // - 이미 "data: {...}\n\n" 같은 SSE 조각일 수도 있고
                                // - 그냥 JSON 문자열 조각일 수도 있음
                                // 아래는 OpenAI 스타일 SSE(data: {...})를 최대한 content(delta)로 뽑는 파서
                                String delta = SseDeltaExtractor.extractDelta(rawChunk);
                                log.debug("delta={}", delta);

                                // 뽑히면 delta로 보내고, 아니면 rawChunk를 그대로 보냄(최소 동작 보장)
                                String payload = (delta != null && !delta.isEmpty()) ? delta : rawChunk;

                                try {
                                    emitter.send(SseEmitter.event().name("delta").data(payload));
                                } catch (IOException e) {
                                    completed.set(true);
                                    if (disposableHolder[0] != null) disposableHolder[0].dispose();
                                }
                            },
                            err -> {
                                if (completed.get()) return;
                                try {
                                    emitter.send(SseEmitter.event().name("error").data("AI 서버 연결에 실패하였습니다... 😥"));
                                } catch (IOException ignored) {}
                                emitter.complete();
                            },
                            () -> {
                                if (completed.get()) return;
                                try {
                                    emitter.send(SseEmitter.event().name("done").data(""));
                                } catch (IOException ignored) {}
                                emitter.complete();
                            }
                    );
        } catch (Exception e) {
            try {
                emitter.send(SseEmitter.event().name("error").data("AI 서버 연결에 실패하였습니다... 😥"));
            } catch (IOException ignored) {}
            emitter.completeWithError(e);
        }

        return emitter;
    }

    public SseEmitter DocumentRelayTemplateService(String sessionId, String message, boolean deep, MultipartFile file, String templateKey) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        AtomicBoolean completed = new AtomicBoolean(false);

        String templateJson = "{\n" +
                "    \"doc_number\": \"신사복지 제2026-0042호\",\n" +
                "    \"draft_date\": \"2026. 01. 20.\",\n" +
                "    \"exec_date\": \"2026. 01. 21.\",\n" +
                "    \"via\": \"\",\n" +
                "    \"recipient\": \"내부결재\",\n" +
                "    \"reference\": \"\",\n" +
                "    \"title\": \"2026년 상반기 직원 교육 계획 보고\",\n" +
                "    \"retention\": \"3년\",\n" +
                "    \"sign_manager\": \"김철수\",\n" +
                "    \"sign_drafter\": \"이영희\",\n" +
                "    \"sign_coop\": \"\",\n" +
                "    \"doc_number_2\": \"신사복지 제2026-0042호\",\n" +
                "    \"exec_date_2\": \"2026. 01. 21.\",\n" +
                "    \"via_2\": \"\",\n" +
                "    \"recipient_2\": \"내부결재\",\n" +
                "    \"reference_2\": \"\",\n" +
                "    \"title_2\": \"2026년 상반기 직원 교육 계획 보고\",\n" +
                "    \"items\": [\n" +
                "      {\"text\": \"1. 교육 목적\", \"level\": 1},\n" +
                "      {\"text\": \"직원 역량 강화 및 서비스 품질 향상을 위한 정기 교육 실시\", \"level\": 2},\n" +
                "      {\"text\": \"2. 교육 일정\", \"level\": 1},\n" +
                "      {\"text\": \"2026년 2월 15일 ~ 2월 17일 (3일간)\", \"level\": 2},\n" +
                "      {\"text\": \"3. 교육 대상: 전 직원\", \"level\": 1}\n" +
                "    ],\n" +
                "    \"has_attachment\": false\n" +
                "  }";

        String templateJson2 = "{\n" +
                "    \"recipient\": \"각 부서장\",\n" +
                "    \"via\": \"경영지원팀\",\n" +
                "    \"title\": \"회의실 사용 안내\",\n" +
                "    \"attachment\": \"\",\n" +
                "    \"content_lines\": [\n" +
                "      \"안녕하십니까.\",\n" +
                "      \"\",\n" +
                "      \"2026년 1월 25일부터 3층 대회의실 리모델링 공사로 인해\",\n" +
                "      \"약 2주간 해당 회의실 사용이 제한됨을 알려드립니다.\"\n" +
                "    ]\n" +
                "  }";

        String templateJson3 = "{\n" +
                "    \"meeting_title\": \"1분기 운영 현황 점검 및 향후 추진 계획 논의\",\n" +
                "    \"datetime\": \"2026년 2월 12일 (목) 10:00 ~ 11:30\",\n" +
                "    \"person_in_charge\": \"홍 길동\",\n" +
                "    \"location\": \"본사 3층 회의실\",\n" +
                "    \"attendee_count\": \"팀장, 각 파트 담당자 외 5명\",\n" +
                "    \"agenda\": \"1분기 운영 현황 공유\",\n" +
                "    \"attendees\": [\n" +
                "      {\"affiliation\": \"운영기획팀\", \"name\": \"김 도현\"},\n" +
                "      {\"affiliation\": \"경영지원팀\", \"name\": \"박 지훈\"},\n" +
                "      {\"affiliation\": \"서비스운영팀\", \"name\": \"이 수민\"}\n" +
                "    ],\n" +
                "    \"meeting_content_lines\": [\"1월 대비 2월 업무 요청 건수가 증가함.\", \"특정 부서에 업무가 집중되는 현상이 발생하고 있어 업무 분산 방안이 필요하다는 의견이 제기됨.\", \"일부 업무는 처리 지연 사례가 있었으며, 원인은 인력 공백 및 우선순위 조정 미흡으로 분석됨.\"],\n" +
                "    \"meeting_result_lines\": [\"업무 요청 접수 시 우선순위 기준을 명확히 정의하기로 함.\", \"각 파트별 주간 업무 현황을 공유하는 체계를 강화하기로 함.\"]\n" +
                "  }";

        //요청 횟수 증가
        aiUsageService.increase(sessionId, sessionId, "TEMPLATE");

        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        if (templateKey.equals("A001")) {
            builder.part("template_name", "template.hwpx");
            builder.part("context_data", templateJson);
        } else if (templateKey.equals("A002")) {
            builder.part("template_name", "template2.hwpx");
            builder.part("context_data", templateJson2);
        } else if (templateKey.equals("A003")) {
            builder.part("raw_text", message);
            if (!ObjectUtils.isEmpty(file)) builder.part("file", file.getResource());
            builder.part("expires_in", 36000);
            builder.part("one_time", false);
        }
        builder.part("one_time", false);

        String requestUrl = templateKey.equals("A003") ? AI_MEETING_TEMPLATE_URL : AI_TEMPLATE_URL;

        final Disposable[] disposableHolder = new Disposable[1];
        emitter.onCompletion(() -> {
            completed.set(true);
            if (disposableHolder[0] != null) disposableHolder[0].dispose();
        });
        emitter.onTimeout(() -> {
            completed.set(true);
            if (disposableHolder[0] != null) disposableHolder[0].dispose();
        });
        emitter.onError(e -> {
            completed.set(true);
            if (disposableHolder[0] != null) disposableHolder[0].dispose();
        });

        try {
            emitter.send(SseEmitter.event().name("start").data(""));
        } catch (IOException ignored) {}

        try {
            disposableHolder[0] = aiClientService
                    .callAIStream(requestUrl, builder)
                    .subscribe(
                            rawChunk -> {
                                if (completed.get()) return;
                                String delta = SseDeltaExtractor.extractDelta(rawChunk);
                                log.debug("delta={}", delta);
                                String payload = (delta != null && !delta.isEmpty()) ? delta : rawChunk;
                                try {
                                    emitter.send(SseEmitter.event().name("delta").data(payload));
                                } catch (IOException e) {
                                    completed.set(true);
                                    if (disposableHolder[0] != null) disposableHolder[0].dispose();
                                }
                            },
                            err -> {
                                if (completed.get()) return;
                                try {
                                    emitter.send(SseEmitter.event().name("error").data("AI 서버 연결에 실패하였습니다... 😥"));
                                } catch (IOException ignored) {}
                                emitter.complete();
                            },
                            () -> {
                                if (completed.get()) return;
                                try {
                                    emitter.send(SseEmitter.event().name("done").data(""));
                                } catch (IOException ignored) {}
                                emitter.complete();
                            }
                    );
        } catch (Exception e) {
            try {
                emitter.send(SseEmitter.event().name("error").data("AI 서버 연결에 실패하였습니다... 😥"));
            } catch (IOException ignored) {}
            emitter.completeWithError(e);
        }

        return emitter;
    }

    public MultipartBodyBuilder setBuilder(RequestDTO requestDTO) {
        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        if(requestDTO.isContinue()) {
            builder.part("thread_id",requestDTO.getThreadId());
            builder.part("response", requestDTO.getMessage());
            if(!StringUtils.isEmpty(requestDTO.getTranslate_to())) builder.part("translate_to",requestDTO.getTranslate_to());
        } else if(StringUtils.hasText(requestDTO.getTargetFileName())) {
            builder.part("message", requestDTO.getMessage());
            builder.part("target_filename", requestDTO.getTargetFileName());
            if(!StringUtils.isEmpty(requestDTO.getTranslate_to())) builder.part("translate_to",requestDTO.getTranslate_to());
        } else {
            builder.part("message", requestDTO.getMessage());
            if(!StringUtils.isEmpty(requestDTO.getTranslate_to())) builder.part("translate_to",requestDTO.getTranslate_to());
        }

        return builder;
    }

    public MultipartBodyBuilder setMultiPartBuilder(RequestDTO requestDTO, MultipartFile file) {
        String originalFileName = file.getOriginalFilename();
        String fileName = originalFileName.substring(0,originalFileName.lastIndexOf("."));
        String ext = originalFileName.substring(originalFileName.lastIndexOf(".")+1);

        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        builder.part("attachFile_name", originalFileName);
        builder.part("attachFile_bin", file.getResource())
                .filename(originalFileName)
                .contentType(MediaType.APPLICATION_OCTET_STREAM);

        return builder;
    }

    @Cacheable(value = "FILES", key = "#sessionId", unless = "#result == null")
    public List<String> requestFileList(String sessionId) {
        try {
            String response = WebUtilsCustom.requestGet(AI_FILES_URL, sessionId);
            // 1. 응답값 비었는지 체크
            if (response.isEmpty()) {
                return Collections.emptyList();
            }

            JSONObject json = new JSONObject(response);

            // 2. 키 존재 여부 및 null 체크
            if (!json.has("files") || json.isNull("files")) {
                return Collections.emptyList();
            }

            // 3. JSONArray를 안전하게 List<String>으로 변환
            JSONArray jsonArray = json.getJSONArray("files");
            List<String> fileList = new ArrayList<>();

            for (int i = 0; i < jsonArray.length(); i++) {
                fileList.add(jsonArray.getString(i));
            }

            return fileList;
        } catch (Exception e) {
            log.error("파일 목록 요청 중 오류 발생: sessionId={}", sessionId, e);
            return Collections.emptyList(); // 혹은 예외를 다시 던짐
        }
    }

    public JSONObject getChatHistory(String sessionId) {
        ResponseEntity<String> response =
                restTemplate.getForEntity(
                        AI_CHAT_HISTORY_URL + "/" + sessionId,
                        String.class
                );

        String raw = response.getBody();
        log.debug("raw body={}", raw);

        return new JSONObject(raw);
    }
}
