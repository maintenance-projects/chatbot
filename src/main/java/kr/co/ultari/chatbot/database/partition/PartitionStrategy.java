package kr.co.ultari.chatbot.database.partition;

/**
 * DBMS별 파티션 관리 전략.
 * 구현체는 {@code ultari.db.vendor} 프로퍼티로 선택된다. (mysql | oracle)
 */
public interface PartitionStrategy {

    /**
     * 현재 월 기준으로 {@code monthsAhead} 개월치 미래 파티션을 미리 생성한다.
     * 이미 존재하는 월 파티션은 건너뛴다.
     */
    void createFuturePartitions(int monthsAhead);
}