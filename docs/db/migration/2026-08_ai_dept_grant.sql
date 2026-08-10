-- =============================================================================
--  AI_DEPT_GRANT 생성 (앱 소유 DB) — AI 부서(dept) 접근 권한 부여
--  - 조직(PART_ID) 또는 사용자(USER_ID) 대상에 dept 부여(ALLOW)/제외(DENY). 중복 허용.
--  - 조직 부여는 하위 사용자에 상속(런타임 해석), 사용자 DENY로 예외 제외.
--  - 인사(HR) DB(msg_user/msg_part)는 조회만, 여기(앱DB)에 권한 저장.
--  - 앱 DB가 ddl-auto=create/update 면 JPA가 자동 생성. ddl-auto=none이면 아래 수동 실행.
-- =============================================================================

-- ---- MySQL ----
CREATE TABLE IF NOT EXISTS AI_DEPT_GRANT (
    TARGET_TYPE VARCHAR(10)  NOT NULL,   -- PART | USER
    TARGET_ID   VARCHAR(100) NOT NULL,   -- PART_ID or USER_ID
    AI_DEPT     VARCHAR(50)  NOT NULL,   -- dept code
    GRANT_MODE  VARCHAR(10)  NULL,       -- ALLOW | DENY
    PRIMARY KEY (TARGET_TYPE, TARGET_ID, AI_DEPT)
);

-- ---- Oracle ----
-- CREATE TABLE AI_DEPT_GRANT (
--     TARGET_TYPE VARCHAR2(10)  NOT NULL,
--     TARGET_ID   VARCHAR2(100) NOT NULL,
--     AI_DEPT     VARCHAR2(50)  NOT NULL,
--     GRANT_MODE  VARCHAR2(10),
--     CONSTRAINT pk_ai_dept_grant PRIMARY KEY (TARGET_TYPE, TARGET_ID, AI_DEPT)
-- );
