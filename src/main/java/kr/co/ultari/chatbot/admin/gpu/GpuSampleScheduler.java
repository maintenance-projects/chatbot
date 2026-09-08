package kr.co.ultari.chatbot.admin.gpu;

import kr.co.ultari.chatbot.database.entity.GpuUsageLog;
import kr.co.ultari.chatbot.database.repository.GpuUsageLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * GPU 사용량 이력 샘플러. 주기(기본 1분)로 nvidia-smi를 읽어 DB에 적재하고,
 * 보존기간(기본 90일) 초과분을 하루 1회 정리한다. history.enabled=false면 수집 안 함.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GpuSampleScheduler {

    private final GpuService gpuService;
    private final GpuUsageLogRepository repository;

    @Value("${ultari.admin.gpu.history.enabled:true}")
    private boolean historyEnabled;

    @Value("${ultari.admin.gpu.history.retention-days:90}")
    private int retentionDays;

    /** 주기 샘플링(기본 60초). GPU 미탐지/비활성이면 조용히 스킵. */
    @Scheduled(fixedRateString = "${ultari.admin.gpu.history.interval-ms:60000}",
            initialDelayString = "${ultari.admin.gpu.history.interval-ms:60000}")
    public void sample() {
        if (!historyEnabled || !gpuService.isEnabled()) return;
        GpuService.GpuResult r = gpuService.read();
        if (!r.available()) return; // 미탐지 시 저장 안 함
        LocalDateTime now = LocalDateTime.now();
        List<GpuUsageLog> rows = new ArrayList<>();
        for (GpuService.GpuStat g : r.gpus()) {
            rows.add(GpuUsageLog.create(now, g.index(), g.name(),
                    g.utilGpu(), g.memUsed(), g.memTotal(), g.temperature(), g.powerDraw()));
        }
        if (!rows.isEmpty()) repository.saveAll(rows);
    }

    /** 보존기간 초과 이력 정리(매일 03:40). */
    @Scheduled(cron = "${ultari.admin.gpu.history.cleanup-cron:0 40 3 * * *}")
    public void cleanup() {
        if (!historyEnabled || retentionDays <= 0) return;
        try {
            int deleted = repository.deleteOlderThan(LocalDateTime.now().minusDays(retentionDays));
            if (deleted > 0) log.info("[gpu] 이력 정리: {}건 삭제(보존 {}일)", deleted, retentionDays);
        } catch (Exception e) {
            log.warn("[gpu] 이력 정리 실패: {}", e.getMessage());
        }
    }
}
