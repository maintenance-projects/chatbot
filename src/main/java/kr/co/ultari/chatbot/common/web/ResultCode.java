package kr.co.ultari.chatbot.common.web;

/**
 * 관리자 API 공통 응답 코드(명세서 4장 규약).
 * 0000 성공 / 4000 잘못된 요청 / 4004 리소스 없음 / 5000 서버 오류
 */
public enum ResultCode {

    SUCCESS("0000", "성공"),
    BAD_REQUEST("4000", "잘못된 요청"),
    NOT_FOUND("4004", "리소스 없음"),
    SERVER_ERROR("5000", "서버 오류");

    private final String code;
    private final String defaultMessage;

    ResultCode(String code, String defaultMessage) {
        this.code = code;
        this.defaultMessage = defaultMessage;
    }

    public String code() {
        return code;
    }

    public String defaultMessage() {
        return defaultMessage;
    }
}
