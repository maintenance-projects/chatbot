package kr.co.ultari.chatbot.admin.gpu;

import kr.co.ultari.chatbot.database.entity.GpuUsageLog;
import kr.co.ultari.chatbot.database.repository.GpuUsageLogRepository;
import kr.co.ultari.chatbot.database.repository.AiUsageLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * GPU 모니터링 API(관리자). 실시간(nvidia-smi) + 이력(시계열) 조회.
 */
@Slf4j
@RestController
@RequestMapping("/at-i/gpu")
@RequiredArgsConstructor
public class AdminGpuController {

    private final GpuService gpuService;
    private final GpuUsageLogRepository repository;
    private final AiUsageLogRepository usageRepository;

    @org.springframework.beans.factory.annotation.Value("${ultari.admin.gpu.alert.mem-threshold:90}")
    private int memThreshold;
    @org.springframework.beans.factory.annotation.Value("${ultari.admin.gpu.alert.power-threshold:90}")
    private int powerThreshold;
    @org.springframework.beans.factory.annotation.Value("${ultari.admin.gpu.alert.util-threshold:90}")
    private int utilThreshold;

    private static final DateTimeFormatter TS_MIN = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final DateTimeFormatter TS_HOUR = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:00");
    private static final DateTimeFormatter TS_HKEY = DateTimeFormatter.ofPattern("yyyy-MM-dd HH");

    /** 실시간 현재 GPU 상태. */
    @GetMapping("/current")
    public ResponseEntity<String> current() {
        GpuService.GpuResult r = gpuService.read();
        JSONObject o = new JSONObject();
        o.put("available", r.available());
        if (!r.available()) o.put("reason", r.reason() == null ? "" : r.reason());
        JSONArray arr = new JSONArray();
        for (GpuService.GpuStat g : r.gpus()) {
            arr.put(new JSONObject()
                    .put("index", g.index()).put("name", g.name())
                    .put("utilGpu", g.utilGpu()).put("memUtil", g.memUtil())
                    .put("memUsed", g.memUsed()).put("memTotal", g.memTotal())
                    .put("temperature", g.temperature())
                    .put("powerDraw", g.powerDraw()).put("powerLimit", g.powerLimit())
                    .put("smClock", g.smClock()).put("smClockMax", g.smClockMax())
                    .put("fanSpeed", g.fanSpeed()));
        }
        o.put("gpus", arr);
        JSONArray procs = new JSONArray();
        for (GpuService.GpuProc pr : r.processes()) {
            procs.put(new JSONObject().put("pid", pr.pid()).put("name", pr.name()).put("memMB", pr.memMB()));
        }
        o.put("processes", procs);
        o.put("thresholds", new JSONObject()
                .put("mem", memThreshold).put("power", powerThreshold).put("util", utilThreshold));
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(o.toString());
    }

    /** 이력(시계열). hours=조회 시간범위(기본 24). 24시간 초과면 시간단위 평균으로 다운샘플. */
    @GetMapping("/history")
    public ResponseEntity<String> history(@RequestParam(value = "hours", defaultValue = "24") int hours) {
        int h = Math.max(1, Math.min(hours, 24 * 90)); // 최대 90일
        LocalDateTime end = LocalDateTime.now();
        LocalDateTime start = end.minusHours(h);
        List<GpuUsageLog> rows = repository.findBySampledAtBetweenOrderBySampledAtAsc(start, end);

        boolean hourly = h > 24; // 24시간 초과면 시간단위 집계
        // gpuIndex -> (bucketLabel -> 누적) : 차트용. long[]{utilSum, memUsedSum, memTotalMax, count, powerSum, tempSum}
        Map<Integer, String> names = new LinkedHashMap<>();
        Map<Integer, Map<String, long[]>> agg = new LinkedHashMap<>();
        // 요약(증설 판단)은 원자료 기준. long[]{utilSum,utilMax,memPctSum,memPctMax,over90Count,count,powerSum,powerMax}
        Map<Integer, long[]> summary = new LinkedHashMap<>();
        // 시간대별(0~23) 평균 이용률 패턴(전 GPU 합산). long[24]{utilSum}, long[24]{count}
        long[] hourUtilSum = new long[24];
        long[] hourCount = new long[24];
        // 수요vs자원: 시간(yyyy-MM-dd HH) 버킷 전 GPU 집계. long[]{utilSum, memPctSum, count}
        Map<String, long[]> gpuHour = new LinkedHashMap<>();
        for (GpuUsageLog g : rows) {
            names.putIfAbsent(g.getGpuIndex(), g.getGpuName());
            String label = g.getSampledAt().format(hourly ? TS_HOUR : TS_MIN);
            Map<String, long[]> byBucket = agg.computeIfAbsent(g.getGpuIndex(), k -> new LinkedHashMap<>());
            long[] v = byBucket.computeIfAbsent(label, k -> new long[]{0, 0, 0, 0, 0, 0});
            v[0] += g.getUtilGpu();
            v[1] += g.getMemUsed();
            v[2] = Math.max(v[2], g.getMemTotal());
            v[3] += 1;
            v[4] += Math.round(g.getPowerDraw());
            v[5] += g.getTemperature();

            int memPct = g.getMemTotal() > 0 ? (int) Math.round(g.getMemUsed() * 100.0 / g.getMemTotal()) : 0;
            long[] s = summary.computeIfAbsent(g.getGpuIndex(), k -> new long[]{0, 0, 0, 0, 0, 0, 0, 0});
            s[0] += g.getUtilGpu();
            s[1] = Math.max(s[1], g.getUtilGpu());
            s[2] += memPct;
            s[3] = Math.max(s[3], memPct);
            if (g.getUtilGpu() >= 90) s[4] += 1;
            s[5] += 1;
            long pw = Math.round(g.getPowerDraw());
            s[6] += pw;
            s[7] = Math.max(s[7], pw);

            int hod = g.getSampledAt().getHour();
            hourUtilSum[hod] += g.getUtilGpu();
            hourCount[hod] += 1;

            String hkey = g.getSampledAt().format(TS_HKEY);
            long[] gh = gpuHour.computeIfAbsent(hkey, k -> new long[]{0, 0, 0});
            gh[0] += g.getUtilGpu();
            gh[1] += memPct;
            gh[2] += 1;
        }

        JSONArray gpus = new JSONArray();
        for (Map.Entry<Integer, Map<String, long[]>> e : agg.entrySet()) {
            JSONArray points = new JSONArray();
            for (Map.Entry<String, long[]> b : e.getValue().entrySet()) {
                long[] v = b.getValue();
                long cnt = v[3] == 0 ? 1 : v[3];
                points.put(new JSONObject()
                        .put("t", b.getKey())
                        .put("util", Math.round((double) v[0] / cnt))
                        .put("memUsed", Math.round((double) v[1] / cnt))
                        .put("memTotal", v[2])
                        .put("power", Math.round((double) v[4] / cnt))
                        .put("temp", Math.round((double) v[5] / cnt)));
            }
            long[] s = summary.getOrDefault(e.getKey(), new long[]{0, 0, 0, 0, 0, 0, 0, 0});
            long sc = s[5] == 0 ? 1 : s[5];
            JSONObject sum = new JSONObject()
                    .put("avgUtil", Math.round((double) s[0] / sc))
                    .put("maxUtil", s[1])
                    .put("avgMemPct", Math.round((double) s[2] / sc))
                    .put("maxMemPct", s[3])
                    .put("over90Ratio", Math.round((double) s[4] * 100 / sc)) // 이용률 90%↑ 시간 비율(%)
                    .put("avgPower", Math.round((double) s[6] / sc))
                    .put("maxPower", s[7]);
            gpus.put(new JSONObject()
                    .put("index", e.getKey())
                    .put("name", names.getOrDefault(e.getKey(), ""))
                    .put("summary", sum)
                    .put("points", points));
        }
        // 시간대별 평균 이용률(0~23)
        JSONArray hourPattern = new JSONArray();
        for (int hh2 = 0; hh2 < 24; hh2++) {
            long c = hourCount[hh2] == 0 ? 1 : hourCount[hh2];
            hourPattern.put(new JSONObject()
                    .put("hour", hh2)
                    .put("avgUtil", hourCount[hh2] == 0 ? 0 : Math.round((double) hourUtilSum[hh2] / c)));
        }
        // 수요(AI 요청수) vs 자원(GPU) — 시간 단위로 겹쳐보기
        Map<String, Long> demand = new java.util.HashMap<>();
        for (Object[] r2 : usageRepository.findHourlyStats(start.toLocalDate(), end.toLocalDate())) {
            String dkey = r2[0].toString() + String.format(" %02d", ((Number) r2[1]).intValue());
            demand.merge(dkey, ((Number) r2[3]).longValue(), Long::sum);
        }
        JSONArray dvr = new JSONArray();
        for (Map.Entry<String, long[]> e : gpuHour.entrySet()) {
            long[] v = e.getValue();
            long c = v[2] == 0 ? 1 : v[2];
            dvr.put(new JSONObject()
                    .put("t", e.getKey())
                    .put("requests", demand.getOrDefault(e.getKey(), 0L))
                    .put("gpuUtil", Math.round((double) v[0] / c))
                    .put("gpuMemPct", Math.round((double) v[1] / c)));
        }

        JSONObject o = new JSONObject();
        o.put("hours", h);
        o.put("aggregated", hourly);
        o.put("gpus", gpus);
        o.put("hourPattern", hourPattern);
        o.put("demandVsResource", dvr);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(o.toString());
    }
}
