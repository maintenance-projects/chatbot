-- =============================================================================
--  MSG_USER 에 DEPT(부서) 컬럼 추가  — 게이트웨이 라우팅(/{dept}/...) 결정용
--  - 사용자의 부서는 관리자 화면(사용자 부서 관리)에서 지정한다.
--  - 값이 없는 사용자는 앱 설정 default-dept(기본 dept-a)로 라우팅된다.
--  - ddl-auto=none 이므로 앱 기동 전에 DBA가 1회 수동 실행할 것.
--  - 이미 컬럼이 있으면 실행 생략.
-- =============================================================================

-- ---- MySQL ----
ALTER TABLE MSG_USER ADD COLUMN DEPT VARCHAR(50) NULL;

-- ---- Oracle ----
-- ALTER TABLE MSG_USER ADD (DEPT VARCHAR2(50));

-- (선택) 특정 사용자들을 dept-b로 일괄 지정하는 예시
-- UPDATE MSG_USER SET DEPT = 'dept-b' WHERE USER_HIGH = '<조직코드>';
-- COMMIT;   -- Oracle
