package kr.co.ultari.chatbot.generate.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * 메신저 첨부파일 사전 등록 전용 잔존 서비스.
 * (GenerateController /chatbot/file/upload — 외부 메신저 연동)
 * 신규 재구성 경로(챗봇/파일검색/PKB 등)는 각 도메인 서비스로 이전됨.
 */
@Slf4j
@Service
public class AIRelayService {

    @Value("${ultari.ai-gateway.upload-url:}")
    private String AI_UPLOAD_URL;

    @Autowired
    CachedService cachedService;

    private final AIRelayClientService aiClientService;

    public AIRelayService(AIRelayClientService aiClientService) {
        this.aiClientService = aiClientService;
    }

    /**
     * 메신저 첨부파일을 AI 게이트웨이에 사전 등록한다. 추론(요약/답변) 없이 파일만 업로드.
     *
     * @return AI 게이트웨이 응답 본문(JSON 문자열), 실패 시 null
     */
    public String uploadFile(String sessionId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return null;
        }

        String originalFileName = file.getOriginalFilename();

        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        builder.part("attachFile_name", originalFileName);
        builder.part("attachFile_bin", file.getResource())
                .filename(originalFileName)
                .contentType(MediaType.APPLICATION_OCTET_STREAM);

        String response = aiClientService.callAI(AI_UPLOAD_URL, sessionId, builder);

        // 파일 목록 캐시 무효화 (새 파일이 등록되었으므로)
        cachedService.FilesCacheClear(sessionId);

        return response;
    }
}
