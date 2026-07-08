-- =============================================================================
--  ai_usage_log  초기 생성 DDL  (Oracle 19c)
--  - 월별 RANGE 파티션 테이블
--  - Enterprise Edition + Partitioning 옵션 필요 (v$option 확인)
--  - ddl-auto=none 이므로 앱 최초 기동 전에 DBA가 1회 수동 실행
--  - 이후 월 파티션은 PartitionScheduler(매월 25일)가 SPLIT PARTITION 으로 자동 추가
-- =============================================================================
--
--  [참고] Oracle 은 MySQL 과 달리 파티션 컬럼을 PK/UNIQUE 에 포함할 필요가 없다.
--         따라서 PK 는 log_id 단독으로 둔다. (엔티티 @Id 와 동일)
-- =============================================================================

CREATE TABLE ai_usage_log (
    log_id        VARCHAR2(50)  NOT NULL,
    user_id       VARCHAR2(50)  NOT NULL,
    session_id    VARCHAR2(100),
    request_type  VARCHAR2(20)  NOT NULL,          -- CHAT, DOCUMENT ...
    request_date  DATE          NOT NULL,          -- 파티션 키
    request_hour  NUMBER(2)     NOT NULL,          -- 0 ~ 23
    request_count NUMBER(10)    NOT NULL,
    created_at    TIMESTAMP     NOT NULL,
    updated_at    TIMESTAMP     NOT NULL,
    CONSTRAINT pk_ai_usage_log PRIMARY KEY (log_id),
    CONSTRAINT uk_ai_usage     UNIQUE (user_id, request_type, request_date)
)
PARTITION BY RANGE (request_date) (
    -- ↓ 운영 시작 월로 조정 (예: 2026-07 오픈 → p202607, 경계값은 다음 달 1일)
    PARTITION p202607 VALUES LESS THAN (TO_DATE('2026-08-01','YYYY-MM-DD')),
    -- pmax(MAXVALUE) 는 반드시 존재해야 함. 앱이 이 파티션을 SPLIT 하여 월 파티션을 추가한다.
    PARTITION pmax    VALUES LESS THAN (MAXVALUE)
);

-- -----------------------------------------------------------------------------
-- (참고) 앱이 수행하는 월 파티션 추가와 동일한 수동 예시
--   Oracle 은 MAXVALUE 상단에 ADD 가 불가하므로 pmax 를 SPLIT 한다.
-- -----------------------------------------------------------------------------
-- ALTER TABLE ai_usage_log SPLIT PARTITION pmax INTO (
--     PARTITION p202608 VALUES LESS THAN (TO_DATE('2026-09-01','YYYY-MM-DD')),
--     PARTITION pmax
-- );
