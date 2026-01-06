package kr.co.ultari.chatbot.generate.service;

import kr.co.ultari.chatbot.generate.datamodel.vo.Message;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Slf4j
@Service
public class AIChatService {

    private static final String AI_API_URL = "http://10.0.0.91:11434/v1/chat/completions";
    //private static final String AI_API_URL = "https://pok-chromospheric-rumblingly.ngrok-free.dev/v1/chat/completions";
    private static final String MODEL = "qwen2.5:7b";
    //private static final String MODEL = "QuantTrio/Qwen3-30B-A3B-Thinking-2507-AWQ";

    public String callAi(List<Message> messages) throws Exception {

        JSONObject body = new JSONObject();
        body.put("model", MODEL);

        JSONArray msgArray = new JSONArray();
        for (Message msg : messages) {
            JSONObject o = new JSONObject();
            o.put("role", msg.getRole());
            o.put("content", msg.getContent());
            msgArray.put(o);
        }

        body.put("messages", msgArray);
        body.put("temperature", 0.7);
        //body.put("max_tokens", 1024);
        //body.put("stream", false);

        return request(body);
    }

    private String request(JSONObject body) throws Exception {
        URL url = new URL(AI_API_URL);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();

        conn.setRequestMethod("POST");
        conn.setDoOutput(true);
        conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");

        try (BufferedWriter bw = new BufferedWriter(
                new OutputStreamWriter(conn.getOutputStream(), StandardCharsets.UTF_8))) {
            bw.write(body.toString());
        }

        InputStream is = conn.getInputStream();
        BufferedReader br = new BufferedReader(
                new InputStreamReader(is, StandardCharsets.UTF_8));

        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) {
            sb.append(line);
        }

        JSONObject res = new JSONObject(removeThinkTag(sb.toString()));
        log.info(res.toString());
        return res.getJSONArray("choices")
                .getJSONObject(0)
                .getJSONObject("message")
                .getString("content");
    }

    public String summarize(List<Message> messages) throws Exception {

        JSONObject body = new JSONObject();
        body.put("model", MODEL);

        JSONArray arr = new JSONArray();
        for (Message m : messages) {
            arr.put(new JSONObject()
                    .put("role", m.getRole())
                    .put("content", m.getContent()));
        }

        arr.put(new JSONObject()
                .put("role","system")
                .put("content","다음은 사용자와 AI의 이전 대화이다.\n" +
                        "아래 규칙에 따라 요약하라.\n" +
                        "- 결정 사항, 요구사항, 중요한 기술 정보만 요약\n" +
                        "- 인사말, 잡담은 제거\n" +
                        "- 한국어로 작성\n" +
                        "- 불릿 포인트로 간결하게\n" +
                        "- 이후 대화에 필요한 맥락만 유지")
        );

        body.put("messages", arr);
        body.put("temperature", 0.3);

        return request(body);
    }

    //think 태그 제거.
    public String removeThinkTag(String content) {
        if (content == null) {
            return null;
        }
        return content.replaceAll("(?s)<think>.*?</think>", "").trim();
    }

    public String extractTextFromWord(MultipartFile file) throws Exception {
        try (XWPFDocument document =
                     new XWPFDocument(file.getInputStream())) {

            StringBuilder sb = new StringBuilder();

            for (XWPFParagraph p : document.getParagraphs()) {
                sb.append(p.getText()).append("\n");
            }

            return sb.toString();
        }
    }

    public String summarizeRequest(String text) throws Exception {
        JSONObject body = new JSONObject();
        body.put("model", MODEL);

        JSONArray messages = new JSONArray();

        messages.put(new JSONObject()
                .put("role", "system")
                .put("content", "다음 문서를 핵심 위주로 요약해라.")
        );

        messages.put(new JSONObject()
                .put("role", "user")
                .put("content", text)
        );

        body.put("messages", messages);
        body.put("temperature", 0.3);

        return request(body);
    }
}
