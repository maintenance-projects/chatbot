-- =============================================================================
--  AI_COLLECTION_GRANT 생성 (앱 소유 DB) — AI 콜렉션(dept 하위 partition) 접근 권한
--  - dept 접근 권한(AI_DEPT_GRANT)과 별개 축. dept 안의 특정 콜렉션 단위 접근을 제어.
--  - 기본 폐쇄: 콜렉션 grant가 명시된 대상만 해당 콜렉션 접근(2차 질의 연동 시 적용).
--  - 조직(PART_ID) 부여는 하위 사용자에 상속(런타임 해석), 사용자 DENY로 예외 제외.
--  - 인사(HR) DB(msg_user/msg_part)는 조회만, 여기(앱DB)에 권한 저장.
--  - 앱 DB가 ddl-auto=create/update 면 JPA가 자동 생성. ddl-auto=none이면 아래 수동 실행.
-- =============================================================================

-- ---- MySQL ----
CREATE TABLE IF NOT EXISTS AI_COLLECTION_GRANT (
    TARGET_TYPE     VARCHAR(10)  NOT NULL,   -- PART | USER
    TARGET_ID       VARCHAR(100) NOT NULL,   -- PART_ID or USER_ID
    AI_DEPT         VARCHAR(50)  NOT NULL,   -- dept code
    COLLECTION_NAME VARCHAR(100) NOT NULL,   -- 콜렉션 식별자(게이트웨이 name, 예: documents_1)
    GRANT_MODE      VARCHAR(10)  NULL,       -- ALLOW | DENY
    PRIMARY KEY (TARGET_TYPE, TARGET_ID, AI_DEPT, COLLECTION_NAME)
);

-- ---- Oracle ----
-- CREATE TABLE AI_COLLECTION_GRANT (
--     TARGET_TYPE     VARCHAR2(10)  NOT NULL,
--     TARGET_ID       VARCHAR2(100) NOT NULL,
--     AI_DEPT         VARCHAR2(50)  NOT NULL,
--     COLLECTION_NAME VARCHAR2(100) NOT NULL,
--     GRANT_MODE      VARCHAR2(10),
--     CONSTRAINT pk_ai_collection_grant PRIMARY KEY (TARGET_TYPE, TARGET_ID, AI_DEPT, COLLECTION_NAME)
-- );
