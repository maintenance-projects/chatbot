package kr.co.ultari.chatbot.generate.service;

import kr.co.ultari.chatbot.generate.datamodel.dto.RequestDTO;
import kr.co.ultari.chatbot.generate.datamodel.vo.Message;
import kr.co.ultari.chatbot.utils.DetectCharsetUtil;
import kr.co.ultari.chatbot.utils.WebUtilsCustom;
import kr.dogfoot.hwplib.object.HWPFile;
import kr.dogfoot.hwplib.reader.HWPReader;
import kr.dogfoot.hwplib.tool.textextractor.TextExtractMethod;
import kr.dogfoot.hwplib.tool.textextractor.TextExtractor;
import kr.dogfoot.hwpxlib.object.HWPXFile;
import kr.dogfoot.hwpxlib.reader.HWPXReader;
import kr.dogfoot.hwpxlib.tool.textextractor.TextMarks;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.*;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.Disposable;

import java.io.*;
import java.nio.charset.Charset;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Service
public class AIChatService {
    private static final long SSE_TIMEOUT_MS = 300_000L;

    @Value("${ultari.ai.url:}")
    private String AI_API_URL;

    @Value("${ultari.ai.model:}")
    private String MODEL;

    @Value("${ultari.ai.temp.path:tmp}")
    String tempPath;

    @Autowired
    AIRelayClientService aiClientService;

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
        body.put("temperature", 0.6);
        //body.put("max_tokens", 1024);
        //body.put("stream", false);

        return WebUtilsCustom.request(AI_API_URL, body);
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
                        "- 이름, 나이, 전화번호, 직급 등의 개인정보는 꼭 기억 해라\n" +
                        "- 결정 사항, 요구사항, 중요한 기술 정보만 요약\n" +
                        "- 인사말, 잡담은 제거\n" +
                        "- 한국어로 작성\n" +
                        "- 불릿 포인트로 간결하게\n" +
                        "- 이후 대화에 필요한 맥락만 유지")
        );

        body.put("messages", arr);
        body.put("temperature", 0.5);

        return WebUtilsCustom.request(AI_API_URL, body);
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

        return WebUtilsCustom.request(AI_API_URL, body);
    }

    public String extractTextFromDocx2(MultipartFile file) throws Exception {
        XWPFDocument doc = null;
        StringBuilder sb = new StringBuilder();

        try {
            doc = new XWPFDocument(file.getInputStream());
            for (IBodyElement element : doc.getBodyElements()) {

                if (element instanceof XWPFParagraph) {
                    XWPFParagraph p = (XWPFParagraph) element;
                    sb.append(p.getText()).append("\n");

                } else if (element instanceof XWPFTable) {
                    XWPFTable table = (XWPFTable) element;

                    sb.append("[표]\n");
                    for (XWPFTableRow row : table.getRows()) {
                        sb.append("| ");
                        for (XWPFTableCell cell : row.getTableCells()) {
                            sb.append(cell.getText().replace("\n", " ")).append(" | ");
                        }
                        sb.append("\n");
                    }
                    sb.append("\n");
                }
            }
        } catch (Exception e) {
            log.error("",e);
        } finally {
            if(doc != null) doc.close();
        }

        log.debug(sb.toString());
        return sb.toString();
    }

    public String extractTextFromDocx(MultipartFile file) throws Exception {
        try (XWPFDocument document =
                     new XWPFDocument(file.getInputStream())) {

            StringBuilder sb = new StringBuilder();

            for (XWPFParagraph p : document.getParagraphs()) {
                sb.append(p.getText()).append("\n");
            }

            log.debug(sb.toString());
            return sb.toString();
        }
    }

    public String extractTextFromHwp(MultipartFile file) throws Exception {
        String text = "";
        File f = new File(Paths.get(tempPath+File.separator+file.getOriginalFilename()).toString());
        file.transferTo(f);
        log.debug(f.getPath());
        if(f.exists()) {
            HWPFile hwpFile = HWPReader.fromFile(tempPath + File.separator + file.getOriginalFilename());
            text = TextExtractor.extract(hwpFile, TextExtractMethod.InsertControlTextBetweenParagraphText);
            f.delete();
        }
        log.debug(text);
        return text;
    }

    public String extractTextFromHwpx(MultipartFile file) throws Exception {
        String text = "";
        File f = new File(Paths.get(tempPath+File.separator+file.getOriginalFilename()).toString());
        file.transferTo(f);
        if(f.exists()) {
            HWPXFile hwpxFile = HWPXReader.fromFilepath(tempPath + File.separator + file.getOriginalFilename());
            text = kr.dogfoot.hwpxlib.tool.textextractor.TextExtractor.extract(hwpxFile, kr.dogfoot.hwpxlib.tool.textextractor.TextExtractMethod.InsertControlTextBetweenParagraphText,true,new TextMarks());
            f.delete();
        }
        log.debug(text);
        return text;
    }

    public String extractTextFromPdf(MultipartFile file) throws IOException {
        File f = new File(Paths.get(tempPath+File.separator+UUID.randomUUID()).toString());
        file.transferTo(f);

        String text = "";
        PDDocument document = null;

        try {
            document = PDDocument.load(f);
            PDFTextStripper stripper = new PDFTextStripper();
            text = stripper.getText(document);
        } finally {
            if (document != null) {
                document.close();
            }

            boolean beDelete = f.delete();
            log.trace("tmp pdf file deleted = {}",beDelete);
        }
        log.debug(text);
        return text;
    }

    public String extractTextFromTxt(MultipartFile file) throws IOException {
        Charset charset = DetectCharsetUtil.detectCharset(file);

        log.debug(charset.displayName());
        StringBuilder sb = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), charset))) {

            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append("\n");
            }
        }
        log.debug(sb.toString());
        return sb.toString();
    }

    public SseEmitter ChatRelayServiceStream(RequestDTO requestDTO) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);

        final AtomicBoolean closed = new AtomicBoolean(false);
        final AtomicBoolean doneSent = new AtomicBoolean(false);
        final Disposable[] sub = new Disposable[1];

        Runnable stopUpstream = () -> {
            if (sub[0] != null && !sub[0].isDisposed()) {
                sub[0].dispose();
            }
        };

        emitter.onCompletion(() -> {
            closed.set(true);
            stopUpstream.run();
        });
        emitter.onTimeout(() -> {
            closed.set(true);
            stopUpstream.run();
        });
        emitter.onError(e -> {
            closed.set(true);
            stopUpstream.run();
        });

        trySend(emitter, closed, "start", "");

        sub[0] = aiClientService
                .callOllamaGenerateStream(AI_API_URL, requestDTO.getMessage())
                .subscribe(
                        line -> {
                            if (closed.get()) return;

                            try {
                                JSONObject obj = new JSONObject(line);

                                // 1️⃣ 토큰(delta) 처리
                                String delta = obj.optString("response", "");
                                if (!delta.isEmpty()) {
                                    if (!trySend(emitter, closed, "delta", delta)) {
                                        stopUpstream.run();
                                        return;
                                    }
                                }

                                // 2️⃣ Ollama done 처리 (여기서만!)
                                if (obj.optBoolean("done", false)) {
                                    if (doneSent.compareAndSet(false, true)) {
                                        trySend(emitter, closed, "done", "");
                                        closed.set(true);
                                        emitter.complete();
                                        stopUpstream.run();
                                    }
                                }
                            } catch (Exception parseErr) {
                                // JSON 파싱 실패 → 그냥 문자열로 흘림
                                if (!trySend(emitter, closed, "delta", line)) {
                                    stopUpstream.run();
                                }
                            }
                        },
                        err -> {
                            if (closed.get()) return;

                            closed.set(true);
                            trySend(emitter, closed, "error",
                                    err.getMessage() != null ? err.getMessage() : "AI 스트림 오류");
                            emitter.complete();
                            stopUpstream.run();
                        },
                        () -> {
                            // 3️⃣ Flux onComplete (done을 아직 안 보냈을 때만)
                            if (closed.get()) return;

                            if (doneSent.compareAndSet(false, true)) {
                                trySend(emitter, closed, "done", "");
                                closed.set(true);
                                emitter.complete();
                            }
                            stopUpstream.run();
                        }
                );

        return emitter;
    }

    private boolean trySend(SseEmitter emitter, AtomicBoolean closed, String event, String data) {
        if (closed.get()) return false;
        try {
            emitter.send(SseEmitter.event().name(event).data(data));
            return true;
        } catch (IllegalStateException | IOException e) {
            // ✅ 이미 complete 됐거나 클라가 끊김
            closed.set(true);
            return false;
        }
    }
}
