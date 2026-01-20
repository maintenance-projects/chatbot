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
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.Disposable;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

@Slf4j
@Service
public class AIRelayService {

    @Value("${ultari.ai-gateway.url:}")
    private String AI_GATE_URL;

    @Autowired
    AIUsageService aiUsageService;

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

        //요청 횟수 증가
        aiUsageService.increase(
                requestDTO.getSessionId(),
                requestDTO.getSessionId(),
                "CHAT"
        );

        CompletableFuture<String> future =
                CompletableFuture.supplyAsync(() -> {
                    try {
                        return WebUtilsCustom.requestMultipart(AI_GATE_URL, requestDTO.getSessionId(), body);
                    } catch (Exception e) {
                        log.error("",e);
                        return "AI 서버 연결에 실패하였습니다... 😥";
                    }
                }, aiExecutor);

        try {
            return future.get(120, TimeUnit.SECONDS);
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
                        String response = aiClientService.callAI(AI_GATE_URL, sessionId, builder);
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
            return future.get(120, TimeUnit.SECONDS);
        } catch (Exception e) {
            log.error("", e);
            return "AI 서버 응답이 지연되고 있습니다. 다시 시도해 주시기 바랍니다... 😥";
        }
    }

    public SseEmitter ChatRelayServiceStream(String sessionId, String message, boolean deep, MultipartFile file) {
        SseEmitter emitter = new SseEmitter(0L); // timeout 없음
        AtomicBoolean completed = new AtomicBoolean(false);

        String originalFileName = file.getOriginalFilename();
        String fileName = originalFileName.substring(0,originalFileName.lastIndexOf("."));
        String ext = originalFileName.substring(originalFileName.lastIndexOf(".")+1);

        aiUsageService.increase(
                sessionId,
                sessionId,
                "DOCUMENT"
        );

        // AI Gateway로 보낼 multipart 구성 (기존 ChatRelayService의 JSON과 동일 필드)
        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        builder.part("message", fileName + "\n" + message);
        builder.part("attachFile_name", fileName);
        builder.part("attachFile_extension", ext);
        builder.part("attachFile_bin", file.getResource())
                .filename(originalFileName)
                .contentType(MediaType.APPLICATION_OCTET_STREAM);
        builder.part("deepResearch", deep);

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
                    .callAIStream(AI_GATE_URL, sessionId, builder)
                    .subscribe(
                            rawChunk -> {
                                if (completed.get()) return;
                                // rawChunk는 게이트웨이 구현에 따라
                                // - 이미 "data: {...}\n\n" 같은 SSE 조각일 수도 있고
                                // - 그냥 JSON 문자열 조각일 수도 있음
                                // 아래는 OpenAI 스타일 SSE(data: {...})를 최대한 content(delta)로 뽑는 파서
                                String delta = extractDelta(rawChunk);

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
                                emitter.completeWithError(err);
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

    public SseEmitter ChatRelayServiceAudioStream(String sessionId, MultipartFile file) {
        SseEmitter emitter = new SseEmitter(0L); // timeout 없음
        AtomicBoolean completed = new AtomicBoolean(false);

        aiUsageService.increase(
                sessionId,
                sessionId,
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
                    .callAIStream("http://10.0.0.92:8000/call-summary", sessionId, builder)
                    .subscribe(
                            rawChunk -> {
                                if (completed.get()) return;

                                // rawChunk는 게이트웨이 구현에 따라
                                // - 이미 "data: {...}\n\n" 같은 SSE 조각일 수도 있고
                                // - 그냥 JSON 문자열 조각일 수도 있음
                                // 아래는 OpenAI 스타일 SSE(data: {...})를 최대한 content(delta)로 뽑는 파서
                                String delta = extractDelta(rawChunk);

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
                                emitter.completeWithError(err);
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
        SseEmitter emitter = new SseEmitter(0L); // timeout 없음
        AtomicBoolean completed = new AtomicBoolean(false);

        // 요청 횟수 증가(기존과 동일) :contentReference[oaicite:6]{index=6}
        aiUsageService.increase(
                requestDTO.getSessionId(),
                requestDTO.getSessionId(),
                "CHAT"
        );

        // AI Gateway로 보낼 multipart 구성 (기존 ChatRelayService의 JSON과 동일 필드)
        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        builder.part("message", requestDTO.getMessage());
        builder.part("attachFile_name", "");
        builder.part("attachFile_extension", "");
        builder.part("attachFile_bin", "");
        builder.part("deepResearch", requestDTO.isDeepResearch());

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
                    .callAIStream(AI_GATE_URL, requestDTO.getSessionId(), builder)
                    .subscribe(
                            rawChunk -> {
                                if (completed.get()) return;

                                // rawChunk는 게이트웨이 구현에 따라
                                // - 이미 "data: {...}\n\n" 같은 SSE 조각일 수도 있고
                                // - 그냥 JSON 문자열 조각일 수도 있음
                                // 아래는 OpenAI 스타일 SSE(data: {...})를 최대한 content(delta)로 뽑는 파서
                                String delta = extractDelta(rawChunk);

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
                                emitter.completeWithError(err);
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

    private String extractDelta(String raw) {
        if (raw == null) return null;

        // 여러 줄이 섞여올 수 있어 line 단위 처리
        StringBuilder out = new StringBuilder();
        String[] lines = raw.split("\n");
        for (String line : lines) {
            String s = line.trim();
            if (s.isEmpty()) continue;

            if (s.startsWith("data:")) {
                String data = s.substring(5).trim();
                if (data.equals("[DONE]")) continue;

                // JSON이면 delta.content 우선 추출
                try {
                    JSONObject obj = new JSONObject(data);

                    // OpenAI: choices[0].delta.content
                    if (obj.has("choices")) {
                        var choices = obj.getJSONArray("choices");
                        if (!choices.isEmpty()) {
                            var c0 = choices.getJSONObject(0);

                            if (c0.has("delta")) {
                                var delta = c0.getJSONObject("delta");
                                if (delta.has("content")) out.append(delta.getString("content"));
                            } else if (c0.has("message")) {
                                var msg = c0.getJSONObject("message");
                                if (msg.has("content")) out.append(msg.getString("content"));
                            }
                        }
                    } else if (obj.has("content")) {
                        out.append(obj.getString("content"));
                    } else if (obj.has("percent")) {
                        out.append(obj.getString("percent"));
                    }
                } catch (Exception ignore) {
                    // JSON 파싱 실패면 그냥 데이터 텍스트로 붙임
                    out.append(data);
                }
            } else {
                // SSE 포맷이 아닌 경우 그대로
                out.append(line);
            }
        }

        return out.toString();
    }

    public SseEmitter ChatRelayServiceTemplatesStream(String sessionId, String message, boolean deep, MultipartFile file, String templateKey) {
        SseEmitter emitter = new SseEmitter(0L); // timeout 없음
        AtomicBoolean completed = new AtomicBoolean(false);

        /*String originalFileName = file.getOriginalFilename();
        String fileName = originalFileName.substring(0,originalFileName.lastIndexOf("."));
        String ext = originalFileName.substring(originalFileName.lastIndexOf(".")+1);*/

        aiUsageService.increase(
                sessionId,
                sessionId,
                "DOCUMENT"
        );

        // AI Gateway로 보낼 multipart 구성 (기존 ChatRelayService의 JSON과 동일 필드)
        MultipartBodyBuilder builder = new MultipartBodyBuilder();
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
        if(templateKey.equals("A001")) {
            builder.part("template_name", "template.hwpx");
            builder.part("context_data", templateJson);
        } else if(templateKey.equals("A002")) {
            builder.part("template_name", "template2.hwpx");
            builder.part("context_data", templateJson2);
        }
        /*builder.part("message", message);
        builder.part("attachFile_name", fileName);
        builder.part("attachFile_extension", ext);
        builder.part("attachFile_bin", file.getResource())
                .filename(originalFileName)
                .contentType(MediaType.APPLICATION_OCTET_STREAM);
        builder.part("deepResearch", deep);*/

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
                    .callAIStream("http://10.0.0.92:8000/documents/generate-hwpx", builder)
                    .subscribe(
                            rawChunk -> {
                                if (completed.get()) return;

                                // rawChunk는 게이트웨이 구현에 따라
                                // - 이미 "data: {...}\n\n" 같은 SSE 조각일 수도 있고
                                // - 그냥 JSON 문자열 조각일 수도 있음
                                // 아래는 OpenAI 스타일 SSE(data: {...})를 최대한 content(delta)로 뽑는 파서
                                String delta = extractDelta(rawChunk);

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
                                emitter.completeWithError(err);
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

    public String DocumentRelayTemplateService(String sessionId, String message, boolean deep, MultipartFile file, String templateKey) {
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

        //요청 횟수 증가
        aiUsageService.increase(
                sessionId,
                sessionId,
                "DOCUMENT"
        );

        CompletableFuture<String> future =
                CompletableFuture.supplyAsync(() -> {
                    MultipartBodyBuilder builder = new MultipartBodyBuilder();
                    if(templateKey.equals("A001")) {
                        builder.part("template_name", "template.hwpx");
                        builder.part("context_data", templateJson);
                    } else if(templateKey.equals("A002")) {
                        builder.part("template_name", "template2.hwpx");
                        builder.part("context_data", templateJson2);
                    }

                    try {
                        String response = aiClientService.callAI("http://10.0.0.92:8000/documents/generate-hwpx", builder);
                        JSONObject res = new JSONObject(response);
                        return res.toString();
                    } catch (Exception e) {
                        log.error("",e);
                        return "AI 서버 연결에 실패하였습니다... 😥";
                    }

                }, aiExecutor);

        try {
            return future.get(120, TimeUnit.SECONDS);
        } catch (Exception e) {
            log.error("", e);
            return "AI 서버 응답이 지연되고 있습니다. 다시 시도해 주시기 바랍니다... 😥";
        }
    }
}
