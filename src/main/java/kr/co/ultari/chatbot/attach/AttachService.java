package kr.co.ultari.chatbot.attach;

import kr.co.ultari.chatbot.common.gateway.AiGatewayClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.UriUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * 메신저 첨부파일 등록(단순 등록) 도메인.
 * <p>메신저 클라이언트가 로컬에 받은 파일을 우리 서버로 multipart POST 하면, 개인(dept-less)
 * 게이트웨이 업로드({@code /upload/{ownerId}})로 릴레이한다.
 * <p><b>접수 후 비동기(옵션 C)</b>: 요청 수명과 분리하기 위해 우리 임시파일로 복사한 뒤 202로 즉시
 * 접수하고, 게이트웨이 릴레이는 백그라운드(Reactor)에서 수행한다. 대용량 대비 메모리가 아닌 디스크에 적재한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AttachService {

    private final AiGatewayClient gateway;

    /** 임시 적재 경로(요청 종료 후에도 백그라운드 릴레이가 읽을 수 있어야 함) */
    @Value("${ultari.ai.temp.path}")
    private String tempPath;

    /**
     * 첨부파일을 접수해 우리 임시파일로 복사하고, 게이트웨이 릴레이를 백그라운드로 시작한다.
     * 이 메서드는 파일 복사만 끝나면 즉시 반환한다(릴레이 완료를 기다리지 않음).
     *
     * @throws IOException 임시파일 복사 실패(이 경우에만 접수 실패로 응답)
     */
    public void registerAsync(String ownerId, String sender, String roomName,
                              String attachFileName, MultipartFile file) throws IOException {
        String original = file.getOriginalFilename();
        // 경로 탈출 방지: 파일명은 단일 세그먼트만
        String safeName = Paths.get(original == null ? "file" : original).getFileName().toString();
        String displayName = StringUtils.hasText(attachFileName) ? attachFileName : safeName;

        // 요청 수명과 분리 — 우리 임시파일(디스크)로 복사
        Path dir = Paths.get(tempPath, "attach", safeSeg(ownerId));
        Files.createDirectories(dir);
        Path tmp = Files.createTempFile(dir, "att-", "-" + safeName);
        file.transferTo(tmp);

        MultipartBodyBuilder b = new MultipartBodyBuilder();
        if (StringUtils.hasText(sender)) b.part("sender", sender);
        if (StringUtils.hasText(roomName)) b.part("room_name", roomName);
        b.part("attachFile_name", displayName);
        b.part("attachFile_bin", new FileSystemResource(tmp))
                .filename(safeName)
                .contentType(MediaType.APPLICATION_OCTET_STREAM);

        // 백그라운드 릴레이: SSE를 끝까지 소비하고, 종료 시 임시파일 정리(성공/실패 무관)
        gateway.stream(null, "/upload/" + seg(ownerId), b)
                .doOnComplete(() -> log.info("[attach] 등록 완료 ownerId={}, file={}", ownerId, displayName))
                .doOnError(e -> log.error("[attach] 릴레이 실패 ownerId={}, file={}", ownerId, displayName, e))
                .doFinally(sig -> {
                    try {
                        Files.deleteIfExists(tmp);
                    } catch (IOException ex) {
                        log.warn("[attach] 임시파일 삭제 실패: {}", tmp, ex);
                    }
                })
                .subscribe();

        log.info("[attach] 접수 ownerId={}, file={}, tmp={}", ownerId, displayName, tmp);
    }

    /** 경로 세그먼트 인코딩(게이트웨이 URL용) */
    private static String seg(String v) {
        return UriUtils.encodePathSegment(v == null ? "" : v, StandardCharsets.UTF_8);
    }

    /** 파일시스템 디렉터리명으로 쓸 안전한 세그먼트(구분자 제거) */
    private static String safeSeg(String v) {
        return (v == null ? "unknown" : v).replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}
