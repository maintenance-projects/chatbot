package kr.co.ultari.chatbot.admin.service;

import kr.co.ultari.chatbot.database.repository.AiUsageLogRepository;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Service
public class AdminStatisticsService {

    @Autowired
    AiUsageLogRepository repository;

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
            json.put("hour", ((Number) row[0]).intValue());
            json.put("type", row[1]);
            json.put("totalCount", ((Number) row[2]).longValue());
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
}
