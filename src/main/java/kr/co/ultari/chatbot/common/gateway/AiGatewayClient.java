package kr.co.ultari.chatbot.common.gateway;

import io.netty.channel.ChannelOption;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.netty.http.client.HttpClient;

/**
 * AI 서버(게이트웨이) 호출을 단일 지점에서 담당한다.
 * <p>모든 URL은 {@code baseUrl + "/" + dept + path} 규칙으로 조립되며,
 * SSE 스트리밍/단건 JSON(GET·POST·DELETE·PATCH)을 지원한다.
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
                .build();
    }

    /** {@code baseUrl + "/" + dept + path} 조립. path는 선행 슬래시를 포함한다(예: "/message/{id}"). */
    public String url(String dept, String path) {
        return props.getBaseUrl() + "/" + dept + path;
    }

    /** multipart 요청에 대한 SSE(text/event-stream) 스트림을 반환한다. */
    public Flux<String> stream(String dept, String path, MultipartBodyBuilder body) {
        String uri = url(dept, path);
        log.debug("gateway stream POST {}", uri);
        return webClient.post()
                .uri(uri)
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .header(HttpHeaders.CACHE_CONTROL, "no-cache")
                .body(BodyInserters.fromMultipartData(body.build()))
                .retrieve()
                .bodyToFlux(String.class);
    }

    /** multipart POST 후 단건 JSON 문자열을 반환한다(블로킹). */
    public String postMultipart(String dept, String path, MultipartBodyBuilder body) {
        String uri = url(dept, path);
        log.debug("gateway POST {}", uri);
        return webClient.post()
                .uri(uri)
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(BodyInserters.fromMultipartData(body.build()))
                .retrieve()
                .bodyToMono(String.class)
                .block();
    }

    /** 본문 없는 POST 단건 JSON 문자열(블로킹). 예: 금칙어 재로드 */
    public String post(String dept, String path) {
        String uri = url(dept, path);
        log.debug("gateway POST(no-body) {}", uri);
        return webClient.post()
                .uri(uri)
                .retrieve()
                .bodyToMono(String.class)
                .block();
    }

    /** GET 단건 JSON 문자열(블로킹). */
    public String get(String dept, String path) {
        String uri = url(dept, path);
        log.debug("gateway GET {}", uri);
        return webClient.get()
                .uri(uri)
                .retrieve()
                .bodyToMono(String.class)
                .block();
    }

    /** DELETE 단건 JSON 문자열(블로킹). */
    public String delete(String dept, String path) {
        String uri = url(dept, path);
        log.debug("gateway DELETE {}", uri);
        return webClient.delete()
                .uri(uri)
                .retrieve()
                .bodyToMono(String.class)
                .block();
    }

    /** PATCH 단건 JSON 문자열(블로킹). */
    public String patch(String dept, String path) {
        String uri = url(dept, path);
        log.debug("gateway PATCH {}", uri);
        return webClient.patch()
                .uri(uri)
                .retrieve()
                .bodyToMono(String.class)
                .block();
    }
}
