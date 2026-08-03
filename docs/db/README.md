# DB 초기 세팅 가이드 (고객사 납품용)

`ai_usage_log`(AI 사용량 로그) 테이블은 **월별 RANGE 파티션**으로 운영됩니다.
앱은 `spring.jpa.hibernate.ddl-auto=none` 이므로 스키마를 자동 생성하지 않습니다.
**최초 1회 DBA가 아래 DDL을 수동 실행**해야 하며, 이후 월 파티션은 앱이 자동 추가합니다.

## 1. DBMS 종류 선택

`application.properties` 에서 vendor 와 datasource 를 **세트로** 맞춥니다.

| vendor | 파티션 전략 빈 | dialect | driver |
|--------|----------------|---------|--------|
| `mysql`  | `MySqlPartitionStrategy`  | `MySQL8Dialect`     | `com.mysql.cj.jdbc.Driver` |
| `oracle` | `OraclePartitionStrategy` | `Oracle12cDialect`* | `oracle.jdbc.OracleDriver`  |

> \* Hibernate 5.4 에는 `Oracle19cDialect` 가 없습니다. **`Oracle12cDialect` 가 12c/18c/19c/21c 공식 방언**입니다.

```properties
ultari.db.vendor=oracle
spring.datasource.driver-class-name=oracle.jdbc.OracleDriver
spring.jpa.database-platform=org.hibernate.dialect.Oracle12cDialect
```

## 2. 초기 DDL 실행

| DBMS | 스크립트 |
|------|----------|
| MySQL 8 | [`mysql/ai_usage_log.sql`](mysql/ai_usage_log.sql) |
| Oracle 19c | [`oracle/ai_usage_log.sql`](oracle/ai_usage_log.sql) |

**실행 전 반드시 확인:**
- 스크립트의 시작 파티션명(`p202607`)·경계값(`2026-08-01`)을 **운영 개시 월**로 조정
- **`pmax`(MAXVALUE) 파티션은 삭제 금지** — 앱의 월 파티션 자동 추가 로직이 이 파티션에 의존
  - MySQL: `pmax` 제거 후 월 파티션 + `pmax` 재추가
  - Oracle: `pmax` 를 `SPLIT` 하여 월 파티션 생성

## 3. Oracle 전용 사전 점검

Partitioning 은 **EE 전용 유료 옵션**입니다. 납품 전 DBA에게 아래 확인 요청:

```sql
-- 옵션 활성화 여부 (TRUE 여야 함)
SELECT value FROM v$option WHERE parameter = 'Partitioning';

-- 에디션 (Enterprise Edition 이어야 함)
SELECT banner FROM v$version;
```
> `v$option = TRUE` 라도 **라이선스 구매 여부는 별개**(감사 대상)이니 계약상 보유 여부를 서면 확인할 것.

## 4. 세팅 후 검증

앱 기동 → 스케줄러가 만든 파티션 확인:

```sql
-- MySQL
SELECT partition_name, partition_description
FROM   information_schema.partitions
WHERE  table_name = 'ai_usage_log'
ORDER  BY partition_ordinal_position;

-- Oracle
SELECT partition_name, high_value
FROM   user_tab_partitions
WHERE  table_name = 'AI_USAGE_LOG'
ORDER  BY partition_position;
```

스케줄러를 기다리지 않고 즉시 미래 파티션을 만들려면, `PartitionScheduler` 의 cron 을 임시 조정하거나
`ultari.ai.log-table.partition.create-policy` 값(선생성 개월 수)을 늘려 기동하면 됩니다.

---

### 참고: 파티션 대상이 아닌 테이블
`MSG_USER`(메신저 연동 사용자 — 외부 시스템 테이블일 수 있음), `chatbot_admin`(관리자) 은
파티션 대상이 아닙니다. 신규 환경이라면 이 테이블들도 별도 생성이 필요합니다(비파티션 일반 테이블).

| DBMS | 스크립트 |
|------|----------|
| Oracle | [`oracle/base_tables.sql`](oracle/base_tables.sql) |

> `MSG_USER` 는 외부 메신저 시스템이 이미 보유한 경우 생성하지 말 것(스크립트 주석 참조).
> MySQL 용 base_tables 스크립트가 필요하면 요청 주세요.
