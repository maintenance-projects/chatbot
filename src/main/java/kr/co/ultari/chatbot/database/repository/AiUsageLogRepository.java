package kr.co.ultari.chatbot.database.repository;

import kr.co.ultari.chatbot.database.entity.AiUsageLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface AiUsageLogRepository extends JpaRepository<AiUsageLog, Long> {

    /** 해당 (user,type,date,hour) 행 카운트를 원자적으로 +1. 영향 행 수 반환(0이면 행 없음). */
    @Transactional
    @Modifying
    @Query("UPDATE AiUsageLog a SET a.requestCount = a.requestCount + 1, a.updatedAt = CURRENT_TIMESTAMP " +
           "WHERE a.userId = :userId AND a.requestType = :type " +
           "AND a.requestDate = :date AND a.requestHour = :hour")
    int incrementCount(@Param("userId") String userId, @Param("type") String type,
                       @Param("date") LocalDate date, @Param("hour") int hour);

    @Query("SELECT a.requestDate, a.requestType, COUNT(DISTINCT a.userId), SUM(a.requestCount) " +
           "FROM AiUsageLog a WHERE a.requestDate BETWEEN :start AND :end " +
           "GROUP BY a.requestDate, a.requestType ORDER BY a.requestDate")
    List<Object[]> findDailyStats(@Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("SELECT a.requestDate, a.requestType, COUNT(DISTINCT a.userId), SUM(a.requestCount) " +
           "FROM AiUsageLog a WHERE a.requestDate BETWEEN :start AND :end AND a.userId = :userId " +
           "GROUP BY a.requestDate, a.requestType ORDER BY a.requestDate")
    List<Object[]> findDailyStatsByUser(@Param("start") LocalDate start, @Param("end") LocalDate end, @Param("userId") String userId);

    @Query("SELECT a.requestDate, a.requestHour, a.requestType, SUM(a.requestCount) " +
           "FROM AiUsageLog a WHERE a.requestDate BETWEEN :start AND :end " +
           "GROUP BY a.requestDate, a.requestHour, a.requestType ORDER BY a.requestDate, a.requestHour")
    List<Object[]> findHourlyStats(@Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("SELECT a.requestDate, a.requestHour, a.requestType, SUM(a.requestCount) " +
           "FROM AiUsageLog a WHERE a.requestDate BETWEEN :start AND :end AND a.userId = :userId " +
           "GROUP BY a.requestDate, a.requestHour, a.requestType ORDER BY a.requestDate, a.requestHour")
    List<Object[]> findHourlyStatsByUser(@Param("start") LocalDate start, @Param("end") LocalDate end, @Param("userId") String userId);

    @Query("SELECT a.userId, a.requestType, SUM(a.requestCount) " +
           "FROM AiUsageLog a WHERE a.requestDate BETWEEN :start AND :end " +
           "GROUP BY a.userId, a.requestType ORDER BY SUM(a.requestCount) DESC")
    List<Object[]> findUserRanking(@Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("SELECT a.userId, a.requestType, SUM(a.requestCount) " +
           "FROM AiUsageLog a WHERE a.requestDate BETWEEN :start AND :end AND a.userId = :userId " +
           "GROUP BY a.userId, a.requestType ORDER BY SUM(a.requestCount) DESC")
    List<Object[]> findUserRankingByUser(@Param("start") LocalDate start, @Param("end") LocalDate end, @Param("userId") String userId);

    @Query("SELECT COUNT(DISTINCT a.userId), SUM(a.requestCount) " +
           "FROM AiUsageLog a WHERE a.requestDate BETWEEN :start AND :end")
    List<Object[]> findSummary(@Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("SELECT COUNT(DISTINCT a.userId), SUM(a.requestCount) " +
           "FROM AiUsageLog a WHERE a.requestDate BETWEEN :start AND :end AND a.userId = :userId")
    List<Object[]> findSummaryByUser(@Param("start") LocalDate start, @Param("end") LocalDate end, @Param("userId") String userId);

    /** 표시 타입만 합산(전체 요약이 화면 칩 합과 일치하도록). */
    @Query("SELECT COUNT(DISTINCT a.userId), SUM(a.requestCount) " +
           "FROM AiUsageLog a WHERE a.requestDate BETWEEN :start AND :end AND a.requestType IN :types")
    List<Object[]> findSummaryByTypes(@Param("start") LocalDate start, @Param("end") LocalDate end,
                                      @Param("types") List<String> types);

    @Query("SELECT COUNT(DISTINCT a.userId), SUM(a.requestCount) " +
           "FROM AiUsageLog a WHERE a.requestDate BETWEEN :start AND :end AND a.userId = :userId AND a.requestType IN :types")
    List<Object[]> findSummaryByUserAndTypes(@Param("start") LocalDate start, @Param("end") LocalDate end,
                                             @Param("userId") String userId, @Param("types") List<String> types);
}
