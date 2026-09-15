package kr.co.ultari.chatbot.database.repository;

import kr.co.ultari.chatbot.database.entity.AiCollectionGrant;
import kr.co.ultari.chatbot.database.entity.AiCollectionGrantId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface AiCollectionGrantRepository extends JpaRepository<AiCollectionGrant, AiCollectionGrantId> {

    /** 특정 dept+콜렉션의 모든 부여(관리자 트리 렌더용) */
    List<AiCollectionGrant> findByAiDeptAndCollectionName(String aiDept, String collectionName);

    /** 특정 대상의 특정 dept+콜렉션 부여(있으면 — applyGrant 정리용) */
    List<AiCollectionGrant> findByTargetTypeAndTargetIdAndAiDeptAndCollectionName(
            String targetType, String targetId, String aiDept, String collectionName);

    /** 콜렉션 삭제 시 관련 권한 정리용 */
    List<AiCollectionGrant> findByAiDeptAndCollectionNameIn(String aiDept, Collection<String> collectionNames);

    /** 여러 조직 대상 + 모드로 조회(조직 상속 계산용 — 2차 질의 해석) */
    List<AiCollectionGrant> findByTargetTypeAndTargetIdInAndModeAndAiDept(
            String targetType, Collection<String> targetIds, String mode, String aiDept);

    /** 특정 사용자 대상의 dept 부여 전체(2차 질의 해석) */
    List<AiCollectionGrant> findByTargetTypeAndTargetIdAndAiDept(String targetType, String targetId, String aiDept);
}
