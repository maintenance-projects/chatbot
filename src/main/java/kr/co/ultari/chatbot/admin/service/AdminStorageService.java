package kr.co.ultari.chatbot.admin.service;

import kr.co.ultari.chatbot.database.entity.MsgAdmin;
import kr.co.ultari.chatbot.database.repository.MsgAdminRepository;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.util.MultiValueMap;
import org.springframework.util.ObjectUtils;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;

@Slf4j
@Service
public class AdminStorageService {

    @Value("${ultari.ai-gateway.common-doc-list:http://10.0.0.111:8000/admin/get_documents}")
    String AI_COMMON_DOC_LIST_URL;

    @Value("${ultari.ai-gateway.common-doc-add:http://10.0.0.111:8000/admin/add_documents}")
    String AI_COMMON_DOC_ADD_URL;

    @Value("${ultari.ai-gateway.common-doc-add:http://10.0.0.111:8000/admin/del_documents}")
    String AI_COMMON_DOC_DEL_URL;

    @Value("${ultari.ai-gateway.common-doc-add:http://10.0.0.111:8000/admin/documents/search}")
    String AI_COMMON_DOC_SRCH_URL;

    @Value("${ultari.ai-gateway.common-doc-add:http://10.0.0.111:8000/admin/documents/[key]/toggle}")
    String AI_COMMON_DOC_USAGE_URL;

    @Value("${ultari.ai-gateway.common-doc-add:http://10.0.0.111:8000/admin/documents/count}")
    String AI_COMMON_DOC_COUNT_URL;

    @Autowired
    RestTemplate restTemplate;

    @Autowired
    MsgAdminRepository adminRepository;

    public JSONArray getCommonFileList(String adminId, int size, int page) {
        JSONArray arr = new JSONArray();

        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

        HttpEntity<Void> entity = new HttpEntity<>(headers);

        URI uri = UriComponentsBuilder
                .fromHttpUrl(AI_COMMON_DOC_LIST_URL)
                .queryParam("page", page)
                .queryParam("size", size)
                .build()
                .toUri();

        ResponseEntity<String> response =
                restTemplate.exchange(
                        uri,
                        HttpMethod.GET,
                        entity,
                        String.class
                    );

        String body = response.getBody();
        log.debug("raw body={}", body);

        JSONObject json = new JSONObject(body);

        if(ObjectUtils.isEmpty(json)) return arr;

        String code = json.getString("code");
        String message = json.getString("message");

        if("0000".equals(code)) {
            log.debug("adminId={}, size={}, page={}, code={}, message={}", adminId, size, page, code, message);
            log.debug(json.get("items").toString());
            arr = json.getJSONArray("items");
        } else {
            log.warn("adminId={}, size={}, page={}, code={}, message={}", adminId, size, page, code, message);
        }

        return arr;
    }

    public String setCommonFileDelete(String adminId, String key) {
        String rtn = "fail";

        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

        HttpEntity<Void> entity = new HttpEntity<>(headers);

        URI uri = UriComponentsBuilder
                .fromHttpUrl(AI_COMMON_DOC_DEL_URL+"/"+key)
                .build()
                .toUri();

        ResponseEntity<String> response =
                restTemplate.exchange(
                        uri,
                        HttpMethod.DELETE,
                        entity,
                        String.class
                );

        String body = response.getBody();
        log.debug("raw body={}", body);

        JSONObject json = new JSONObject(body);

        if(ObjectUtils.isEmpty(json)) return "fail";

        String code = json.getString("code");
        String message = json.getString("message");

        if("0000".equals(code)) {
            rtn = "ok";
            log.debug("adminId={}, key={}, code={}, message={}",adminId, key, code, message);
        } else if("4004".equals(code)) {
            rtn = "fail";
            log.warn("adminId={}, key={}, code={}, message={}",adminId, key, code, message);
        } else {
            rtn = "fail";
            log.warn("adminId={}, key={}, code={}, message={}",adminId, key, code, message);
        }

        return rtn;
    }

    public String setCommonFileAdd(String adminId, MultipartFile file) {
        AtomicReference<String> rtn = new AtomicReference<>("fail");

        Optional<MsgAdmin> admin = adminRepository.findById(adminId);
        admin.ifPresent(msgAdmin -> {
            String adminName = msgAdmin.getAdminName();

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultipartBodyBuilder builder = new MultipartBodyBuilder();
            builder.part("key", UUID.randomUUID().toString());
            builder.part("adminId", adminId);
            builder.part("adminName", adminName);
            builder.part("file", file.getResource())
                    .filename(Objects.requireNonNull(file.getOriginalFilename()))
                    .contentType(MediaType.APPLICATION_OCTET_STREAM);

            MultiValueMap<String, HttpEntity<?>> body = builder.build();

            HttpEntity<MultiValueMap<String, HttpEntity<?>>> entity =
                    new HttpEntity<>(body, headers);

            ResponseEntity<String> response =
                    restTemplate.postForEntity(
                            AI_COMMON_DOC_ADD_URL,
                            entity,
                            String.class
                    );

            String raw = response.getBody();
            log.debug("raw body={}", raw);

            JSONObject json = new JSONObject(raw);

            if (!ObjectUtils.isEmpty(json) && json.has("code")) {
                String code = json.getString("code");
                String message = json.getString("message");

                if ("0000".equals(code)) {
                    rtn.set("ok");
                } else {
                    rtn.set("fail");
                    log.warn("code={}, message={}", code, message);
                }
            }
        });

        return rtn.get();
    }


    public JSONArray getCommonFileSearch(String adminId, String type, String context, int size, int page) {
        JSONArray arr = new JSONArray();

        ResponseEntity<String> response =
                restTemplate.getForEntity(
                        AI_COMMON_DOC_SRCH_URL+"?searchType="+type+"&searchTerm="+context+"&page="+page+"&size="+size,
                        String.class
                );

        String raw = response.getBody();
        log.debug("raw body={}", raw);

        JSONObject json = new JSONObject(raw);

        if(ObjectUtils.isEmpty(json)) return arr;

        String code = json.getString("code");
        String message = json.getString("message");

        if("0000".equals(code)) {
            log.debug("adminId={}, size={}, page={}, code={}, message={}", adminId, size, page, code, message);
            log.debug(json.get("items").toString());
            arr = json.getJSONArray("items");
        } else {
            log.warn("adminId={}, size={}, page={}, code={}, message={}", adminId, size, page, code, message);
        }

        return arr;
    }

    public JSONArray getCountList(String adminId) {
        JSONArray arr = new JSONArray();

        ResponseEntity<String> response =
                restTemplate.getForEntity(
                        AI_COMMON_DOC_COUNT_URL,
                        String.class
                );

        String raw = response.getBody();
        log.debug("raw body={}", raw);

        JSONObject json = new JSONObject(raw);

        if(ObjectUtils.isEmpty(json)) return arr;

        String code = json.getString("code");
        String message = json.getString("message");

        if("0000".equals(code)) {
            log.debug("adminId={}, code={}, message={}", adminId, code, message);
            log.debug(json.toString());

            json.remove("code");
            json.remove("message");

            for (Iterator<String> it = json.keys(); it.hasNext(); ) {
                String key = it.next();

                JSONObject countJson = new JSONObject();
                countJson.put("countName", key);
                countJson.put("count",json.getInt(key));

                arr.put(countJson);
            }
        } else {
            log.warn("adminId={}, code={}, message={}", adminId, code, message);
        }

        return arr;
    }

    public String setCommonFileUsage(String adminId, String key, boolean isUse) {
        String rtn = "ok";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Void> entity = new HttpEntity<>(headers);

        ResponseEntity<String> response =
                restTemplate.exchange(
                        AI_COMMON_DOC_USAGE_URL.replace("[key]",key),
                        HttpMethod.PATCH,
                        entity,
                        String.class
                );

        String raw = response.getBody();
        log.debug("raw body={}", raw);

        JSONObject json = new JSONObject(raw);

        if(ObjectUtils.isEmpty(json)) return "fail";

        String code = json.getString("code");
        String message = json.getString("message");

        if("0000".equals(code)) {
            rtn = "ok";
            log.debug("adminId={}, key={}, isUse={}, code={}, message={}",adminId, key, isUse, code, message);
        } else if("4004".equals(code)) {
            rtn = "fail";
            log.warn("adminId={}, key={}, isUse={}, code={}, message={}",adminId, key, isUse, code, message);
        } else {
            rtn = "fail";
            log.warn("adminId={}, key={}, isUse={}, code={}, message={}",adminId, key, isUse, code, message);
        }

        return rtn;
    }
}
