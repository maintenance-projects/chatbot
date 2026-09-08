package kr.co.ultari.chatbot.database.repository;

import kr.co.ultari.chatbot.database.entity.GpuUsageLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface GpuUsageLogRepository extends JpaRepository<GpuUsageLog, String> {

    /** 기간 내 이력(시각 오름차순). 차트용. */
    List<GpuUsageLog> findBySampledAtBetweenOrderBySampledAtAsc(LocalDateTime start, LocalDateTime end);

    /** 보존기간 초과분 정리(무한 증가 방지). */
    @Transactional
    @Modifying
    @Query("DELETE FROM GpuUsageLog g WHERE g.sampledAt < :cutoff")
    int deleteOlderThan(@Param("cutoff") LocalDateTime cutoff);
}
