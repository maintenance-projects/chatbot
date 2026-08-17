package kr.co.ultari.chatbot.generate;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;

/**
 * 챗봇 진입 URL({@code /chatbot/{key}})의 사용자 식별자 보호.
 * <p>클라이언트가 {@code 아이디|yyyyMMddHHmmss}(예 {@code USER_ID|20260813142030})를 AES-256-CBC로
 * 암호화(Base64)해 보내면, 서버가 복호화·시각검증 후 사용자 아이디를 돌려준다.
 * <ul>
 *   <li>{@code encrypt-enabled=true}(엄격): <b>암호화 토큰만</b> 허용. 복호화/포맷/시각 실패 시 {@code null}(접근 거부).</li>
 *   <li>{@code encrypt-enabled=false}(호환): <b>평문 아이디와 암호화 토큰을 모두</b> 허용. 유효한 암호화 토큰이면
 *       그 아이디를, 아니면 {@code {key}}를 평문 아이디로 사용(전환기용).</li>
 * </ul>
 * 시각은 한국시간(Asia/Seoul) 기준, 현재로부터 과거·미래 {@code window-seconds}(기본 300초=±5분) 이내만 통과.
 * <p><b>인코딩</b>: URL 경로에 담기므로 클라이언트는 URL-safe Base64({@code -},{@code _})를 권장.
 * 서버는 url-safe/표준 Base64를 모두 허용한다.
 */
@Slf4j
@Component
public class ChatbotLoginCrypto {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    @Value("${ultari.chatbot.login.encrypt-enabled:false}")
    private boolean enabled;

    @Value("${ultari.chatbot.login.encrypt-key:}")
    private String encKey;

    @Value("${ultari.chatbot.login.encrypt-iv:}")
    private String encIv;

    /** 허용 시간창(초). 현재로부터 과거·미래 이 값 이내면 통과. 기본 300(±5분). */
    @Value("${ultari.chatbot.login.encrypt-window-seconds:300}")
    private long windowSeconds;

    public boolean isEnabled() {
        return enabled;
    }

    /**
     * URL의 {@code key}를 실제 사용자 아이디로 해석한다.
     * enabled=false면 원문 그대로, enabled=true면 복호화·시각검증 후 아이디(실패 시 null).
     */
    public String resolveUserId(String key) {
        String userId = tryDecrypt(key);
        if (userId != null) {
            return userId; // 유효한 암호화 토큰(복호화+시각검증 통과)
        }
        if (enabled) {
            // strict(true): 암호화 토큰만 허용 → 복호화/포맷/시각 실패면 거부
            log.debug("[chatbot login] invalid/expired token (strict, enabled=true)");
            return null;
        }
        // 호환(false): 암호화 토큰이 아니면 평문 아이디로 처리 → 평문/암호화 둘 다 허용
        return key;
    }

    /** 암호화 토큰이면 시각검증까지 통과한 userId, 아니면(복호화/포맷/시각 실패) null. */
    private String tryDecrypt(String key) {
        try {
            String plain = decrypt(key);                 // "USER_ID|yyyyMMddHHmmss"
            int sep = plain.lastIndexOf('|');
            if (sep <= 0 || sep >= plain.length() - 1) {
                return null;
            }
            String userId = plain.substring(0, sep);
            String timestamp = plain.substring(sep + 1);
            if (!isWithinWindow(timestamp)) {
                return null;
            }
            return userId;
        } catch (Exception e) {
            return null;
        }
    }

    private String decrypt(String token) throws Exception {
        byte[] cipherText = base64Decode(token);
        Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
        SecretKeySpec keySpec = new SecretKeySpec(encKey.getBytes(StandardCharsets.UTF_8), "AES");
        IvParameterSpec ivSpec = new IvParameterSpec(encIv.getBytes(StandardCharsets.UTF_8));
        cipher.init(Cipher.DECRYPT_MODE, keySpec, ivSpec);
        return new String(cipher.doFinal(cipherText), StandardCharsets.UTF_8);
    }

    private boolean isWithinWindow(String timestamp) {
        try {
            ZonedDateTime reqTime = LocalDateTime.parse(timestamp, TS).atZone(KST);
            long diffSeconds = Math.abs(Duration.between(reqTime, ZonedDateTime.now(KST)).getSeconds());
            return diffSeconds <= windowSeconds;
        } catch (Exception e) {
            return false;
        }
    }

    /** url-safe/표준 Base64 모두 허용(패딩 없어도 보정). */
    private static byte[] base64Decode(String s) {
        String norm = s.replace('-', '+').replace('_', '/');
        int rem = norm.length() % 4;
        if (rem > 0) {
            norm += "====".substring(rem);
        }
        return Base64.getDecoder().decode(norm);
    }
}
