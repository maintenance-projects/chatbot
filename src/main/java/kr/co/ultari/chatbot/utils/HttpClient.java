package kr.co.ultari.chatbot.utils;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.stereotype.Service;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@Slf4j
@Service
public class HttpClient {
    private static HttpClient instance;

    private final String USER_AGENT = "Mozilla/5.0";

    public static HttpClient getInstance() {
        if (instance == null) {
            instance = new HttpClient();
        }
        return instance;
    }

    public String requestBody(String _url, JSONObject json) throws Exception {
        URL url = new URL(_url);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setDoOutput(true);
        conn.setRequestProperty("User-Agent", USER_AGENT);
        conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        conn.setConnectTimeout(5000);

        try (BufferedWriter bw = new BufferedWriter(new OutputStreamWriter(conn.getOutputStream(), StandardCharsets.UTF_8))) {
            bw.write(json.toString());
            bw.flush();
        }

        BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
        String line;
        StringBuilder sb = new StringBuilder();
        while ((line = in.readLine()) != null) {
            sb.append(line);
        }
        in.close();

        return sb.toString();
    }

    public String requestParam(String _url, JSONObject json) throws Exception {
        StringBuilder postData = new StringBuilder();
        Map<String, Object> map = jsonToMap(json.toString());
        for(Map.Entry<String, Object> params: map.entrySet()) {
            if(postData.length()!=0) postData.append("&");
            postData.append(params.getKey());
            postData.append("=");
            postData.append(URLEncoder.encode(params.getValue().toString(),"UTF-8"));
        }

        log.debug(postData.toString());

        URL url = new URL(_url+"?"+postData.toString());
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setDoOutput(true);
        conn.setRequestProperty("User-Agent", USER_AGENT);
        conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
        conn.setRequestProperty("Content-Length",String.valueOf(postData.length()));

        try (OutputStream os = conn.getOutputStream()) {
            os.write(postData.toString().getBytes("UTF-8"));
        }

        BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
        String line;
        StringBuilder sb = new StringBuilder();
        while ((line = in.readLine()) != null) {
            sb.append(line);
        }
        in.close();

        return sb.toString();
    }

    public Map<String, Object> jsonToMap(String json) throws Exception
    {
        ObjectMapper objectMapper = new ObjectMapper();
        TypeReference<Map<String, Object>> typeReference = new TypeReference<Map<String,Object>>() {};

        return objectMapper.readValue(json, typeReference);
    }
}
