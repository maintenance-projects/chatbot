package kr.co.ultari.chatbot.generate.service;

import kr.co.ultari.chatbot.generate.datamodel.vo.Message;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Slf4j
@Service
public class QwenChatService {

    private static final String QWEN_API_URL = "http://10.0.0.91:11434/v1/chat/completions";
    private static final String MODEL = "qwen2.5:7b";

    public String callQwen(List<Message> messages) throws Exception {

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

        return request(body);
    }

    private String request(JSONObject body) throws Exception {
        URL url = new URL(QWEN_API_URL);
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

        JSONObject res = new JSONObject(sb.toString());
        log.info(res.toString());
        return res.getJSONArray("choices")
                .getJSONObject(0)
                .getJSONObject("message")
                .getString("content");
    }
}
