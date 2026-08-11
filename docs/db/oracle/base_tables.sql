-- =============================================================================
--  비파티션 기본 테이블 초기 생성 DDL  (Oracle)
--  - MSG_USER      : 메신저 연동 사용자 (외부 시스템 테이블일 수 있음 — 이미 존재하면 실행 생략)
--  - chatbot_admin : 관리자 계정 / 권한
--  - ddl-auto=none 이므로 앱 최초 기동 전에 DBA가 1회 수동 실행
--  - 파티션 대상 아님. 일반 테이블로 생성한다. (ai_usage_log 는 별도: ai_usage_log.sql)
-- =============================================================================

-- -----------------------------------------------------------------------------
--  MSG_USER  (메신저 연동 사용자)
--   ※ 외부 메신저 시스템이 이미 보유한 테이블이면 생성하지 말 것.
--     신규 환경(챗봇 단독)일 때만 생성한다.
-- -----------------------------------------------------------------------------
CREATE TABLE MSG_USER (
    USER_ID     VARCHAR2(50) NOT NULL,   -- 사용자 ID (PK)
    USER_HIGH   VARCHAR2(50),            -- 상위 조직/사용자
    USER_NAME   VARCHAR2(50),            -- 이름
    POS_NAME    VARCHAR2(50),            -- 직위명
    GRADE       VARCHAR2(50),            -- 등급
    PHONE       VARCHAR2(50),            -- 전화
    MOBILE      VARCHAR2(50),            -- 휴대폰
    JOB         VARCHAR2(50),            -- 직무
    PASSWORD    VARCHAR2(50),            -- 비밀번호
    USER_ORDER  VARCHAR2(50),            -- 정렬 순서
    USER_TYPE   VARCHAR2(50),            -- 사용자 구분
    CONSTRAINT pk_msg_user PRIMARY KEY (USER_ID)
);
--  ※ 실제 운영에선 MSG_USER는 외부 인사(HR) DB의 조회 전용 테이블이다(MyBatis).
--    부서 지정값은 앱 소유 AI_USER_DEPT(아래)에 저장한다.

-- -----------------------------------------------------------------------------
--  AI_DEPT_GRANT  (앱 소유) — AI 부서(dept) 접근 권한 부여
--   조직(PART) 또는 사용자(USER) 대상에 dept 부여(ALLOW)/제외(DENY). 중복 허용.
--   관리자 화면(사용자 부서)에서 지정. 인사DB는 수정하지 않는다.
-- -----------------------------------------------------------------------------
CREATE TABLE AI_DEPT_GRANT (
    TARGET_TYPE VARCHAR2(10) NOT NULL, -- PART(조직) | USER(사용자)
    TARGET_ID   VARCHAR2(100) NOT NULL,-- PART_ID 또는 USER_ID
    AI_DEPT     VARCHAR2(50) NOT NULL, -- 부서코드
    GRANT_MODE  VARCHAR2(10),          -- ALLOW | DENY
    CONSTRAINT pk_ai_dept_grant PRIMARY KEY (TARGET_TYPE, TARGET_ID, AI_DEPT)
);

-- -----------------------------------------------------------------------------
--  AI_DEPT_LABEL  (앱 소유) — AI 부서(dept) 표시 명칭
--   dept 코드(dept-a 등)의 사용자 노출 명칭. 관리자 화면(AI 파티션 권한)에서 지정.
--   미지정 코드는 코드 자체를 명칭으로 사용한다.
-- -----------------------------------------------------------------------------
CREATE TABLE AI_DEPT_LABEL (
    DEPT_CODE   VARCHAR2(50) NOT NULL,  -- 부서코드 (PK)
    LABEL       VARCHAR2(100),          -- 표시 명칭
    CONSTRAINT pk_ai_dept_label PRIMARY KEY (DEPT_CODE)
);

-- -----------------------------------------------------------------------------
--  chatbot_admin  (관리자 계정 / 권한)
--   AUTH_* : 'Y'/'N' 권한 플래그 (저장소 / 통계 / 마스터)
-- -----------------------------------------------------------------------------
CREATE TABLE chatbot_admin (
    ADMIN_ID        VARCHAR2(50) NOT NULL,   -- 관리자 ID (PK)
    ADMIN_NAME      VARCHAR2(50),            -- 관리자명
    PASSWORD        VARCHAR2(50),            -- 비밀번호
    AUTH_STORAGE    CHAR(1),                 -- 저장소 권한 Y/N
    AUTH_STATISTICS CHAR(1),                 -- 통계 권한 Y/N
    AUTH_MASTER     CHAR(1),                 -- 마스터 권한 Y/N
    IP              VARCHAR2(50),            -- 접속 허용 IP
    REG_DATE        TIMESTAMP,               -- 등록일시
    UPDATE_DATE     TIMESTAMP,               -- 수정일시
    CONSTRAINT pk_chatbot_admin PRIMARY KEY (ADMIN_ID)
);

-- -----------------------------------------------------------------------------
--  (선택) 최초 마스터 관리자 시드 — 운영값으로 교체 후 사용
-- -----------------------------------------------------------------------------
-- INSERT INTO chatbot_admin
--   (ADMIN_ID, ADMIN_NAME, PASSWORD, AUTH_STORAGE, AUTH_STATISTICS, AUTH_MASTER, IP, REG_DATE, UPDATE_DATE)
-- VALUES
--   ('admin', '관리자', 'CHANGE_ME', 'Y', 'Y', 'Y', NULL, SYSTIMESTAMP, SYSTIMESTAMP);
-- COMMIT;
