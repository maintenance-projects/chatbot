package kr.co.ultari.chatbot.attach;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * LF/CRLF 를 모두 허용하는 관대한 {@code multipart/form-data} 파서(/chatbot/attach 전용 우회).
 * <p>Tomcat 11 표준 파서는 규격대로 CRLF 를 요구해 bare LF 멀티파트를 크기초과(413)로 거부한다.
 * 클라이언트가 급히 CRLF 로 못 바꾸는 경우를 대비해, 이 파서는 경계(boundary) 앞뒤 줄바꿈을
 * {@code \r\n}/{@code \n} 모두 인정한다. <b>파일 내용은 경계 사이 바이트를 그대로 잘라내 무손상</b>.
 * <p>토글 {@code ultari.chatbot.attach.lenient-multipart} 로 켜고 끈다(끄면 표준 파서로 원복).
 */
public final class LenientMultipartParser {

    /** 파싱 결과: 일반 필드 + 파일 파트(파일명/바이트) */
    public static final class Result {
        public final Map<String, String> fields = new HashMap<>();
        public String fileFieldName;
        public String fileName;
        public byte[] fileBytes;
    }

    private static final Pattern ATTR = Pattern.compile("(?i)\\b%s\\s*=\\s*\"([^\"]*)\"");

    private LenientMultipartParser() {
    }

    /** 스트림에서 최대 maxBytes 까지 읽어 파싱. 초과 시 IOException. */
    public static Result parse(InputStream in, String boundary, int maxBytes) throws IOException {
        return parse(readAll(in, maxBytes), boundary);
    }

    public static Result parse(byte[] data, String boundary) {
        Result r = new Result();
        if (data == null || boundary == null || boundary.isEmpty()) return r;
        byte[] delim = ("--" + boundary).getBytes(StandardCharsets.US_ASCII);

        int pos = indexOf(data, delim, 0);
        while (pos >= 0) {
            int afterDelim = pos + delim.length;
            // 닫는 경계 "--boundary--"
            if (afterDelim + 1 < data.length && data[afterDelim] == '-' && data[afterDelim + 1] == '-') break;
            int headStart = skipLineEnding(data, afterDelim);
            int next = indexOf(data, delim, headStart);
            if (next < 0) break;

            int partEnd = stripTrailingLineEnding(data, headStart, next); // 경계 앞 CRLF/LF 제거
            int[] hb = splitHeaderBody(data, headStart, partEnd);         // [headerEnd, bodyStart]
            if (hb != null) {
                String headers = new String(data, headStart, hb[0] - headStart, StandardCharsets.UTF_8);
                String name = attr(headers, "name");
                String filename = attr(headers, "filename");
                if (filename != null) {
                    r.fileFieldName = name;
                    r.fileName = filename;
                    r.fileBytes = Arrays.copyOfRange(data, hb[1], partEnd);
                } else if (name != null) {
                    // 값 끝의 여분 CR/LF(클라이언트가 value 뒤 빈 줄을 더 붙이는 경우) 제거
                    r.fields.put(name, new String(data, hb[1], partEnd - hb[1], StandardCharsets.UTF_8).strip());
                }
            }
            pos = next;
        }
        return r;
    }

    /** Content-Type 헤더에서 boundary 값 추출(따옴표 허용). */
    public static String extractBoundary(String contentType) {
        if (contentType == null) return null;
        Matcher m = Pattern.compile("(?i)boundary\\s*=\\s*\"?([^\";]+)\"?").matcher(contentType);
        return m.find() ? m.group(1).trim() : null;
    }

    // ── helpers ──────────────────────────────────────────────
    private static String attr(String headers, String key) {
        Matcher m = Pattern.compile(String.format(ATTR.pattern(), Pattern.quote(key))).matcher(headers);
        return m.find() ? m.group(1) : null;
    }

    private static int skipLineEnding(byte[] d, int i) {
        if (i + 1 < d.length && d[i] == '\r' && d[i + 1] == '\n') return i + 2;
        if (i < d.length && d[i] == '\n') return i + 1;
        return i;
    }

    /** next(경계 시작) 바로 앞의 CRLF/LF 를 제외한 바디 끝 인덱스. */
    private static int stripTrailingLineEnding(byte[] d, int start, int next) {
        if (next - 2 >= start && d[next - 2] == '\r' && d[next - 1] == '\n') return next - 2;
        if (next - 1 >= start && d[next - 1] == '\n') return next - 1;
        return next;
    }

    /**
     * 헤더/바디 경계 탐색. 헤더 줄({@code Content-*})을 한 줄씩 훑어:
     * <ul>
     *   <li>빈 줄을 만나면 그 다음이 바디(표준),</li>
     *   <li>헤더가 아닌 줄(예: 빈 줄 없이 바로 시작하는 바이너리)을 만나면 그 줄부터 바디(관대).</li>
     * </ul>
     * 반환 {@code [headerEnd, bodyStart]}, 헤더를 못 찾으면 null.
     */
    private static int[] splitHeaderBody(byte[] d, int start, int end) {
        int i = start;
        while (i < end) {
            int nl = indexOfByte(d, (byte) '\n', i, end);
            if (nl < 0) return null;
            int contentEnd = (nl > i && d[nl - 1] == '\r') ? nl - 1 : nl;
            int nextLine = nl + 1;
            if (contentEnd == i) {
                return new int[]{i, nextLine};        // 빈 줄 → 바디는 다음 줄부터
            }
            if (!startsWithContentHeader(d, i, contentEnd)) {
                return new int[]{i, i};               // 헤더 아님(빈 줄 없이 바디 시작) → 이 줄부터 바디
            }
            i = nextLine;                             // 헤더 줄 계속
        }
        return null;
    }

    /** 줄이 (대소문자 무시) "content-" 로 시작하는가(=파트 헤더 줄). */
    private static boolean startsWithContentHeader(byte[] d, int from, int to) {
        byte[] p = {'c', 'o', 'n', 't', 'e', 'n', 't', '-'};
        if (to - from < p.length) return false;
        for (int j = 0; j < p.length; j++) {
            int c = d[from + j] & 0xff;
            if (c >= 'A' && c <= 'Z') c += 32;
            if (c != p[j]) return false;
        }
        return true;
    }

    private static int indexOfByte(byte[] d, byte b, int from, int limit) {
        int end = Math.min(limit, d.length);
        for (int i = from; i < end; i++) if (d[i] == b) return i;
        return -1;
    }

    private static int indexOf(byte[] data, byte[] pat, int from) {
        return indexOf(data, pat, from, data.length);
    }

    private static int indexOf(byte[] data, byte[] pat, int from, int limit) {
        int end = Math.min(limit, data.length) - pat.length;
        outer:
        for (int i = Math.max(0, from); i <= end; i++) {
            for (int j = 0; j < pat.length; j++) {
                if (data[i + j] != pat[j]) continue outer;
            }
            return i;
        }
        return -1;
    }

    private static byte[] readAll(InputStream in, int maxBytes) throws IOException {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int total = 0, n;
        while ((n = in.read(buf)) != -1) {
            total += n;
            if (total > maxBytes) throw new IOException("multipart body exceeds max bytes: " + maxBytes);
            bos.write(buf, 0, n);
        }
        return bos.toByteArray();
    }
}
