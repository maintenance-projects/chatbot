-- =============================================================================
--  AI_PARTITION_GRANT 생성 (앱 소유 DB) — AI 파티션(벡터DB 하위) 접근 권한
--  - 벡터DB(dept) 접근 권한(AI_DEPT_GRANT)과 별개 축. 벡터DB 안의 특정 파티션 단위 접근을 제어.
--  - 기본 폐쇄: 파티션 grant가 명시된 대상만 해당 파티션 접근(2차 질의 연동 시 적용).
--  - 조직(PART_ID) 부여는 하위 사용자에 상속(런타임 해석), 사용자 DENY로 예외 제외.
--  - 인사(HR) DB(msg_user/msg_part)는 조회만, 여기(앱DB)에 권한 저장.
--  - 앱 DB가 ddl-auto=create/update 면 JPA가 자동 생성. ddl-auto=none이면 아래 수동 실행.
--  - (구) AI_COLLECTION_GRANT / COLLECTION_NAME 에서 명칭 변경(콜렉션→파티션). 기존 테이블이 있으면
--    아래 참고의 rename 문으로 이관하거나, 데이터가 없으면 DROP 후 신규 생성.
-- =============================================================================

-- ---- MySQL ----
CREATE TABLE IF NOT EXISTS AI_PARTITION_GRANT (
    TARGET_TYPE     VARCHAR(10)  NOT NULL,   -- PART | USER
    TARGET_ID       VARCHAR(100) NOT NULL,   -- PART_ID or USER_ID
    AI_DEPT         VARCHAR(50)  NOT NULL,   -- 벡터DB 코드(dept-a 등)
    PARTITION_NAME  VARCHAR(100) NOT NULL,   -- 파티션 식별자(게이트웨이 name, 예: documents_1)
    GRANT_MODE      VARCHAR(10)  NULL,       -- ALLOW | DENY
    PRIMARY KEY (TARGET_TYPE, TARGET_ID, AI_DEPT, PARTITION_NAME)
);

-- ---- Oracle ----
-- CREATE TABLE AI_PARTITION_GRANT (
--     TARGET_TYPE     VARCHAR2(10)  NOT NULL,
--     TARGET_ID       VARCHAR2(100) NOT NULL,
--     AI_DEPT         VARCHAR2(50)  NOT NULL,
--     PARTITION_NAME  VARCHAR2(100) NOT NULL,
--     GRANT_MODE      VARCHAR2(10),
--     CONSTRAINT pk_ai_partition_grant PRIMARY KEY (TARGET_TYPE, TARGET_ID, AI_DEPT, PARTITION_NAME)
-- );

-- ---- (참고) 구 AI_COLLECTION_GRANT 가 이미 있고 데이터 이관이 필요할 때 ----
-- MySQL : RENAME TABLE AI_COLLECTION_GRANT TO AI_PARTITION_GRANT;
--         ALTER TABLE AI_PARTITION_GRANT CHANGE COLLECTION_NAME PARTITION_NAME VARCHAR(100) NOT NULL;
-- Oracle: ALTER TABLE AI_COLLECTION_GRANT RENAME TO AI_PARTITION_GRANT;
--         ALTER TABLE AI_PARTITION_GRANT RENAME COLUMN COLLECTION_NAME TO PARTITION_NAME;
