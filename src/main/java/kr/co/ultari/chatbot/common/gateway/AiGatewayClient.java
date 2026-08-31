package kr.co.ultari.chatbot.common.gateway;

import io.netty.channel.ChannelOption;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.netty.http.client.HttpClient;

import java.net.URI;
import java.nio.charset.StandardCharsets;

/**
 * AI 서버(게이트웨이) 호출을 단일 지점에서 담당한다.
 * <p>모든 URL은 {@code baseUrl + "/" + dept + path} 규칙으로 조립된다.
 * <p>JSON 호출은 게이트웨이의 상태코드·본문(0000/4000/... 봉투, 에러 detail 포함)을
 * 그대로 반환하기 위해 {@code exchangeToMono}로 처리한다(비2xx도 예외 없이 통과).
 */
@Slf4j
@Component
public class AiGatewayClient {

    private final WebClient webClient;
    private final AiGatewayProperties props;

    public AiGatewayClient(WebClient.Builder builder, AiGatewayProperties props) {
        this.props = props;
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, props.getConnectTimeoutMs());
        this.webClient = builder
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                // 문서 다운로드/대용량 JSON 응답 대비 in-memory 버퍼 상향(기본 256KB)
                .codecs(c -> c.defaultCodecs().maxInMemorySize(64 * 1024 * 1024))
                .build();
    }

    /**
     * URL 조립. dept가 있으면 {@code baseUrl + "/" + dept + path},
     * dept가 null/빈값이면 {@code baseUrl + path}(파티션 무관 개인 데이터용).
     * path는 선행 슬래시를 포함한다(예: "/message/{id}").
     */
    public String url(String dept, String path) {
        if (dept == null || dept.isBlank()) return props.getBaseUrl() + path;
        return props.getBaseUrl() + "/" + dept + path;
    }

    /** multipart 요청에 대한 SSE(text/event-stream) 스트림을 반환한다. */
    public Flux<String> stream(String dept, String path, MultipartBodyBuilder body) {
        String uri = url(dept, path);
        log.debug("gateway stream POST {}", uri);
        return webClient.post()
                .uri(URI.create(uri))
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .header(HttpHeaders.CACHE_CONTROL, "no-cache")
                .body(BodyInserters.fromMultipartData(body.build()))
                .retrieve()
                .bodyToFlux(String.class);
    }

    /**
     * JSON 본문 요청에 대한 SSE(text/event-stream) 스트림을 반환한다(예: 다중 문서 질문).
     * <p>한글이 깨지지 않도록 본문을 <b>UTF-8 바이트</b>로 전송하고 Content-Type에 charset을 명시한다.
     */
    public Flux<String> streamJson(String dept, String path, String jsonBody) {
        String uri = url(dept, path);
        log.info("gateway stream POST(json) {} body={}", uri, jsonBody);
        byte[] bytes = (jsonBody == null ? "{}" : jsonBody).getBytes(StandardCharsets.UTF_8);
        return webClient.post()
                .uri(URI.create(uri))
                .contentType(new MediaType(MediaType.APPLICATION_JSON, StandardCharsets.UTF_8))
                .accept(MediaType.TEXT_EVENT_STREAM)
                .header(HttpHeaders.CACHE_CONTROL, "no-cache")
                .bodyValue(bytes)
                .retrieve()
                .bodyToFlux(String.class);
    }

    /** multipart POST — 게이트웨이 상태코드·본문을 그대로 전달. */
    public ResponseEntity<String> postMultipart(String dept, String path, MultipartBodyBuilder body) {
        String uri = url(dept, path);
        log.debug("gateway POST {}", uri);
        return webClient.post()
                .uri(URI.create(uri))
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(BodyInserters.fromMultipartData(body.build()))
                .exchangeToMono(resp -> resp.toEntity(String.class))
                .block();
    }

    /** 본문 없는 POST(예: 금칙어 재로드). */
    public ResponseEntity<String> post(String dept, String path) {
        String uri = url(dept, path);
        log.debug("gateway POST(no-body) {}", uri);
        return webClient.post()
                .uri(URI.create(uri))
                .exchangeToMono(resp -> resp.toEntity(String.class))
                .block();
    }

    /** JSON 본문 POST(예: 환경설정 저장). 게이트웨이 상태코드·본문을 그대로 전달. */
    public ResponseEntity<String> postJson(String dept, String path, String jsonBody) {
        String uri = url(dept, path);
        log.debug("gateway POST(json) {}", uri);
        return webClient.post()
                .uri(URI.create(uri))
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(jsonBody == null ? "{}" : jsonBody)
                .exchangeToMono(resp -> resp.toEntity(String.class))
                .block();
    }

    /** GET — 게이트웨이 상태코드·본문을 그대로 전달. */
    public ResponseEntity<String> get(String dept, String path) {
        String uri = url(dept, path);
        log.debug("gateway GET {}", uri);
        return webClient.get()
                .uri(URI.create(uri))
                .exchangeToMono(resp -> resp.toEntity(String.class))
                .block();
    }

    /** DELETE — 게이트웨이 상태코드·본문을 그대로 전달. */
    public ResponseEntity<String> delete(String dept, String path) {
        String uri = url(dept, path);
        log.debug("gateway DELETE {}", uri);
        return webClient.delete()
                .uri(URI.create(uri))
                .exchangeToMono(resp -> resp.toEntity(String.class))
                .block();
    }

    /** PATCH — 게이트웨이 상태코드·본문을 그대로 전달. */
    public ResponseEntity<String> patch(String dept, String path) {
        String uri = url(dept, path);
        log.debug("gateway PATCH {}", uri);
        return webClient.patch()
                .uri(URI.create(uri))
                .exchangeToMono(resp -> resp.toEntity(String.class))
                .block();
    }

    /** 바이너리 파일 다운로드. 응답 헤더(Content-Type/Disposition) 보존을 위해 ResponseEntity를 반환한다. */
    public ResponseEntity<byte[]> download(String dept, String path) {
        String uri = url(dept, path);
        log.debug("gateway GET(binary) {}", uri);
        return webClient.get()
                .uri(URI.create(uri))
                .exchangeToMono(resp -> resp.toEntity(byte[].class))
                .block();
    }
}
