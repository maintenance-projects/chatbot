package kr.co.ultari.chatbot.common.sse;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.Disposable;
import reactor.core.publisher.Flux;

import java.io.IOException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Supplier;

/**
 * 게이트웨이 SSE 스트림을 브라우저로 <b>투명 전달</b>한다.
 * <p>신규 명세의 프론트는 {@code data: {"type": ...}} 를 직접 파싱하므로,
 * 각 청크(JSON 페이로드)를 가공 없이 그대로 {@code data:} 라인으로 흘려보낸다.
 * 구독 정리(dispose)·타임아웃·에러 처리는 여기서 캡슐화한다.
 */
@Slf4j
@Component
public class SseRelay {

    private static final long SSE_TIMEOUT_MS = 300_000L;
    private static final String ERROR_EVENT =
            "{\"type\":\"error\",\"detail\":\"AI 서버 연결에 실패하였습니다.\"}";

    /** 스트림을 투명 중계한다. */
    public SseEmitter relay(Supplier<Flux<String>> streamSupplier) {
        return relay(streamSupplier, null);
    }

    /**
     * 스트림을 투명 중계한다.
     *
     * @param streamSupplier 게이트웨이 SSE 스트림 공급자(예외를 error 이벤트로 변환하기 위해 구독 시점에 평가)
     * @param onComplete     정상 완료 시 실행할 후처리(예: 캐시 무효화). 없으면 null
     */
    public SseEmitter relay(Supplier<Flux<String>> streamSupplier, Runnable onComplete) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        AtomicBoolean completed = new AtomicBoolean(false);

        final Disposable[] holder = new Disposable[1];
        Runnable dispose = () -> {
            completed.set(true);
            if (holder[0] != null) holder[0].dispose();
        };
        emitter.onCompletion(dispose);
        emitter.onTimeout(dispose);
        emitter.onError(e -> dispose.run());

        try {
            holder[0] = streamSupplier.get().subscribe(
                    chunk -> {
                        if (completed.get()) return;
                        try {
                            // 투명 전달: 청크(JSON)를 그대로 data: 라인으로 전송
                            emitter.send(chunk);
                        } catch (IOException e) {
                            dispose.run();
                        }
                    },
                    err -> {
                        log.warn("gateway stream error", err);
                        if (completed.get()) return;
                        try {
                            emitter.send(ERROR_EVENT);
                        } catch (IOException ignored) {}
                        emitter.complete();
                    },
                    () -> {
                        if (onComplete != null) onComplete.run();
                        if (completed.get()) return;
                        emitter.complete();
                    }
            );
        } catch (Exception e) {
            log.warn("gateway stream subscribe failed", e);
            try {
                emitter.send(ERROR_EVENT);
            } catch (IOException ignored) {}
            emitter.completeWithError(e);
        }

        return emitter;
    }
}
