package kr.co.ultari.chatbot.database.entity;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;

/** AiCollectionGrant 복합 PK (TARGET_TYPE, TARGET_ID, AI_DEPT, COLLECTION_NAME) */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class AiCollectionGrantId implements Serializable {
    private String targetType;
    private String targetId;
    private String aiDept;
    private String collectionName;
}
