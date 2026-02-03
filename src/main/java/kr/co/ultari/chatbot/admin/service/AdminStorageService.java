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
            json.put("index", i);
            json.put("key", UUID.randomUUID());
            json.put("fileName", "파일"+i);
            String name = "김현준";
            boolean isUse = true;
            if(i%2==0) {
                name = "김나영";
                isUse = false;
            }
            json.put("adminName", name);
            json.put("isUse", isUse);
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

    public JSONArray getCommonFileSearch(String adminId, String type, String context, int size, int page) {
        JSONArray arr = new JSONArray();

        for(int i = page * size; i < (page * size) + size; i++) {
            JSONObject json = new JSONObject();
            json.put("index",i);
            json.put("key", UUID.randomUUID());
            json.put("fileName", context+"파일"+i);
            String name = "김현준";
            boolean isUse = true;
            if(i%2==0) {
                name = "김나영";
                isUse = false;
            }
            json.put("adminName", name);
            json.put("isUse", isUse);
            json.put("length","1234");
            json.put("registDate", LocalDate.now());
            arr.put(json);
        }


        return arr;
    }

    public JSONArray getCountList(String adminId) {
        JSONArray arr = new JSONArray();

        JSONObject totalCount = new JSONObject();
        totalCount.put("countName","totalCount");
        totalCount.put("count",100);

        JSONObject useCount = new JSONObject();
        useCount.put("countName","useCount");
        useCount.put("count",90);

        JSONObject todayCount = new JSONObject();
        todayCount.put("countName","todayCount");
        todayCount.put("count",5);

        JSONObject unUseCount = new JSONObject();
        unUseCount.put("countName","unUseCount");
        unUseCount.put("count",10);

        return arr;
    }

    public String setCommonFileUsage(String adminId, String key, boolean isUse) {
        String rtn = "ok";

        return rtn;
    }
}
