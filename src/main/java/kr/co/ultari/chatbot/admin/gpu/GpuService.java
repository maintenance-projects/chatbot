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
 * <p>이용률(utilization.gpu)은 "GPU가 바쁜 시간 비율"이라 작업이 돌면 쉽게 100%가 된다(강도 아님).
 * 실사용 강도는 <b>전력(draw/limit)·메모리 사용률·메모리 대역폭</b>으로 본다.
 * <p>nvidia-smi가 없거나 실패/타임아웃이면 예외 없이 {@code available=false}로 반환. 명령은 고정(인젝션 없음).
 */
@Slf4j
@Service
public class GpuService {

    @Value("${ultari.admin.gpu.enabled:true}")
    private boolean enabled;

    @Value("${ultari.admin.gpu.nvidia-smi-path:nvidia-smi}")
    private String smiPath;

    @Value("${ultari.admin.gpu.exec-timeout-ms:5000}")
    private long execTimeoutMs;

    /** GPU 1개 지표(강도 관점 필드 포함). */
    public record GpuStat(int index, String name, int utilGpu, int memUtil, int memUsed, int memTotal,
                          int temperature, double powerDraw, double powerLimit,
                          int smClock, int smClockMax, int fanSpeed) {}

    /** GPU를 점유 중인 프로세스. */
    public record GpuProc(String pid, String name, int memMB) {}

    public record GpuResult(boolean available, String reason, List<GpuStat> gpus, List<GpuProc> processes) {
        static GpuResult unavailable(String reason) { return new GpuResult(false, reason, List.of(), List.of()); }
    }

    public boolean isEnabled() {
        return enabled;
    }

    public GpuResult read() {
        if (!enabled) return GpuResult.unavailable("GPU 모니터링 비활성(ultari.admin.gpu.enabled=false)");

        List<String> lines = runSmi(
                "--query-gpu=index,name,utilization.gpu,utilization.memory,memory.used,memory.total,temperature.gpu,power.draw,power.limit,clocks.sm,clocks.max.sm,fan.speed",
                "--format=csv,noheader,nounits");
        if (lines == null) return GpuResult.unavailable("nvidia-smi 미설치 또는 실행 불가");

        List<GpuStat> gpus = new ArrayList<>();
        for (String line : lines) {
            GpuStat s = parseGpu(line);
            if (s != null) gpus.add(s);
        }
        if (gpus.isEmpty()) return GpuResult.unavailable("GPU를 찾지 못했습니다");

        return new GpuResult(true, null, gpus, readProcesses());
    }

    /** GPU 점유 프로세스 목록. 실패/없음이면 빈 리스트(현재 조회를 실패시키지 않음). */
    private List<GpuProc> readProcesses() {
        List<GpuProc> out = new ArrayList<>();
        List<String> lines = runSmi(
                "--query-compute-apps=pid,process_name,used_memory", "--format=csv,noheader,nounits");
        if (lines == null) return out;
        for (String line : lines) {
            String[] c = line.split(",");
            if (c.length < 3) continue;
            String pid = c[0].trim();
            if (pid.isEmpty() || pid.startsWith("[")) continue;
            String name = c[1].trim();
            out.add(new GpuProc(pid, name, parseInt(c[2])));
        }
        return out;
    }

    /** nvidia-smi 실행 → stdout 라인들. 실패/없음/타임아웃이면 null. */
    private List<String> runSmi(String... args) {
        List<String> cmd = new ArrayList<>();
        cmd.add(smiPath);
        for (String a : args) cmd.add(a);
        Process p;
        try {
            p = new ProcessBuilder(cmd).redirectErrorStream(false).start();
        } catch (Exception e) {
            return null;
        }
        try {
            List<String> lines = new ArrayList<>();
            try (BufferedReader r = new BufferedReader(new InputStreamReader(p.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = r.readLine()) != null) if (!line.isBlank()) lines.add(line);
            }
            if (!p.waitFor(execTimeoutMs, TimeUnit.MILLISECONDS)) { p.destroyForcibly(); return null; }
            if (p.exitValue() != 0) return null;
            return lines;
        } catch (Exception e) {
            log.warn("[gpu] nvidia-smi 실행 실패: {}", e.getMessage());
            return null;
        } finally {
            p.destroy();
        }
    }

    private GpuStat parseGpu(String line) {
        if (line == null || line.isBlank()) return null;
        String[] c = line.split(",");
        if (c.length < 12) return null;
        try {
            return new GpuStat(
                    parseInt(c[0]), c[1].trim(),
                    parseInt(c[2]), parseInt(c[3]), parseInt(c[4]), parseInt(c[5]), parseInt(c[6]),
                    parseDouble(c[7]), parseDouble(c[8]),
                    parseInt(c[9]), parseInt(c[10]), parseInt(c[11]));
        } catch (Exception e) {
            return null;
        }
    }

    private static int parseInt(String s) {
        String v = s.trim();
        if (v.isEmpty() || v.startsWith("[")) return 0;
        return (int) Math.round(Double.parseDouble(v));
    }

    private static double parseDouble(String s) {
        String v = s.trim();
        if (v.isEmpty() || v.startsWith("[")) return 0d;
        return Double.parseDouble(v);
    }
}
