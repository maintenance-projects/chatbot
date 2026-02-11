package kr.co.ultari.chatbot.admin.controller;

import kr.co.ultari.chatbot.admin.service.AdminStatisticsService;
import kr.co.ultari.chatbot.admin.session.AdminSessionStore;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@Slf4j
@Controller
@RequestMapping("/admin/statistics")
public class AdminStatisticsController {

    @Autowired
    AdminSessionStore sessionStore;

    @Autowired
    AdminStatisticsService statisticsService;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    @PostMapping("/summary")
    @ResponseBody
    public String getSummary(@RequestParam("adminId") String adminId,
                             @RequestParam("startDate") String startDate,
                             @RequestParam("endDate") String endDate,
                             @RequestParam(value = "userId", required = false) String userId) {
        log.debug("[statistics summary] adminId={}, start={}, end={}, userId={}", adminId, startDate, endDate, userId);
        LocalDate start = LocalDate.parse(startDate, FMT);
        LocalDate end = LocalDate.parse(endDate, FMT);
        JSONObject json = statisticsService.getSummary(start, end, userId);
        return json.toString();
    }

    @PostMapping("/daily")
    @ResponseBody
    public String getDailyStats(@RequestParam("adminId") String adminId,
                                @RequestParam("startDate") String startDate,
                                @RequestParam("endDate") String endDate,
                                @RequestParam(value = "userId", required = false) String userId) {
        log.debug("[statistics daily] adminId={}, start={}, end={}, userId={}", adminId, startDate, endDate, userId);
        LocalDate start = LocalDate.parse(startDate, FMT);
        LocalDate end = LocalDate.parse(endDate, FMT);
        JSONArray arr = statisticsService.getDailyStats(start, end, userId);
        return arr.toString();
    }

    @PostMapping("/hourly")
    @ResponseBody
    public String getHourlyStats(@RequestParam("adminId") String adminId,
                                 @RequestParam("startDate") String startDate,
                                 @RequestParam("endDate") String endDate,
                                 @RequestParam(value = "userId", required = false) String userId) {
        log.debug("[statistics hourly] adminId={}, start={}, end={}, userId={}", adminId, startDate, endDate, userId);
        LocalDate start = LocalDate.parse(startDate, FMT);
        LocalDate end = LocalDate.parse(endDate, FMT);
        JSONArray arr = statisticsService.getHourlyStats(start, end, userId);
        return arr.toString();
    }

    @PostMapping("/ranking")
    @ResponseBody
    public String getUserRanking(@RequestParam("adminId") String adminId,
                                 @RequestParam("startDate") String startDate,
                                 @RequestParam("endDate") String endDate,
                                 @RequestParam(value = "userId", required = false) String userId) {
        log.debug("[statistics ranking] adminId={}, start={}, end={}, userId={}", adminId, startDate, endDate, userId);
        LocalDate start = LocalDate.parse(startDate, FMT);
        LocalDate end = LocalDate.parse(endDate, FMT);
        JSONArray arr = statisticsService.getUserRanking(start, end, userId);
        return arr.toString();
    }

    @PostMapping("/export")
    public ResponseEntity<byte[]> exportExcel(@RequestParam("adminId") String adminId,
                                              @RequestParam("startDate") String startDate,
                                              @RequestParam("endDate") String endDate,
                                              @RequestParam(value = "userId", required = false) String userId) throws IOException {
        log.debug("[statistics export] adminId={}, start={}, end={}, userId={}", adminId, startDate, endDate, userId);
        LocalDate start = LocalDate.parse(startDate, FMT);
        LocalDate end = LocalDate.parse(endDate, FMT);
        byte[] bytes = statisticsService.exportExcel(start, end, userId);

        String filename = "AI사용통계_" + startDate + "_" + endDate + "_" + adminId + ".xlsx";
        String encodedFilename = java.net.URLEncoder.encode(filename, "UTF-8").replaceAll("\\+", "%20");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encodedFilename)
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .contentLength(bytes.length)
                .body(bytes);
    }
}
