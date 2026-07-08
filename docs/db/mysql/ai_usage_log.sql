-- =============================================================================
--  ai_usage_log  초기 생성 DDL  (MySQL 8)
--  - 월별 RANGE 파티션 테이블
--  - ddl-auto=none 이므로 앱 최초 기동 전에 DBA가 1회 수동 실행
--  - 이후 월 파티션은 PartitionScheduler(매월 25일)가 자동 추가
-- =============================================================================
--
--  [중요] MySQL 파티션 규칙
--   파티션 컬럼(request_date)은 테이블의 모든 UNIQUE/PRIMARY KEY 에 포함돼야 한다.
--   그래서 PK 를 (log_id, request_date) 로 구성한다.
--   (엔티티의 @Id 는 log_id 지만, 파티셔닝 위해 복합 PK 로 생성)
-- =============================================================================

CREATE TABLE ai_usage_log (
    log_id        VARCHAR(50)  NOT NULL,
    user_id       VARCHAR(50)  NOT NULL,
    session_id    VARCHAR(100) NULL,
    request_type  VARCHAR(20)  NOT NULL,           -- CHAT, DOCUMENT ...
    request_date  DATE         NOT NULL,           -- 파티션 키
    request_hour  INT          NOT NULL,           -- 0 ~ 23
    request_count INT          NOT NULL,
    created_at    DATETIME     NOT NULL,
    updated_at    DATETIME     NOT NULL,
    PRIMARY KEY (log_id, request_date),
    UNIQUE KEY uk_ai_usage (user_id, request_type, request_date)
)
ENGINE = InnoDB
DEFAULT CHARSET = utf8mb4
PARTITION BY RANGE (TO_DAYS(request_date)) (
    -- ↓ 운영 시작 월로 조정 (예: 2026-07 오픈 → p202607, 경계값은 다음 달 1일)
    PARTITION p202607 VALUES LESS THAN (TO_DAYS('2026-08-01')),
    -- pmax(MAXVALUE) 는 반드시 존재해야 함. 앱이 이 파티션을 drop 후 재생성하며 월 파티션을 추가한다.
    PARTITION pmax    VALUES LESS THAN (MAXVALUE)
);

-- -----------------------------------------------------------------------------
-- (참고) 앱이 수행하는 월 파티션 추가와 동일한 수동 예시
--   MySQL 은 MAXVALUE 상단에 ADD 가 불가하므로 pmax 제거 후 재추가한다.
-- -----------------------------------------------------------------------------
-- ALTER TABLE ai_usage_log DROP PARTITION pmax;
-- ALTER TABLE ai_usage_log ADD PARTITION (
--     PARTITION p202608 VALUES LESS THAN (TO_DAYS('2026-09-01')),
--     PARTITION pmax    VALUES LESS THAN (MAXVALUE)
-- );
