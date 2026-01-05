package kr.co.ultari.chatbot.generate.datamodel.vo;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.ToString;

@ToString
@AllArgsConstructor
@Getter
public class Message {
    private String role;
    private String content;
}
