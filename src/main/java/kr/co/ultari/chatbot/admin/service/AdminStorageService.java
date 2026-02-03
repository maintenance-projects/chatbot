package kr.co.ultari.chatbot.admin.service;

import lombok.extern.slf4j.Slf4j;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.UUID;

@Slf4j
@Service
public class AdminStorageService {
    public JSONArray getCommonFileList(String adminId, int size, int page) {
        JSONArray arr = new JSONArray();

        for(int i = page * size; i < (page * size) + size; i++) {
            JSONObject json = new JSONObject();
            json.put("index",i);
            json.put("key", UUID.randomUUID());
            json.put("fileName", "파일"+i);
            json.put("length","1234");
            json.put("registDate", LocalDate.now());
            arr.put(json);
        }

        return arr;
    }

    public String setCommonFileDelete(String adminId, String key) {
        String rtn = "ok";

        return rtn;
    }

    public String setCommonFileAdd(String adminId, MultipartFile file) {
        String rtn = "ok";

        return rtn;
    }
}
