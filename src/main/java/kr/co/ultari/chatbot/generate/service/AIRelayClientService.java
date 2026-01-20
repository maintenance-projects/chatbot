package kr.co.ultari.chatbot.generate.service;

import io.netty.channel.ChannelOption;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.netty.http.client.HttpClient;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
public class AIRelayClientService {

    private final WebClient webClient;

    public AIRelayClientService(WebClient.Builder webClientBuilder) {
        HttpClient httpClient = HttpClient.create()
                .tcpConfiguration(client ->
                        client.option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 3000)
                );
        this.webClient = webClientBuilder.clientConnector(new ReactorClientHttpConnector(httpClient)).build();
    }

    public String callAI(String requestUrl, String sessionId, MultipartBodyBuilder builder) {

        String response = webClient.post()
                .uri(requestUrl + "/" + sessionId)
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(BodyInserters.fromMultipartData(builder.build()))
                .retrieve()
                .bodyToMono(String.class)
                .block(); // 여기서만 block 허용

        if(log.isDebugEnabled())
            log.debug(response);

        return response;
    }

    public String callAI(String requestUrl, MultipartBodyBuilder builder) {

        String response = webClient.post()
                .uri(requestUrl)
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(BodyInserters.fromMultipartData(builder.build()))
                .retrieve()
                .bodyToMono(String.class)
                .block(); // 여기서만 block 허용

        if(log.isDebugEnabled())
            log.debug(response);

        return response;
    }

    /** AI Gateway가 text/event-stream(SSE)로 내려주는 응답을 Flux로 받는다 */
    public Flux<String> callAIStream(String requestUrl, String sessionId, MultipartBodyBuilder builder) {

        return webClient.post()
                .uri(requestUrl + "/" + sessionId)
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .accept(MediaType.TEXT_EVENT_STREAM) // 핵심
                .header(HttpHeaders.CACHE_CONTROL, "no-cache")
                .body(BodyInserters.fromMultipartData(builder.build()))
                .retrieve()
                .bodyToFlux(String.class);
    }

    public Flux<String> callAIStream(String requestUrl, MultipartBodyBuilder builder) {

        return webClient.post()
                .uri(requestUrl)
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .accept(MediaType.TEXT_EVENT_STREAM) // 핵심
                .header(HttpHeaders.CACHE_CONTROL, "no-cache")
                .body(BodyInserters.fromMultipartData(builder.build()))
                .retrieve()
                .bodyToFlux(String.class);
    }

    public Flux<String> callOllamaGenerateStream(String requestUrl, String prompt) {

        Map<String, Object> body = new HashMap<>();
        body.put("model", "qwen2.5:7b");
        body.put("prompt", prompt);
        body.put("stream", true);

        MediaType ndjson = MediaType.valueOf("application/x-ndjson");

        return webClient.post()
                .uri(requestUrl)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(ndjson, MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .retrieve()
                .bodyToFlux(String.class);
    }
}
