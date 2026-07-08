package kr.co.ultari.chatbot.database.partition;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;

/**
 * Oracle 파티션 전략. (Enterprise Edition + Partitioning 옵션 필요)
 * 전제: ai_usage_log 테이블이 {@code PARTITION BY RANGE (request_date)} 로 생성되어 있고
 *       MAXVALUE 파티션 {@code pmax} 가 존재해야 한다.
 * Oracle 은 MAXVALUE 상단에 ADD PARTITION 이 불가하므로 pmax 를 SPLIT 하여 월 파티션을 만든다.
 */
@Slf4j
@Service
@ConditionalOnProperty(name = "ultari.db.vendor", havingValue = "oracle")
public class OraclePartitionStrategy extends AbstractPartitionStrategy {

    public OraclePartitionStrategy(JdbcTemplate jdbcTemplate) {
        super(jdbcTemplate);
    }

    @Override
    protected boolean partitionExists(String partitionName) {
        // Oracle 은 식별자를 기본 대문자로 저장하므로 UPPER 비교
        String sql =
                "SELECT COUNT(*) FROM user_tab_partitions " +
                "WHERE UPPER(table_name) = UPPER(?) " +
                "AND UPPER(partition_name) = UPPER(?)";
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, logTableName, partitionName);
        return count != null && count > 0;
    }

    @Override
    protected void addMonthlyPartition(String partitionName, LocalDate boundaryExclusive) {
        // MAXVALUE 파티션(pmax)을 분할하여 월 파티션 생성 (pmax 는 그대로 유지)
        String sql = "ALTER TABLE " + logTableName + " SPLIT PARTITION pmax INTO (" +
                "PARTITION " + partitionName +
                " VALUES LESS THAN (TO_DATE('" + boundaryExclusive + "','YYYY-MM-DD'))," +
                "PARTITION pmax" +
                ")";
        jdbcTemplate.execute(sql);
    }
}
