package kr.co.ultari.chatbot.config;

import kr.co.ultari.chatbot.admin.service.AdminConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * 임시파일 정리 스케줄러. {@code ultari.ai.temp.path} 하위에서 <b>보존시간(retention-hours)이 지난
 * 파일을 삭제</b>하고 <b>빈 디렉터리를 정리</b>한다.
 * <p>업로드 대부분은 게이트웨이로 스트리밍 릴레이되고 로컬에 남지 않지만,
 * {@code /chatbot/csv/upload}의 {@code tmp/{sessionId}/dialog/*.csv} 등은 삭제 로직이 없어 누적되고,
 * {@code /chatbot/attach}의 임시파일도 릴레이 실패 시 orphan으로 남을 수 있어 이를 주기적으로 청소한다.
 * <p>진행 중인 릴레이(방금 생성된 파일)는 보존시간 미달이라 삭제되지 않는다(안전). 루트 경로는 보존한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TempFileCleanupScheduler {

    /** 개인문서 보관일수(file_ttl_days) 조회용. 로컬 사본은 게이트웨이 TTL + 1일까지 보관한다. */
    private final AdminConfigService configService;

    @Value("${ultari.ai.temp.path:tmp}")
    private String tempPath;

    /** 업로드 문서 보관 경로(temp와 분리, 긴 보존기간). */
    @Value("${ultari.ai.document.path:documents}")
    private String documentPath;

    @Value("${ultari.ai.temp.cleanup.enabled:true}")
    private boolean enabled;

    /** temp 임시파일 보존시간(시간). 기본 24h. */
    @Value("${ultari.ai.temp.cleanup.retention-hours:24}")
    private long retentionHours;

    /** 정리 주기(cron). 기본 매일 03:30. temp는 고정 보존, 업로드 문서 사본은 file_ttl_days+1일. */
    @Scheduled(cron = "${ultari.ai.temp.cleanup.cron:0 30 3 * * *}")
    public void cleanup() {
        if (!enabled) return;
        cleanupDir(tempPath, retentionHours);
        // 로컬 PDF 미리보기 사본은 게이트웨이 보관기간(file_ttl_days)보다 하루 더 보관 후 삭제.
        long documentRetentionHours = (configService.getDocRetentionDays() + 1L) * 24L;
        cleanupDir(documentPath, documentRetentionHours);
    }

    /** 지정 디렉터리에서 보존시간 지난 파일 삭제 + 빈 디렉터리 정리. 루트는 보존. */
    private void cleanupDir(String pathStr, long retentionHours) {
        Path root = Paths.get(pathStr).toAbsolutePath().normalize();
        if (!Files.isDirectory(root)) return;

        long cutoff = System.currentTimeMillis() - retentionHours * 3_600_000L;
        int files = 0, dirs = 0;
        try (Stream<Path> walk = Files.walk(root)) {
            // 깊은 곳(자식) 먼저 처리하기 위해 역순 정렬 → 파일 삭제 후 빈 디렉터리 삭제 가능
            List<Path> ordered = walk.sorted(Comparator.reverseOrder()).collect(Collectors.toList());
            for (Path p : ordered) {
                if (p.equals(root)) continue; // 루트는 보존
                try {
                    if (Files.isRegularFile(p)) {
                        if (Files.getLastModifiedTime(p).toMillis() < cutoff && Files.deleteIfExists(p)) {
                            files++;
                        }
                    } else if (Files.isDirectory(p) && isEmpty(p) && Files.deleteIfExists(p)) {
                        dirs++;
                    }
                } catch (IOException ignore) {
                    // 개별 파일/디렉터리 실패는 무시하고 계속(사용 중 등)
                }
            }
        } catch (IOException e) {
            log.warn("[temp-cleanup] 정리 중 오류: {}", e.getMessage());
        }
        if (files > 0 || dirs > 0) {
            log.info("[temp-cleanup] 정리 완료: 파일 {}개, 빈 디렉터리 {}개 삭제 (보존 {}시간, 경로={})",
                    files, dirs, retentionHours, root);
        }
    }

    private static boolean isEmpty(Path dir) throws IOException {
        try (Stream<Path> s = Files.list(dir)) {
            return s.findAny().isEmpty();
        }
    }
}
