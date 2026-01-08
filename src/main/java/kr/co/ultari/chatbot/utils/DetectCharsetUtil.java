package kr.co.ultari.chatbot.utils;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.*;

public class DetectCharsetUtil {

    public static Charset detectCharset(MultipartFile file) throws IOException {
        byte[] bytes = file.getBytes();

        // 1. UTF-8 BOM
        if (hasUtf8Bom(bytes)) {
            return StandardCharsets.UTF_8;
        }

        // 2. UTF-8 유효성 검사
        if (isValidUtf8(bytes)) {
            return StandardCharsets.UTF_8;
        }

        // 3. EUC-KR 패턴
        if (looksLikeEucKr(bytes)) {
            return Charset.forName("EUC-KR");
        }

        // 4. 기본값 (국내 서비스 기준)
        return Charset.forName("EUC-KR");
    }

    private static boolean hasUtf8Bom(byte[] bytes) {
        return bytes.length >= 3
                && (bytes[0] & 0xFF) == 0xEF
                && (bytes[1] & 0xFF) == 0xBB
                && (bytes[2] & 0xFF) == 0xBF;
    }

    private static boolean isValidUtf8(byte[] bytes) {
        CharsetDecoder decoder = StandardCharsets.UTF_8
                .newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT);

        try {
            decoder.decode(ByteBuffer.wrap(bytes));
            return true;
        } catch (CharacterCodingException e) {
            return false;
        }
    }

    private static boolean looksLikeEucKr(byte[] bytes) {
        for (int i = 0; i < bytes.length - 1; i++) {
            int b1 = bytes[i] & 0xFF;
            int b2 = bytes[i + 1] & 0xFF;

            if (b1 >= 0xB0 && b1 <= 0xC8 &&
                    b2 >= 0xA1 && b2 <= 0xFE) {
                return true;
            }
        }
        return false;
    }
}
