package kr.co.ultari.chatbot.hr.mapper;

import kr.co.ultari.chatbot.hr.dto.HrPart;

import java.util.List;

/**
 * 인사(HR) DB msg_part 조회 매퍼(조직도 트리). SQL은 classpath:mapper/hr/HrPartMapper.xml.
 */
public interface HrPartMapper {

    /** 전체 부서(조직) — PART_HIGH로 트리 구성 */
    List<HrPart> selectAll();
}
