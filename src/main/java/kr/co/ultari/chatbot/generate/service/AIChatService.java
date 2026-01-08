package kr.co.ultari.chatbot.generate.service;

import kr.co.ultari.chatbot.generate.datamodel.vo.Message;
import kr.co.ultari.chatbot.utils.DetectCharsetUtil;
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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
public class AIChatService {

    @Value("${ultari.ai.url:}")
    private String AI_API_URL;

    @Value("${ultari.ai.model:}")
    private String MODEL;

    @Value("${ultari.ai.temp.path:tmp}")
    String tempPath;

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

        return request(body);
    }

    private String request(JSONObject body) throws Exception {
        URL url = new URL(AI_API_URL);
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

        JSONObject res = new JSONObject(removeThinkTag(sb.toString()));
        log.debug(res.toString());
        return res.getJSONArray("choices")
                .getJSONObject(0)
                .getJSONObject("message")
                .getString("content");
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

        return request(body);
    }

    //think 태그 제거.
    public String removeThinkTag(String content) {
        if (content == null) {
            return null;
        }
        return content.replaceAll("(?s)<think>.*?</think>", "").trim();
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

        return request(body);
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
}
