package kr.co.ultari.chatbot.admin.gpu;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * GPU 현재 사용량 조회. 앱과 같은 호스트의 {@code nvidia-smi}를 실행·파싱한다.
 * <p>nvidia-smi가 없거나(미설치/무GPU) 실패/타임아웃이면 예외 없이 {@code available=false}로 반환 →
 * 화면은 "GPU 정보 없음"으로 표시(앱 전체엔 영향 없음). 명령은 고정(사용자 입력 미포함)이라 인젝션 없음.
 */
@Slf4j
@Service
public class GpuService {

    @Value("${ultari.admin.gpu.enabled:true}")
    private boolean enabled;

    /** nvidia-smi 실행 경로(PATH에 없거나 커스텀 설치 대비). 기본 "nvidia-smi". */
    @Value("${ultari.admin.gpu.nvidia-smi-path:nvidia-smi}")
    private String smiPath;

    @Value("${ultari.admin.gpu.exec-timeout-ms:5000}")
    private long execTimeoutMs;

    /** GPU 1개 지표 */
    public record GpuStat(int index, String name, int utilGpu, int memUsed, int memTotal,
                          int temperature, double powerDraw, double powerLimit) {}

    /** 조회 결과. available=false면 reason에 사유. */
    public record GpuResult(boolean available, String reason, List<GpuStat> gpus) {
        static GpuResult unavailable(String reason) { return new GpuResult(false, reason, List.of()); }
    }

    public boolean isEnabled() {
        return enabled;
    }

    /** 현재 GPU 상태. 미탐지/실패면 available=false. */
    public GpuResult read() {
        if (!enabled) return GpuResult.unavailable("GPU 모니터링 비활성(ultari.admin.gpu.enabled=false)");

        ProcessBuilder pb = new ProcessBuilder(
                smiPath,
                "--query-gpu=index,name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw,power.limit",
                "--format=csv,noheader,nounits");
        pb.redirectErrorStream(false);

        Process p;
        try {
            p = pb.start();
        } catch (Exception e) {
            // 실행 파일 없음(미설치/무GPU) 등
            return GpuResult.unavailable("nvidia-smi 미설치 또는 실행 불가");
        }

        try {
            List<GpuStat> gpus = new ArrayList<>();
            try (BufferedReader r = new BufferedReader(new InputStreamReader(p.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = r.readLine()) != null) {
                    GpuStat s = parseLine(line);
                    if (s != null) gpus.add(s);
                }
            }
            boolean done = p.waitFor(execTimeoutMs, TimeUnit.MILLISECONDS);
            if (!done) {
                p.destroyForcibly();
                return GpuResult.unavailable("nvidia-smi 응답 시간 초과");
            }
            if (p.exitValue() != 0) {
                return GpuResult.unavailable("nvidia-smi 오류(드라이버/GPU 확인 필요)");
            }
            if (gpus.isEmpty()) {
                return GpuResult.unavailable("GPU를 찾지 못했습니다");
            }
            return new GpuResult(true, null, gpus);
        } catch (Exception e) {
            log.warn("[gpu] nvidia-smi 파싱 실패: {}", e.getMessage());
            return GpuResult.unavailable("GPU 정보 파싱 실패");
        } finally {
            p.destroy();
        }
    }

    /** "index, name, util, memUsed, memTotal, temp, powerDraw, powerLimit" (nounits) 파싱. 실패 행은 null. */
    private GpuStat parseLine(String line) {
        if (line == null || line.isBlank()) return null;
        String[] c = line.split(",");
        if (c.length < 8) return null;
        try {
            return new GpuStat(
                    parseInt(c[0]), c[1].trim(),
                    parseInt(c[2]), parseInt(c[3]), parseInt(c[4]), parseInt(c[5]),
                    parseDouble(c[6]), parseDouble(c[7]));
        } catch (Exception e) {
            return null; // [N/A] 등 파싱 불가 행은 스킵
        }
    }

    private static int parseInt(String s) {
        String v = s.trim();
        if (v.isEmpty() || v.startsWith("[")) return 0; // [N/A]
        return (int) Math.round(Double.parseDouble(v));
    }

    private static double parseDouble(String s) {
        String v = s.trim();
        if (v.isEmpty() || v.startsWith("[")) return 0d;
        return Double.parseDouble(v);
    }
}
