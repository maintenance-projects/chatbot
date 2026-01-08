package kr.co.ultari.chatbot.generate.service;

import kr.co.ultari.chatbot.generate.datamodel.dto.RequestDTO;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@Slf4j
@Service
public class AIRelayService {

    @Value("${ultari.ai-gateway.url:}")
    private String AI_GATE_URL;

    private final WebClient webClient;

    public AIRelayService(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.build();
    }

    public String ChatRelayService(RequestDTO requestDTO) throws Exception {
        JSONObject body = new JSONObject();
        body.put("message",requestDTO.getMessage());
        body.put("attachFile",false);
        body.put("deepResearch",requestDTO.isDeepResearch());

        return request(body);
    }

    public String DocumentRelayService(MultipartFile file, boolean deep) throws Exception {
        if(file.isEmpty()) return "요약이 불가능한 파일입니다.";
        String originalFileName = file.getOriginalFilename();
        String fileName = originalFileName.substring(0,originalFileName.lastIndexOf("."));
        String ext = originalFileName.substring(originalFileName.lastIndexOf(".")+1);

        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        builder.part("message", "문서를 요약해줘");
        builder.part("attachFile",true);
        builder.part("attachFile_name",fileName);
        builder.part("attachFile_extension",ext);
        builder.part("attachFile_bin", file.getResource())
                .filename(originalFileName)
                .contentType(MediaType.APPLICATION_OCTET_STREAM);
        builder.part("deepResearch",deep);

        String response = webClient.post()
                .uri(AI_GATE_URL+"/"+ UUID.randomUUID())
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(BodyInserters.fromMultipartData(builder.build()))
                .retrieve()
                .bodyToMono(String.class)
                .block();

        log.info(response);
        JSONObject res = new JSONObject(response);

        return removeThinkTag(res.getJSONArray("choices")
                .getJSONObject(0)
                .getJSONObject("message")
                .getString("content"));
    }

    private String request(JSONObject body) throws Exception {
        URL url = new URL(AI_GATE_URL+"/"+ UUID.randomUUID());
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
        return removeThinkTag(res.getJSONArray("choices")
                .getJSONObject(0)
                .getJSONObject("message")
                .getString("content"));
    }

    public String removeThinkTag(String content) {
        if (content == null) {
            return null;
        }
        return content.replaceAll("(?s)<think>.*?</think>", "").trim();
    }
}
