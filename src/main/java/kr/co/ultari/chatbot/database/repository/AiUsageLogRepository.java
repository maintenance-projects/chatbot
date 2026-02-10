package kr.co.ultari.chatbot.database.repository;

import kr.co.ultari.chatbot.database.entity.AiUsageLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface AiUsageLogRepository extends JpaRepository<AiUsageLog, Long> {

    Optional<AiUsageLog> findByUserIdAndRequestTypeAndRequestDateAndRequestHour(
            String userId,
            String requestType,
            LocalDate requestDate,
            int requestHour
    );

    @Query("SELECT a.requestDate, a.requestType, COUNT(DISTINCT a.userId), SUM(a.requestCount) " +
           "FROM AiUsageLog a WHERE a.requestDate BETWEEN :start AND :end " +
           "GROUP BY a.requestDate, a.requestType ORDER BY a.requestDate")
    List<Object[]> findDailyStats(@Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("SELECT a.requestDate, a.requestType, COUNT(DISTINCT a.userId), SUM(a.requestCount) " +
           "FROM AiUsageLog a WHERE a.requestDate BETWEEN :start AND :end AND a.userId = :userId " +
           "GROUP BY a.requestDate, a.requestType ORDER BY a.requestDate")
    List<Object[]> findDailyStatsByUser(@Param("start") LocalDate start, @Param("end") LocalDate end, @Param("userId") String userId);

    @Query("SELECT a.requestHour, a.requestType, SUM(a.requestCount) " +
           "FROM AiUsageLog a WHERE a.requestDate BETWEEN :start AND :end " +
           "GROUP BY a.requestHour, a.requestType ORDER BY a.requestHour")
    List<Object[]> findHourlyStats(@Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("SELECT a.requestHour, a.requestType, SUM(a.requestCount) " +
           "FROM AiUsageLog a WHERE a.requestDate BETWEEN :start AND :end AND a.userId = :userId " +
           "GROUP BY a.requestHour, a.requestType ORDER BY a.requestHour")
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
}
