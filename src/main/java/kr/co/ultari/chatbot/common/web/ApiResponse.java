package kr.co.ultari.chatbot.common.web;

import lombok.Getter;

/**
 * 앱이 브라우저로 내려주는 JSON 단건 응답 봉투(명세서 관리자 코드 규약과 일치).
 * <pre>{ "code": "0000", "message": "성공", "data": ... }</pre>
 */
@Getter
public class ApiResponse<T> {

    private final String code;
    private final String message;
    private final T data;

    private ApiResponse(String code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
    }

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(ResultCode.SUCCESS.code(), ResultCode.SUCCESS.defaultMessage(), data);
    }

    public static <T> ApiResponse<T> of(ResultCode rc, T data) {
        return new ApiResponse<>(rc.code(), rc.defaultMessage(), data);
    }

    public static <T> ApiResponse<T> fail(ResultCode rc, String message) {
        return new ApiResponse<>(rc.code(), message != null ? message : rc.defaultMessage(), null);
    }
}
