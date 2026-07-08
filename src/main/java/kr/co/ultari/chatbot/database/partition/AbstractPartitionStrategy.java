package kr.co.ultari.chatbot.database.partition;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * 파티션 관리 공통 흐름(월 순회, 파티션명 생성, 존재 여부 확인)을 담은 템플릿.
 * DBMS 종속적인 "존재 확인 SQL"과 "파티션 추가 DDL"만 하위 클래스가 구현한다.
 */
@Slf4j
public abstract class AbstractPartitionStrategy implements PartitionStrategy {

    protected static final DateTimeFormatter YM = DateTimeFormatter.ofPattern("yyyyMM");

    protected final JdbcTemplate jdbcTemplate;

    @Value("${ultari.ai.log-table.name:ai_usage_log}")
    protected String logTableName;

    protected AbstractPartitionStrategy(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void createFuturePartitions(int monthsAhead) {
        for (int i = 1; i <= monthsAhead; i++) {
            createSpecificMonthPartition(LocalDate.now().plusMonths(i));
        }
    }

    private void createSpecificMonthPartition(LocalDate targetMonth) {
        LocalDate monthStart = targetMonth.withDayOfMonth(1);
        LocalDate boundaryExclusive = monthStart.plusMonths(1); // 다음 달 1일 (VALUES LESS THAN)

        String partitionName = "p" + monthStart.format(YM);

        if (partitionExists(partitionName)) {
            log.info("[Partition] {} already exists. skip.", partitionName);
            return;
        }

        log.info("[Partition] create {}", partitionName);
        addMonthlyPartition(partitionName, boundaryExclusive);
    }

    /** 해당 이름의 파티션이 이미 존재하는지 (DBMS별 시스템 카탈로그 조회). */
    protected abstract boolean partitionExists(String partitionName);

    /**
     * 월 파티션을 추가한다.
     * @param partitionName    생성할 파티션명 (예: p202608)
     * @param boundaryExclusive VALUES LESS THAN 경계값 (해당 월 다음 달 1일, 미포함)
     */
    protected abstract void addMonthlyPartition(String partitionName, LocalDate boundaryExclusive);
}
