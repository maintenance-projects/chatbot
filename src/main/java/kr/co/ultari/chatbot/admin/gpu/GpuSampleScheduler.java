package kr.co.ultari.chatbot.admin.gpu;

import kr.co.ultari.chatbot.database.entity.GpuUsageLog;
import kr.co.ultari.chatbot.database.repository.GpuUsageLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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

    @Value("${ultari.admin.gpu.alert.enabled:true}")
    private boolean alertEnabled;
    @Value("${ultari.admin.gpu.alert.mem-threshold:90}")
    private int memThreshold;
    @Value("${ultari.admin.gpu.alert.power-threshold:90}")
    private int powerThreshold;
    @Value("${ultari.admin.gpu.alert.util-threshold:90}")
    private int utilThreshold;
    @Value("${ultari.admin.gpu.alert.util-sustain-min:5}")
    private int utilSustainMin;
    @Value("${ultari.admin.gpu.alert.cooldown-min:10}")
    private int cooldownMin;

    /** 이용률 임계 초과가 시작된 시각(GPU별). 지속시간 판정용. */
    private final Map<Integer, LocalDateTime> utilOverSince = new HashMap<>();
    /** 경고 로그 마지막 기록 시각(gpu:metric별). 쿨다운. */
    private final Map<String, LocalDateTime> lastAlert = new HashMap<>();

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
        if (alertEnabled) evaluateAlerts(r.gpus(), now);
    }

    /** 임계 초과 시 서버 로그(WARN) 기록. 메모리·전력=순간, 이용률=지속(util-sustain-min), 쿨다운 적용. */
    private void evaluateAlerts(List<GpuService.GpuStat> gpus, LocalDateTime now) {
        for (GpuService.GpuStat g : gpus) {
            int memPct = g.memTotal() > 0 ? (int) Math.round(g.memUsed() * 100.0 / g.memTotal()) : 0;
            int powerPct = g.powerLimit() > 0 ? (int) Math.round(g.powerDraw() * 100.0 / g.powerLimit()) : 0;

            if (memPct >= memThreshold) {
                alert(g.index(), "MEM", String.format("GPU%d 메모리 %d%%(임계 %d%%, %d/%dMB)",
                        g.index(), memPct, memThreshold, g.memUsed(), g.memTotal()), now);
            }
            if (powerPct >= powerThreshold) {
                alert(g.index(), "POWER", String.format("GPU%d 전력 %d%%(임계 %d%%, %.0f/%.0fW)",
                        g.index(), powerPct, powerThreshold, g.powerDraw(), g.powerLimit()), now);
            }
            // 이용률: 임계 초과가 util-sustain-min 이상 지속될 때만
            if (g.utilGpu() >= utilThreshold) {
                LocalDateTime since = utilOverSince.computeIfAbsent(g.index(), k -> now);
                if (Duration.between(since, now).toMinutes() >= utilSustainMin) {
                    alert(g.index(), "UTIL", String.format("GPU%d 이용률 %d%%(임계 %d%%) %d분 이상 지속",
                            g.index(), g.utilGpu(), utilThreshold, utilSustainMin), now);
                }
            } else {
                utilOverSince.remove(g.index()); // 임계 아래로 내려가면 리셋
            }
        }
    }

    private void alert(int gpuIndex, String metric, String message, LocalDateTime now) {
        String key = gpuIndex + ":" + metric;
        LocalDateTime last = lastAlert.get(key);
        if (last != null && Duration.between(last, now).toMinutes() < cooldownMin) return; // 쿨다운
        lastAlert.put(key, now);
        log.warn("[gpu-alert] {}", message);
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
