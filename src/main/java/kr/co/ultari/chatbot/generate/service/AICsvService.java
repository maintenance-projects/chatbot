package kr.co.ultari.chatbot.generate.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import lombok.var;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.Disposable;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
@RequiredArgsConstructor
@Slf4j
public class AICsvService {

    @Value("${ultari.ai.temp.path:tmp}")
    String tempPath;

    private final AIRelayClientService aiClientService;

    public SseEmitter callAiServer(Path csvPath, String sessionId) throws Exception {
        SseEmitter emitter = new SseEmitter(0L);
        AtomicBoolean completed = new AtomicBoolean(false);

        MultipartFile file = pathToMultipartFile(csvPath);
        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        builder.part("csv_file",file.getResource());

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
                    .callAIStream("http://10.0.0.111:8000/convert/dialogue-summary", builder)
                    .subscribe(
                            rawChunk -> {
                                if (completed.get()) return;
                                log.debug(rawChunk);
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

    public MultipartFile pathToMultipartFile(Path path) throws Exception {
        try (InputStream is = Files.newInputStream(path)) {
            return new MockMultipartFile(
                    "csv_file",                              // ⭐ form field name (중요)
                    path.getFileName().toString(),       // original filename
                    Files.probeContentType(path),        // content-type
                    is
            );
        }
    }

}
