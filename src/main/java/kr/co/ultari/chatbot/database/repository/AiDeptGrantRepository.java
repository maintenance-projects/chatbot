package kr.co.ultari.chatbot.database.repository;

import kr.co.ultari.chatbot.database.entity.AiDeptGrant;
import kr.co.ultari.chatbot.database.entity.AiDeptGrantId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface AiDeptGrantRepository extends JpaRepository<AiDeptGrant, AiDeptGrantId> {

    /** 특정 대상(조직/사용자)의 모든 부여 */
    List<AiDeptGrant> findByTargetTypeAndTargetId(String targetType, String targetId);

    /** 여러 대상 + 모드로 조회(조직 상속 계산용) */
    List<AiDeptGrant> findByTargetTypeAndTargetIdInAndMode(String targetType, Collection<String> targetIds, String mode);

    /** 특정 dept의 모든 부여(관리자 트리 렌더용) */
    List<AiDeptGrant> findByAiDept(String aiDept);

    /** 특정 대상의 특정 dept 부여(있으면) */
    List<AiDeptGrant> findByTargetTypeAndTargetIdAndAiDept(String targetType, String targetId, String aiDept);

    /** 대상 유형+모드 전체(목록 렌더용) */
    List<AiDeptGrant> findByTargetTypeAndMode(String targetType, String mode);

    /** 특정 dept + 모드의 부여 전체(관리자 트리 렌더용) */
    List<AiDeptGrant> findByAiDeptAndMode(String aiDept, String mode);
}
