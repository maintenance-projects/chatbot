package kr.co.ultari.chatbot.admin.service;

import kr.co.ultari.chatbot.database.repository.AiUsageLogRepository;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.util.List;

@Slf4j
@Service
public class AdminStatisticsService {

    @Autowired
    AiUsageLogRepository repository;

    /** 통계 항목 표시여부(엑셀에서도 비활성 항목 제외). */
    @org.springframework.beans.factory.annotation.Value("${ultari.statistics.audio-enabled:true}")
    private boolean audioEnabled;

    @org.springframework.beans.factory.annotation.Value("${ultari.statistics.template-enabled:true}")
    private boolean templateEnabled;

    /** 첨부파일검색(PKB) 통계 표시여부. 챗봇 탭이 숨겨져 기본 비노출. */
    @org.springframework.beans.factory.annotation.Value("${ultari.statistics.pkb-enabled:false}")
    private boolean pkbEnabled;

    private boolean hasUser(String userId) {
        return StringUtils.hasText(userId);
    }

    @Transactional(readOnly = true)
    public JSONObject getSummary(LocalDate start, LocalDate end, String userId) {
        List<Object[]> result = hasUser(userId)
                ? repository.findSummaryByUser(start, end, userId)
                : repository.findSummary(start, end);

        JSONObject json = new JSONObject();
        if (result.isEmpty()) {
            json.put("userCount", 0);
            json.put("totalCount", 0);
        } else {
            Object[] row = result.get(0);
            json.put("userCount", row[0] != null ? ((Number) row[0]).longValue() : 0);
            json.put("totalCount", row[1] != null ? ((Number) row[1]).longValue() : 0);
        }

        // 타입별 합계
        List<Object[]> daily = hasUser(userId)
                ? repository.findDailyStatsByUser(start, end, userId)
                : repository.findDailyStats(start, end);

        JSONObject typeCounts = new JSONObject();
        for (Object[] r : daily) {
            String type = (String) r[1];
            long count = ((Number) r[3]).longValue();
            typeCounts.put(type, typeCounts.optLong(type, 0) + count);
        }
        json.put("typeCounts", typeCounts);
        return json;
    }

    @Transactional(readOnly = true)
    public JSONArray getDailyStats(LocalDate start, LocalDate end, String userId) {
        List<Object[]> rows = hasUser(userId)
                ? repository.findDailyStatsByUser(start, end, userId)
                : repository.findDailyStats(start, end);

        JSONArray arr = new JSONArray();
        for (Object[] row : rows) {
            JSONObject json = new JSONObject();
            json.put("date", row[0].toString());
            json.put("type", row[1]);
            json.put("userCount", ((Number) row[2]).longValue());
            json.put("totalCount", ((Number) row[3]).longValue());
            arr.put(json);
        }
        return arr;
    }

    @Transactional(readOnly = true)
    public JSONArray getHourlyStats(LocalDate start, LocalDate end, String userId) {
        List<Object[]> rows = hasUser(userId)
                ? repository.findHourlyStatsByUser(start, end, userId)
                : repository.findHourlyStats(start, end);

        JSONArray arr = new JSONArray();
        for (Object[] row : rows) {
            JSONObject json = new JSONObject();
            json.put("date", row[0].toString());
            json.put("hour", ((Number) row[1]).intValue());
            json.put("type", row[2]);
            json.put("totalCount", ((Number) row[3]).longValue());
            arr.put(json);
        }
        return arr;
    }

    @Transactional(readOnly = true)
    public JSONArray getUserRanking(LocalDate start, LocalDate end, String userId) {
        List<Object[]> rows = hasUser(userId)
                ? repository.findUserRankingByUser(start, end, userId)
                : repository.findUserRanking(start, end);

        JSONArray arr = new JSONArray();
        for (Object[] row : rows) {
            JSONObject json = new JSONObject();
            json.put("userId", row[0]);
            json.put("type", row[1]);
            json.put("totalCount", ((Number) row[2]).longValue());
            arr.put(json);
        }
        return arr;
    }

    @Transactional(readOnly = true)
    public byte[] exportExcel(LocalDate start, LocalDate end, String userId) throws IOException {
        Workbook wb = new XSSFWorkbook();
        CellStyle headerStyle = wb.createCellStyle();
        Font headerFont = wb.createFont();
        headerFont.setBold(true);
        headerStyle.setFont(headerFont);
        headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        headerStyle.setBorderBottom(BorderStyle.THIN);

        // 타입 목록 — 표시여부(enabled=false)인 항목은 엑셀에서도 제외
        java.util.List<String> typeList = new java.util.ArrayList<>(
                java.util.List.of("CHAT", "DOCUMENT", "TEMPLATE", "PKB_SEARCH", "DIALOG", "AUDIO"));
        if (!audioEnabled) typeList.remove("AUDIO");
        if (!templateEnabled) typeList.remove("TEMPLATE");
        if (!pkbEnabled) typeList.remove("PKB_SEARCH");
        String[] TYPES = typeList.toArray(new String[0]);
        java.util.Map<String, String> TYPE_LABELS = new java.util.HashMap<>();
        TYPE_LABELS.put("CHAT", "챗봇-질문");
        TYPE_LABELS.put("DOCUMENT", "챗봇-내문서");
        TYPE_LABELS.put("TEMPLATE", "양식");
        TYPE_LABELS.put("PKB_SEARCH", "첨부파일검색");
        TYPE_LABELS.put("DIALOG", "메신저-대화요약");
        TYPE_LABELS.put("AUDIO", "통화요약");

        // 시트1: 일별 통계
        List<Object[]> dailyRows = hasUser(userId)
                ? repository.findDailyStatsByUser(start, end, userId)
                : repository.findDailyStats(start, end);
        // 날짜별-타입별 데이터 맵 구성
        java.util.Map<String, java.util.Map<String, long[]>> dailyMap = new java.util.LinkedHashMap<>();
        for (Object[] row : dailyRows) {
            String date = row[0].toString();
            String type = (String) row[1];
            long userCount = ((Number) row[2]).longValue();
            long totalCount = ((Number) row[3]).longValue();
            dailyMap.computeIfAbsent(date, k -> new java.util.LinkedHashMap<>())
                    .put(type, new long[]{userCount, totalCount});
        }
        String periodText = "조회 기간: " + start.toString() + " ~ " + end.toString();
        CellStyle dateStyle = wb.createCellStyle();
        dateStyle.setVerticalAlignment(VerticalAlignment.CENTER);
        CellStyle totalStyle = wb.createCellStyle();
        totalStyle.setFont(headerFont);
        totalStyle.setVerticalAlignment(VerticalAlignment.CENTER);

        Sheet dailySheet = wb.createSheet("일별 통계");
        Row dailyPeriodRow = dailySheet.createRow(0);
        Cell dailyPeriodCell = dailyPeriodRow.createCell(0);
        dailyPeriodCell.setCellValue(periodText);
        dailyPeriodCell.setCellStyle(totalStyle);
        dailySheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(0, 0, 0, 3));
        createHeaderRow(dailySheet, headerStyle, 1, new String[]{"날짜", "타입", "사용자수", "요청수"});
        int rowIdx = 2;
        for (java.util.Map.Entry<String, java.util.Map<String, long[]>> entry : dailyMap.entrySet()) {
            String date = entry.getKey();
            java.util.Map<String, long[]> typeMap = entry.getValue();
            int mergeStartRow = rowIdx;
            long dayTotal = 0;
            for (String type : TYPES) {
                long[] vals = typeMap.getOrDefault(type, new long[]{0, 0});
                Row r = dailySheet.createRow(rowIdx);
                Cell dateCell = r.createCell(0);
                dateCell.setCellValue(date);
                dateCell.setCellStyle(dateStyle);
                r.createCell(1).setCellValue(TYPE_LABELS.get(type));
                r.createCell(2).setCellValue(vals[0]);
                r.createCell(3).setCellValue(vals[1]);
                dayTotal += vals[1];
                rowIdx++;
            }
            // 합계 행
            Row totalRow = dailySheet.createRow(rowIdx);
            Cell dtCell = totalRow.createCell(0);
            dtCell.setCellValue(date);
            dtCell.setCellStyle(dateStyle);
            Cell lblCell = totalRow.createCell(1);
            lblCell.setCellValue("합계");
            lblCell.setCellStyle(totalStyle);
            totalRow.createCell(2).setCellValue("");
            Cell tcCell = totalRow.createCell(3);
            tcCell.setCellValue(dayTotal);
            tcCell.setCellStyle(totalStyle);
            rowIdx++;
            if (rowIdx - mergeStartRow > 1) {
                dailySheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(mergeStartRow, rowIdx - 1, 0, 0));
            }
        }
        autoSizeColumns(dailySheet, 4);
        dailySheet.setColumnWidth(0, 4000);

        // 시트2: 시간대별 통계
        List<Object[]> hourlyRows = hasUser(userId)
                ? repository.findHourlyStatsByUser(start, end, userId)
                : repository.findHourlyStats(start, end);
        // 날짜-시간별-타입별 데이터 맵 구성
        java.util.Map<String, java.util.Map<Integer, java.util.Map<String, Long>>> hourlyMap = new java.util.LinkedHashMap<>();
        for (Object[] row : hourlyRows) {
            String date = row[0].toString();
            int hour = ((Number) row[1]).intValue();
            String type = (String) row[2];
            long totalCount = ((Number) row[3]).longValue();
            hourlyMap.computeIfAbsent(date, k -> new java.util.LinkedHashMap<>())
                    .computeIfAbsent(hour, k -> new java.util.LinkedHashMap<>())
                    .put(type, totalCount);
        }
        Sheet hourlySheet = wb.createSheet("시간대별 통계");
        Row hourlyPeriodRow = hourlySheet.createRow(0);
        Cell hourlyPeriodCell = hourlyPeriodRow.createCell(0);
        hourlyPeriodCell.setCellValue(periodText);
        hourlyPeriodCell.setCellStyle(totalStyle);
        hourlySheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(0, 0, 0, 3));
        createHeaderRow(hourlySheet, headerStyle, 1, new String[]{"날짜", "시간", "타입", "요청수"});
        rowIdx = 2;
        for (java.util.Map.Entry<String, java.util.Map<Integer, java.util.Map<String, Long>>> dateEntry : hourlyMap.entrySet()) {
            String date = dateEntry.getKey();
            int dateMergeStart = rowIdx;
            for (java.util.Map.Entry<Integer, java.util.Map<String, Long>> hourEntry : dateEntry.getValue().entrySet()) {
                int hour = hourEntry.getKey();
                java.util.Map<String, Long> typeMap = hourEntry.getValue();
                int hourMergeStart = rowIdx;
                long hourTotal = 0;
                for (String type : TYPES) {
                    long count = typeMap.getOrDefault(type, 0L);
                    Row r = hourlySheet.createRow(rowIdx);
                    Cell dateCell = r.createCell(0);
                    dateCell.setCellValue(date);
                    dateCell.setCellStyle(dateStyle);
                    Cell hourCell = r.createCell(1);
                    hourCell.setCellValue(hour + "시");
                    hourCell.setCellStyle(dateStyle);
                    r.createCell(2).setCellValue(TYPE_LABELS.get(type));
                    r.createCell(3).setCellValue(count);
                    hourTotal += count;
                    rowIdx++;
                }
                // 합계 행
                Row hTotalRow = hourlySheet.createRow(rowIdx);
                Cell htDateCell = hTotalRow.createCell(0);
                htDateCell.setCellValue(date);
                htDateCell.setCellStyle(dateStyle);
                Cell htHourCell = hTotalRow.createCell(1);
                htHourCell.setCellValue(hour + "시");
                htHourCell.setCellStyle(dateStyle);
                Cell htLblCell = hTotalRow.createCell(2);
                htLblCell.setCellValue("합계");
                htLblCell.setCellStyle(totalStyle);
                Cell htValCell = hTotalRow.createCell(3);
                htValCell.setCellValue(hourTotal);
                htValCell.setCellStyle(totalStyle);
                rowIdx++;
                if (rowIdx - hourMergeStart > 1) {
                    hourlySheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(hourMergeStart, rowIdx - 1, 1, 1));
                }
            }
            if (rowIdx - dateMergeStart > 1) {
                hourlySheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(dateMergeStart, rowIdx - 1, 0, 0));
            }
        }
        autoSizeColumns(hourlySheet, 4);
        hourlySheet.setColumnWidth(0, 4000);

        // 시트3: 사용자별 랭킹
        List<Object[]> rankingRows = hasUser(userId)
                ? repository.findUserRankingByUser(start, end, userId)
                : repository.findUserRanking(start, end);
        Sheet rankingSheet = wb.createSheet("사용자별 랭킹");
        Row periodRow = rankingSheet.createRow(0);
        Cell periodCell = periodRow.createCell(0);
        periodCell.setCellValue("조회 기간: " + start.toString() + " ~ " + end.toString());
        periodCell.setCellStyle(totalStyle);
        rankingSheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(0, 0, 0, 2));
        createHeaderRow(rankingSheet, headerStyle, 1, new String[]{"순위", "사용자ID", "요청수"});
        // 사용자별 합계 계산
        java.util.Map<String, Long> userTotalMap = new java.util.LinkedHashMap<>();
        for (Object[] row : rankingRows) {
            String uid = (String) row[0];
            long count = ((Number) row[2]).longValue();
            userTotalMap.merge(uid, count, Long::sum);
        }
        List<java.util.Map.Entry<String, Long>> sortedUsers = new java.util.ArrayList<>(userTotalMap.entrySet());
        sortedUsers.sort((a, b) -> Long.compare(b.getValue(), a.getValue()));
        rowIdx = 2;
        int rank = 1;
        for (java.util.Map.Entry<String, Long> entry : sortedUsers) {
            Row r = rankingSheet.createRow(rowIdx++);
            r.createCell(0).setCellValue(rank++);
            r.createCell(1).setCellValue(entry.getKey());
            r.createCell(2).setCellValue(entry.getValue());
        }
        autoSizeColumns(rankingSheet, 3);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        wb.write(out);
        wb.close();
        return out.toByteArray();
    }

    private void createHeaderRow(Sheet sheet, CellStyle style, String[] headers) {
        createHeaderRow(sheet, style, 0, headers);
    }

    private void createHeaderRow(Sheet sheet, CellStyle style, int rowNum, String[] headers) {
        Row row = sheet.createRow(rowNum);
        for (int i = 0; i < headers.length; i++) {
            Cell cell = row.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(style);
        }
    }

    private void autoSizeColumns(Sheet sheet, int colCount) {
        for (int i = 0; i < colCount; i++) {
            sheet.autoSizeColumn(i);
            sheet.setColumnWidth(i, sheet.getColumnWidth(i) + 1024);
        }
    }
}
