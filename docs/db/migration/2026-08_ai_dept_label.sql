-- =============================================================================
--  AI_DEPT_LABEL 생성 (앱 소유 DB) — AI 부서(dept) 표시 명칭
--  - dept 코드(dept-a 등)의 사용자 노출 명칭. 관리자 화면(AI 파티션 권한)에서 지정.
--  - 미지정 코드는 코드 자체를 명칭으로 사용(폴백).
--  - 앱 DB가 ddl-auto=create/update 면 JPA가 자동 생성. ddl-auto=none이면 아래 수동 실행.
-- =============================================================================

-- ---- MySQL ----
CREATE TABLE IF NOT EXISTS AI_DEPT_LABEL (
    DEPT_CODE VARCHAR(50)  NOT NULL,   -- dept code (PK)
    LABEL     VARCHAR(100) NULL,       -- 표시 명칭
    PRIMARY KEY (DEPT_CODE)
);

-- ---- Oracle ----
-- CREATE TABLE AI_DEPT_LABEL (
--     DEPT_CODE VARCHAR2(50)  NOT NULL,
--     LABEL     VARCHAR2(100),
--     CONSTRAINT pk_ai_dept_label PRIMARY KEY (DEPT_CODE)
-- );
