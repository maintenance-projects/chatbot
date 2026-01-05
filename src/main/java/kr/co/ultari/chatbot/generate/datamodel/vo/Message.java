package kr.co.ultari.chatbot.generate.datamodel.vo;

import lombok.AllArgsConstructor;
import lombok.ToString;

@ToString
@AllArgsConstructor
public class Message {
    private String role;
    private String content;
}
