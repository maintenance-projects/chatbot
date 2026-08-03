package kr.co.ultari.chatbot.utils;

import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

@Slf4j
public class WebUtilsCustom {
    public static String request(String requestUrl, JSONObject body) throws Exception {
        URL url = new URL(requestUrl+"/"+ UUID.randomUUID());
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
        log.debug(res.toString());
        return StringUtilsCustom.removeThinkTag(res.getJSONArray("choices")
                .getJSONObject(0)
                .getJSONObject("message")
                .getString("content"));
    }

    public static String requestMultipart(String requestUrl, String sessionId, JSONObject body) throws Exception {

        String boundary = "----Boundary" + sessionId;
        String lineEnd = "\r\n";
        String prefix = "--";

        URL url = new URL(requestUrl + "/" + sessionId);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();

        conn.setRequestMethod("POST");
        conn.setDoOutput(true);
        conn.setUseCaches(false);
        conn.setRequestProperty(
                "Content-Type",
                "multipart/form-data; boundary=" + boundary
        );
        conn.setConnectTimeout(3000);

        try (OutputStream os = conn.getOutputStream();
             BufferedWriter writer =
                     new BufferedWriter(new OutputStreamWriter(os, StandardCharsets.UTF_8))) {

            // JSON → Map → multipart parameter
            Map<String, Object> map = jsonToMap(body.toString());

            for (Map.Entry<String, Object> entry : map.entrySet()) {
                writer.write(prefix + boundary);
                writer.write(lineEnd);
                writer.write(
                        "Content-Disposition: form-data; name=\"" +
                                entry.getKey() + "\""
                );
                writer.write(lineEnd);
                writer.write(lineEnd);
                writer.write(entry.getValue().toString());
                writer.write(lineEnd);
            }

            // multipart 종료
            writer.write(prefix + boundary + prefix);
            writer.write(lineEnd);
            writer.flush();
        } catch(Exception e) {
            log.error("",e);
            return "AI 서버 연결에 실패하였습니다... 😥";
        }

        InputStream is = conn.getInputStream();
        BufferedReader br =
                new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));

        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) {
            sb.append(line);
        }

        JSONObject res = new JSONObject(sb.toString());
        if(log.isDebugEnabled())
            log.debug(res.toString());

        return StringUtilsCustom.removeThinkTag(
                res.getJSONArray("choices")
                        .getJSONObject(0)
                        .getJSONObject("message")
                        .getString("content")
        );
    }

    public static String requestGet(String requestUrl, String sessionId) throws Exception {
        URL url = new URL(requestUrl+"/"+ sessionId);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();

        conn.setRequestMethod("GET");
        conn.setDoOutput(true);
        conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");

        InputStream is = conn.getInputStream();
        BufferedReader br = new BufferedReader(
                new InputStreamReader(is, StandardCharsets.UTF_8));

        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) {
            sb.append(line);
        }

        return sb.toString();
    }

    public static Map<String, Object> jsonToMap(String json)
    {
        // org.json 사용(프로젝트 표준 JSON 라이브러리). Jackson 3(tools.jackson) 의존 제거.
        return new JSONObject(json).toMap();
    }
}
