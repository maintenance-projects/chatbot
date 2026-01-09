package kr.co.ultari.chatbot.utils;

public class StringUtilsCustom {
    public static String removeThinkTag(String content) {
        if (content == null) {
            return null;
        }
        return content.replaceAll("(?s)<think>.*?</think>", "").trim();
    }
}
