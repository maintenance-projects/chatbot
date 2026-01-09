package kr.co.ultari.chatbot.generate.service;

import kr.co.ultari.chatbot.generate.datamodel.dto.RequestDTO;
import kr.co.ultari.chatbot.utils.StringUtilsCustom;
import kr.co.ultari.chatbot.utils.WebUtilsCustom;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class AIRelayService {

    @Value("${ultari.ai-gateway.url:}")
    private String AI_GATE_URL;

    private final AIRelayClientService aiClientService;

    private final Executor aiExecutor;

    public AIRelayService(AIRelayClientService aiClientService, @Qualifier("aiExecutor") Executor aiExecutor) {
        this.aiClientService = aiClientService;
        this.aiExecutor = aiExecutor;
    }

    public String ChatRelayService(RequestDTO requestDTO) {
        JSONObject body = new JSONObject();
        body.put("message",requestDTO.getMessage());
        body.put("attachFile_name","");
        body.put("attachFile_extension","");
        body.put("attachFile_bin","");
        body.put("deepResearch",requestDTO.isDeepResearch());

        CompletableFuture<String> future =
                CompletableFuture.supplyAsync(() -> {
                    try {
                        return WebUtilsCustom.requestMultipart(AI_GATE_URL, requestDTO.getSessionId(), body);
                    } catch (Exception e) {
                        log.error("",e);
                        return "AI 서버 연결에 실패하였습니다... 😥";
                    }
                }, aiExecutor);

        try {
            return future.get(60, TimeUnit.SECONDS);
        } catch (Exception e) {
            log.error("", e);
            return "AI 서버 응답이 지연되고 있습니다. 다시 시도해 주시기 바랍니다... 😥";
        }
    }

    public String DocumentRelayService(String sessionId, MultipartFile file, boolean deep) {
        if(file.isEmpty()) return "요약이 불가능한 파일입니다.";
        String originalFileName = file.getOriginalFilename();
        String fileName = originalFileName.substring(0,originalFileName.lastIndexOf("."));
        String ext = originalFileName.substring(originalFileName.lastIndexOf(".")+1);

        String response = "";

        CompletableFuture<String> future =
                CompletableFuture.supplyAsync(() -> {
                            MultipartBodyBuilder builder = new MultipartBodyBuilder();
                            builder.part("message", "문서를 요약해줘.");
                            builder.part("attachFile_name", fileName);
                            builder.part("attachFile_extension", ext);
                            builder.part("attachFile_bin", file.getResource())
                                    .filename(originalFileName)
                                    .contentType(MediaType.APPLICATION_OCTET_STREAM);
                            builder.part("deepResearch", deep);

                            try {
                                String _response = aiClientService.callAI(AI_GATE_URL, sessionId, builder);
                                JSONObject res = new JSONObject(_response);
                                return StringUtilsCustom.removeThinkTag(res.getJSONArray("choices")
                                        .getJSONObject(0)
                                        .getJSONObject("message")
                                        .getString("content"));
                            } catch (Exception e) {
                                log.error("",e);
                                return "AI 서버 연결에 실패하였습니다... 😥";
                            }

                        }, aiExecutor);

        try {
            return future.get(60, TimeUnit.SECONDS);
        } catch (Exception e) {
            log.error("", e);
            return "AI 서버 응답이 지연되고 있습니다. 다시 시도해 주시기 바랍니다... 😥";
        }

        /*try {
            response = webClient.post()
                    .uri(AI_GATE_URL + "/" + sessionId)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(BodyInserters.fromMultipartData(builder.build()))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            log.info(response);
        } catch (Exception e) {
            log.error("",e);
            return "AI 서버 연결에 실패하였습니다... 😥";
        }
        JSONObject res = new JSONObject(response);

        return StringUtilsCustom.removeThinkTag(res.getJSONArray("choices")
                .getJSONObject(0)
                .getJSONObject("message")
                .getString("content"));*/
    }
}
