package kr.co.ultari.chatbot.hr.dto;

import lombok.Data;

/**
 * 인사(HR) DB msg_part 조회 결과(조직도 노드). 컬럼 매핑은 HrPartMapper.xml에서 조정.
 */
@Data
public class HrPart {
    private String partId;     // PART_ID
    private String partHigh;   // PART_HIGH (부모 부서)
    private String partName;   // PART_NAME
    private String partOrder;  // PART_ORDER
}
