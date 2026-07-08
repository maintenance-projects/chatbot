package kr.co.ultari.chatbot.database.partition;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;

/**
 * MySQL 파티션 전략.
 * 전제: ai_usage_log 테이블이 {@code PARTITION BY RANGE (TO_DAYS(request_date))} 로 생성되어 있고
 *       MAXVALUE 파티션 {@code pmax} 가 존재해야 한다.
 * MySQL 은 MAXVALUE 상단에 ADD PARTITION 이 불가하므로 pmax 를 제거 후 재추가한다.
 */
@Slf4j
@Service
@ConditionalOnProperty(name = "ultari.db.vendor", havingValue = "mysql", matchIfMissing = true)
public class MySqlPartitionStrategy extends AbstractPartitionStrategy {

    public MySqlPartitionStrategy(JdbcTemplate jdbcTemplate) {
        super(jdbcTemplate);
    }

    @Override
    protected boolean partitionExists(String partitionName) {
        String sql =
                "SELECT COUNT(*) FROM information_schema.PARTITIONS " +
                "WHERE TABLE_SCHEMA = DATABASE() " +
                "AND TABLE_NAME = ? " +
                "AND PARTITION_NAME = ?";
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, logTableName, partitionName);
        return count != null && count > 0;
    }

    @Override
    protected void addMonthlyPartition(String partitionName, LocalDate boundaryExclusive) {
        // pmax 제거 후, 새 월 파티션 + pmax 재추가
        if (partitionExists("pmax")) {
            jdbcTemplate.execute("ALTER TABLE " + logTableName + " DROP PARTITION pmax");
        }

        String sql = "ALTER TABLE " + logTableName + " ADD PARTITION (" +
                "PARTITION " + partitionName + " VALUES LESS THAN (TO_DAYS('" + boundaryExclusive + "'))," +
                "PARTITION pmax VALUES LESS THAN (MAXVALUE)" +
                ")";
        jdbcTemplate.execute(sql);
    }
}
