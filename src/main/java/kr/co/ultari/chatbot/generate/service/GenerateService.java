package kr.co.ultari.chatbot.generate.service;

import kr.co.ultari.chatbot.generate.datamodel.dto.RequestDTO;
import kr.co.ultari.chatbot.utils.HttpClient;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class GenerateService {

    String aiUrl = "http://:8000/v1/chat/completions";
    String testUrl = "http://localhost:11434/api/generate";

    @Autowired
    HttpClient httpClient;

    public String request(RequestDTO request) {
        String rtn = "";
        try {
            rtn = httpClient.requestBody(aiUrl, new JSONObject(request));
        } catch (Exception e) {
            log.error("",e);
        }
        return rtn;
    }

    public String requestTest(JSONObject request) throws Exception {
        return httpClient.requestBody(testUrl, request);
    }
}
