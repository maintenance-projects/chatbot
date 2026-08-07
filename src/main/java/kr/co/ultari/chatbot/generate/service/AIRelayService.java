package kr.co.ultari.chatbot.generate.service;

import kr.co.ultari.chatbot.database.service.AIUsageService;
import kr.co.ultari.chatbot.generate.datamodel.dto.RequestDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.Disposable;
import reactor.core.publisher.Flux;

import java.io.IOException;
import java.util.function.Supplier;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Service
public class AIRelayService {
    private static final long SSE_TIMEOUT_MS = 300_000L;
    private static final String GATEWAY_ERROR_MESSAGE = "AI 서버 연결에 실패하였습니다... 😥";

    @Value("${ultari.ai-gateway.chat-default-url:}")
    private String AI_CHAT_DEFAULT_URL;

    @Value("${ultari.ai-gateway.upload-url:}")
    private String AI_UPLOAD_URL;

    @Autowired
    AIUsageService aiUsageService;

    @Autowired
    CachedService cachedService;

    private final AIRelayClientService aiClientService;

    public AIRelayService(AIRelayClientService aiClientService) {
        this.aiClientService = aiClientService;
    }

    public SseEmitter ChatRelayServiceStream(RequestDTO requestDTO) {
        // 요청 횟수 증가
        aiUsageService.increase(
                requestDTO.getSessionId(),
                requestDTO.getSessionId(),
                "CHAT"
        );

        // AI Gateway로 보낼 multipart 구성
        MultipartBodyBuilder builder = setBuilder(requestDTO);

        return pipeStream(
                () -> aiClientService.callAIStream(AI_CHAT_DEFAULT_URL, requestDTO, builder),
                null
        );
    }

    /**
     * AI Gateway 스트림(Flux)을 SSE emitter로 그대로 중계하는 공통 처리.
     * start → delta* → (done | error) 이벤트 계약과 구독 정리(dispose) 로직을 캡슐화한다.
     *
     * @param streamSupplier 게이트웨이 SSE 스트림 공급자(예외를 error 이벤트로 변환하기 위해 구독 시점에 평가)
     * @param onStreamDone   정상 완료 시 done 이벤트 전송 전에 실행할 후처리(없으면 null)
     */
    private SseEmitter pipeStream(Supplier<Flux<String>> streamSupplier, Runnable onStreamDone) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        AtomicBoolean completed = new AtomicBoolean(false);

        // 클라이언트가 끊으면 subscription 정리
        final Disposable[] disposableHolder = new Disposable[1];
        Runnable dispose = () -> {
            completed.set(true);
            if (disposableHolder[0] != null) disposableHolder[0].dispose();
        };
        emitter.onCompletion(dispose);
        emitter.onTimeout(dispose);
        emitter.onError(e -> dispose.run());

        try {
            emitter.send(SseEmitter.event().name("start").data(""));
        } catch (IOException ignored) {}

        // 진짜 스트리밍: AI Gateway 스트림(Flux)을 subscribe 해서 emitter로 바로 흘림
        try {
            disposableHolder[0] = streamSupplier.get().subscribe(
                    rawChunk -> {
                        if (completed.get()) return;
                        // rawChunk는 게이트웨이 구현에 따라 "data: {...}" SSE 조각이거나 JSON 조각.
                        // OpenAI 스타일 SSE(data: {...})에서 content(delta)를 최대한 뽑는다.
                        String delta = SseDeltaExtractor.extractDelta(rawChunk);
                        log.debug("delta={}", delta);
                        // 뽑히면 delta로, 아니면 rawChunk 그대로 전송(최소 동작 보장)
                        String payload = (delta != null && !delta.isEmpty()) ? delta : rawChunk;
                        try {
                            emitter.send(SseEmitter.event().name("delta").data(payload));
                        } catch (IOException e) {
                            dispose.run();
                        }
                    },
                    err -> {
                        if (completed.get()) return;
                        try {
                            emitter.send(SseEmitter.event().name("error").data(GATEWAY_ERROR_MESSAGE));
                        } catch (IOException ignored) {}
                        emitter.complete();
                    },
                    () -> {
                        if (onStreamDone != null) onStreamDone.run();
                        if (completed.get()) return;
                        try {
                            emitter.send(SseEmitter.event().name("done").data(""));
                        } catch (IOException ignored) {}
                        emitter.complete();
                    }
            );
        } catch (Exception e) {
            try {
                emitter.send(SseEmitter.event().name("error").data(GATEWAY_ERROR_MESSAGE));
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

    /**
     * 메신저 첨부파일을 AI 게이트웨이에 사전 등록한다.
     * 추론(요약/답변) 없이 파일만 업로드하며, 이후 대화에서 해당 파일을 참조할 수 있다.
     *
     * @return AI 게이트웨이 응답 본문(JSON 문자열), 실패 시 null
     */
    public String uploadFile(String sessionId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return null;
        }

        String originalFileName = file.getOriginalFilename();

        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        builder.part("attachFile_name", originalFileName);
        builder.part("attachFile_bin", file.getResource())
                .filename(originalFileName)
                .contentType(MediaType.APPLICATION_OCTET_STREAM);

        String response = aiClientService.callAI(AI_UPLOAD_URL, sessionId, builder);

        // 파일 목록 캐시 무효화 (새 파일이 등록되었으므로)
        cachedService.FilesCacheClear(sessionId);

        return response;
    }

}
