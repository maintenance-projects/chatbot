package kr.co.ultari.chatbot.generate.service;

import kr.co.ultari.chatbot.database.service.AIUsageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import lombok.var;
import org.springframework.beans.factory.annotation.Autowired;
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
    private static final long SSE_TIMEOUT_MS = 300_000L;

    @Value("${ultari.ai-gateway.dialog-summary-url:http://10.0.0.111:8000/convert/dialogue-summary}")
    String AI_DIALOG_URL;

    @Autowired
    AIUsageService aiUsageService;

    private final AIRelayClientService aiClientService;

    public SseEmitter callAiServer(Path csvPath, String sessionId) throws Exception {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        AtomicBoolean completed = new AtomicBoolean(false);

        aiUsageService.increase(
                sessionId,
                sessionId,
                "DIALOG"
        );

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
                    .callAIStream(AI_DIALOG_URL, builder)
                    .subscribe(
                            rawChunk -> {
                                if (completed.get()) return;
                                log.debug(rawChunk);
                                // rawChunk는 게이트웨이 구현에 따라
                                // - 이미 "data: {...}\n\n" 같은 SSE 조각일 수도 있고
                                // - 그냥 JSON 문자열 조각일 수도 있음
                                // 아래는 OpenAI 스타일 SSE(data: {...})를 최대한 content(delta)로 뽑는 파서
                                String delta = SseDeltaExtractor.extractDelta(rawChunk);

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
