package kr.co.ultari.chatbot.database.repository;

import kr.co.ultari.chatbot.database.entity.AiPartitionGrant;
import kr.co.ultari.chatbot.database.entity.AiPartitionGrantId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface AiPartitionGrantRepository extends JpaRepository<AiPartitionGrant, AiPartitionGrantId> {

    /** 특정 벡터DB+파티션의 모든 부여(관리자 트리 렌더용) */
    List<AiPartitionGrant> findByAiDeptAndPartitionName(String aiDept, String partitionName);

    /** 특정 대상의 특정 벡터DB+파티션 부여(있으면 — applyGrant 정리용) */
    List<AiPartitionGrant> findByTargetTypeAndTargetIdAndAiDeptAndPartitionName(
            String targetType, String targetId, String aiDept, String partitionName);

    /** 파티션 삭제 시 관련 권한 정리용 */
    List<AiPartitionGrant> findByAiDeptAndPartitionNameIn(String aiDept, Collection<String> partitionNames);

    /** 여러 조직 대상 + 모드로 조회(조직 상속 계산용 — 2차 질의 해석) */
    List<AiPartitionGrant> findByTargetTypeAndTargetIdInAndModeAndAiDept(
            String targetType, Collection<String> targetIds, String mode, String aiDept);

    /** 특정 사용자 대상의 벡터DB 부여 전체(2차 질의 해석) */
    List<AiPartitionGrant> findByTargetTypeAndTargetIdAndAiDept(String targetType, String targetId, String aiDept);
}
