package kr.co.ultari.chatbot.database.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@Slf4j
@Service
@RequiredArgsConstructor
public class PartitionManageService {

    private final JdbcTemplate jdbcTemplate;

    private static final DateTimeFormatter YM = DateTimeFormatter.ofPattern("yyyyMM");

    @Value("${ultari.ai.log-table.name:ai_usage_log}")
    String logTableName;

    public void createNextMonthPartitionIfNotExists() {

        // 다음 달 (파티션 이름용)
        LocalDate nextMonth = LocalDate.now().withDayOfMonth(1).plusMonths(1);

        // 파티션 경계값 (다다음 달 1일)
        LocalDate boundaryDate = nextMonth.plusMonths(1);

        String partitionName = "p" + nextMonth.format(YM);
        String pmax = "pmax";

        // 파티션 존재 여부 확인
        if (partitionExists(partitionName)) {
            log.info("[Partition] {} already exists. skip.", partitionName);
            return;
        }

        // pmax 제거
        if (partitionExists(pmax)) {
            jdbcTemplate.execute(
                    "ALTER TABLE " + logTableName + " DROP PARTITION pmax"
            );
        }

        // 파티션 생성+ pmax 재추가
        String sql = String.format(
                "ALTER TABLE " + logTableName + " ADD PARTITION (" +
                        "PARTITION %s VALUES LESS THAN (TO_DAYS('%s'))," +
                        "PARTITION pmax VALUES LESS THAN (MAXVALUE)" +
                        ")",
                partitionName,
                boundaryDate
        );

        log.info("[Partition] create {}", partitionName);
        jdbcTemplate.execute(sql);
    }

    public void createFuturePartitions(int monthsAhead) {
        for (int i = 1; i <= monthsAhead; i++) {
            createSpecificMonthPartition(LocalDate.now().plusMonths(i));
        }
    }

    public void createSpecificMonthPartition(LocalDate targetMonth) {

        LocalDate monthStart = targetMonth.withDayOfMonth(1);
        LocalDate boundaryDate = monthStart.plusMonths(1);

        String newPartition = "p" + monthStart.format(YM);
        String pmax = "pmax";

        // 이미 월 파티션이 있으면 종료
        if (partitionExists(newPartition)) {
            log.info("[Partition] {} already exists", newPartition);
            return;
        }

        // pmax 제거
        if (partitionExists(pmax)) {
            jdbcTemplate.execute(
                    "ALTER TABLE " + logTableName + " DROP PARTITION pmax"
            );
        }

        // 새 월 파티션 + pmax 재추가
        String sql = String.format(
                "ALTER TABLE " + logTableName + " ADD PARTITION (" +
                        "PARTITION %s VALUES LESS THAN (TO_DAYS('%s'))," +
                        "PARTITION pmax VALUES LESS THAN (MAXVALUE)" +
                        ")",
                newPartition,
                boundaryDate
        );

        log.info("[Partition] create {}", newPartition);
        jdbcTemplate.execute(sql);
    }

    private boolean partitionExists(String partitionName) {
        String sql =
                "SELECT COUNT(*) " +
                        "FROM information_schema.PARTITIONS " +
                        "WHERE TABLE_SCHEMA = DATABASE() " +
                        "AND TABLE_NAME = '" + logTableName + "' " +
                        "AND PARTITION_NAME = ?";

        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, partitionName);

        return count != null && count > 0;
    }
}
