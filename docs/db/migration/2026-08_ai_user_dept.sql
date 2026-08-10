-- =============================================================================
--  AI_USER_DEPT 생성 (앱 소유 DB) — 사용자 → AI 부서(dept-a/dept-b) 매핑
--  - 인사(HR) DB의 msg_user 는 조회만 하며 수정하지 않는다(부서 지정은 여기 저장).
--  - 관리자 화면(사용자 부서)에서 사용자별로 지정한다.
--  - 미지정 사용자는 앱 설정 default-dept(기본 dept-a)로 라우팅된다.
--  - 앱 DB가 ddl-auto=create/update 면 JPA가 자동 생성한다. ddl-auto=none이면 아래 수동 실행.
-- =============================================================================

-- ---- MySQL ----
CREATE TABLE IF NOT EXISTS AI_USER_DEPT (
    USER_ID VARCHAR(50) NOT NULL,
    AI_DEPT VARCHAR(50) NULL,
    PRIMARY KEY (USER_ID)
);

-- ---- Oracle ----
-- CREATE TABLE AI_USER_DEPT (
--     USER_ID VARCHAR2(50) NOT NULL,
--     AI_DEPT VARCHAR2(50),
--     CONSTRAINT pk_ai_user_dept PRIMARY KEY (USER_ID)
-- );
