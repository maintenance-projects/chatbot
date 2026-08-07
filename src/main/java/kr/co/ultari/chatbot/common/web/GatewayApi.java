package kr.co.ultari.chatbot.common.web;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 신규(재구성) 게이트웨이 릴레이 컨트롤러 마커.
 * {@link GatewayExceptionHandler}의 적용 범위를 이 마커가 붙은 컨트롤러로 한정해
 * 기존 컨트롤러의 에러 처리에 영향을 주지 않는다.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface GatewayApi {
}
