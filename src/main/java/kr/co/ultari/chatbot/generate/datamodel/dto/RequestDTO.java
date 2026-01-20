package kr.co.ultari.chatbot.generate.datamodel.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class RequestDTO {
    private String sessionId;
    private String message;

    @Builder.Default
    private boolean deepResearch = false;
}
