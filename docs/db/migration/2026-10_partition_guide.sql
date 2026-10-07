-- =============================================================================
--  APP_SETTING.SETTING_VALUE 컬럼 확장 (파티션 안내문구 수용)
--  - 파티션별 사용자 화면 인사말(안내문구)을 로컬 APP_SETTING KV에 저장한다.
--    키: partition.guide.{dept}.{name} (파티션별), partition.guide.__default__ (기본값)
--  - 기존 SETTING_VALUE VARCHAR(500) → VARCHAR(2000) 으로 장문 수용.
--  - 앱 DB가 ddl-auto=update 면 JPA가 컬럼 길이 확장을 자동 반영(MySQL). none/validate 면 아래 수동 실행.
--  - 신규 테이블/행 생성 아님(값 행은 관리자 환경설정 저장 시 생성). 데이터 손실 없음(길이 확장).
-- =============================================================================

-- ---- MySQL ----
ALTER TABLE APP_SETTING MODIFY SETTING_VALUE VARCHAR(2000);

-- ---- Oracle ----
-- ALTER TABLE APP_SETTING MODIFY (SETTING_VALUE VARCHAR2(2000));
