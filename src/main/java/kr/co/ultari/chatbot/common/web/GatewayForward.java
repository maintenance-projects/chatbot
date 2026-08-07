package kr.co.ultari.chatbot.common.web;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

/**
 * 게이트웨이 응답(상태코드·본문)을 브라우저로 그대로 전달하기 위한 헬퍼.
 * WebClient 응답의 hop-by-hop 헤더는 버리고 상태/컨텐츠타입/본문만 재구성한다.
 */
public final class GatewayForward {

    private GatewayForward() {
    }

    /** JSON 응답 전달(컨텐츠타입 없으면 application/json). */
    public static ResponseEntity<String> json(ResponseEntity<String> res) {
        return as(res, MediaType.APPLICATION_JSON);
    }

    /** 지정 fallback 컨텐츠타입으로 전달(게이트웨이가 컨텐츠타입을 주면 그것을 사용). */
    public static ResponseEntity<String> as(ResponseEntity<String> res, MediaType fallback) {
        MediaType ct = res.getHeaders().getContentType();
        return ResponseEntity.status(res.getStatusCode())
                .contentType(ct != null ? ct : fallback)
                .body(res.getBody());
    }
}
