package kr.co.ultari.chatbot.database.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * GPU 사용량 이력(주기 샘플). nvidia-smi 1회 실행 결과에서 GPU 1개당 1행.
 * 증설 판단용 시계열 — 보존기간 초과분은 정리 스케줄러가 삭제.
 */
@Entity
@Table(name = "gpu_usage_log", indexes = {
        @Index(name = "idx_gpu_sampled_at", columnList = "sampled_at")
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class GpuUsageLog {

    @Id
    @Column(name = "log_id", nullable = false, length = 50)
    private String logId;

    @Column(name = "sampled_at", nullable = false)
    private LocalDateTime sampledAt;

    @Column(name = "gpu_index", nullable = false)
    private int gpuIndex;

    @Column(name = "gpu_name", length = 100)
    private String gpuName;

    /** GPU 이용률(%) */
    @Column(name = "util_gpu", nullable = false)
    private int utilGpu;

    /** 사용 메모리(MB) */
    @Column(name = "mem_used", nullable = false)
    private int memUsed;

    /** 총 메모리(MB) */
    @Column(name = "mem_total", nullable = false)
    private int memTotal;

    /** 온도(℃) */
    @Column(name = "temperature", nullable = false)
    private int temperature;

    /** 전력(W) */
    @Column(name = "power_draw", nullable = false)
    private double powerDraw;

    public static GpuUsageLog create(LocalDateTime sampledAt, int gpuIndex, String gpuName,
                                     int utilGpu, int memUsed, int memTotal, int temperature, double powerDraw) {
        GpuUsageLog g = new GpuUsageLog();
        g.logId = UUID.randomUUID().toString();
        g.sampledAt = sampledAt;
        g.gpuIndex = gpuIndex;
        g.gpuName = gpuName;
        g.utilGpu = utilGpu;
        g.memUsed = memUsed;
        g.memTotal = memTotal;
        g.temperature = temperature;
        g.powerDraw = powerDraw;
        return g;
    }
}
