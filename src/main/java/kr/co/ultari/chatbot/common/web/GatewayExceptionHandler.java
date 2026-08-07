package kr.co.ultari.chatbot.common.web;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 신규 게이트웨이 릴레이 컨트롤러({@link GatewayApi})에 한정된 예외 처리.
 * <p>게이트웨이의 정상적 4xx/5xx 응답은 본문째 통과되므로 여기 오지 않는다.
 * 여기서는 게이트웨이 연결 실패 등 인프라성 예외만 표준 봉투로 변환한다.
 */
@Slf4j
@RestControllerAdvice(annotations = GatewayApi.class)
public class GatewayExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> badRequest(IllegalArgumentException e) {
        log.warn("bad request", e);
        return ResponseEntity.badRequest()
                .body(ApiResponse.fail(ResultCode.BAD_REQUEST, e.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> serverError(Exception e) {
        log.error("gateway relay error", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.fail(ResultCode.SERVER_ERROR, "AI 서버 처리 중 오류가 발생했습니다."));
    }
}
