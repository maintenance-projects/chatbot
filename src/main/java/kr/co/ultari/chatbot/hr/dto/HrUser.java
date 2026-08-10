package kr.co.ultari.chatbot.hr.dto;

import lombok.Data;

/**
 * 인사(HR) DB msg_user 조회 결과. 컬럼 매핑은 mapper XML(HrUserMapper.xml)에서 조정.
 */
@Data
public class HrUser {
    private String userId;
    private String userName;
    private String userHigh;   // 상위 조직/부서
    private String password;   // 로그인 검증용(목록 조회 시엔 미조회)
}
