package kr.co.ultari.chatbot.hr.mapper;

import kr.co.ultari.chatbot.hr.dto.HrUser;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 인사(HR) DB msg_user 조회 매퍼. SQL은 classpath:mapper/hr/HrUserMapper.xml.
 * hrDataSource(조회 전용) 바인딩(MyBatisConfig).
 */
public interface HrUserMapper {

    /** 로그인/상세용 — password 포함 */
    HrUser selectById(@Param("userId") String userId);

    /** 관리자 목록용 — password 제외 */
    List<HrUser> selectAll();

    /** 관리자 검색용 (field: userId/userName/userHigh) */
    List<HrUser> search(@Param("field") String field, @Param("keyword") String keyword);

    /** 사용자의 소속 부서(PART_ID) 목록 — 겸직 시 여러 개. 권한 상속 계산용 */
    List<String> selectPartIdsByUser(@Param("userId") String userId);

    /**
     * 인메모리 디렉터리 스냅샷용 — 전체 사용자(비번·부서 포함) 1회 벌크 조회.
     * 요청마다 원격 HR을 치지 않도록 주기 배치가 이걸로 전량을 메모리에 적재한다.
     * 겸직/소스중복 시 한 userId가 여러 행(부서 다름)일 수 있다(호출측에서 그룹핑).
     */
    List<HrUser> selectAllWithAuth();
}
