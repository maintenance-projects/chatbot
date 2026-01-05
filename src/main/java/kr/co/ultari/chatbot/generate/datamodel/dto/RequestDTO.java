package kr.co.ultari.chatbot.generate.datamodel.dto;

import kr.co.ultari.chatbot.generate.datamodel.vo.Message;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
public class RequestDTO {
    private String model;
    private List<Message> messages;
    private float temperature;
    private Integer max_tokens;
    private boolean stream;
}
