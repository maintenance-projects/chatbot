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
    AI_DEPT     VARCHAR2(50),            -- 부서(게이트웨이 라우팅) — 관리자 화면에서 지정
    CONSTRAINT pk_msg_user PRIMARY KEY (USER_ID)
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
