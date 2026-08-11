-- =============================================================================
--  ai_usage_log 유니크키에 request_hour 추가 (앱 소유 DB)
--  - 사용량 집계는 (user, type, date, hour) 시간별 행인데, 기존 유니크키
--    uk_ai_usage=(user_id, request_type, request_date)는 일별이라 같은 날 두 번째
--    시간대 요청이 INSERT 시 중복키로 실패 → 대화/문서 요청 전체가 오류가 났음.
--  - 유니크키를 시간별로 확장해 정합화. 일별→시간별 확장이라 기존 데이터 위반 없음.
--  - ddl-auto=update는 기존 유니크키를 자동 변경하지 않으므로 아래를 수동 실행.
-- =============================================================================

-- ---- MySQL ----
ALTER TABLE ai_usage_log
    DROP INDEX uk_ai_usage,
    ADD UNIQUE KEY uk_ai_usage (user_id, request_type, request_date, request_hour);

-- ---- Oracle ----
-- ALTER TABLE ai_usage_log DROP CONSTRAINT uk_ai_usage;
-- ALTER TABLE ai_usage_log ADD CONSTRAINT uk_ai_usage
--     UNIQUE (user_id, request_type, request_date, request_hour);
