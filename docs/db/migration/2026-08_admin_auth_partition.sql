-- =============================================================================
--  chatbot_admin 에 AUTH_PARTITION 권한 컬럼 추가 (관리자 'AI 파티션 권한')
--  - 관리자 관리 화면의 권한 4번째 항목. 챗봇 관리자 nav의 'AI 파티션 권한'(/at-i/users)
--    노출을 이 권한으로 제어(기존엔 AUTH_MASTER로 제어했음).
--  - 앱 DB가 ddl-auto=update면 컬럼은 JPA가 자동 추가. ddl-auto=none이면 아래 수동 실행.
--  - 기존 관리자는 이전에 AUTH_MASTER로 이 메뉴를 봤으므로 AUTH_MASTER 값으로 백필.
-- =============================================================================

-- ---- MySQL ----
ALTER TABLE chatbot_admin ADD COLUMN AUTH_PARTITION CHAR(1) NULL;
UPDATE chatbot_admin SET AUTH_PARTITION = AUTH_MASTER WHERE AUTH_PARTITION IS NULL;

-- ---- Oracle ----
-- ALTER TABLE chatbot_admin ADD (AUTH_PARTITION CHAR(1));
-- UPDATE chatbot_admin SET AUTH_PARTITION = AUTH_MASTER WHERE AUTH_PARTITION IS NULL;
-- COMMIT;
