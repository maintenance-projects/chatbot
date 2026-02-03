package kr.co.ultari.chatbot.admin.controller;

import kr.co.ultari.chatbot.admin.service.AdminStorageService;
import kr.co.ultari.chatbot.admin.session.AdminSessionStore;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONArray;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@RestController
@RequestMapping("/admin/storage")
public class AdminStorageController {

    @Autowired
    AdminSessionStore sessionStore;

    @Autowired
    AdminStorageService storageService;

    @PostMapping("/list")
    public String requestStorageList(@RequestParam("adminId") String adminId, @RequestParam("size") int size, @RequestParam("page") int page) {
        log.debug("adminId={}, size={}, page={}",adminId, size, page);
        JSONArray arr = storageService.getCommonFileList(adminId, size, page);
        return arr.toString();
    }

    @PostMapping("/delete")
    public ResponseEntity<String> requestStorageDelete(@RequestParam("adminId") String adminId, @RequestParam("key") String key) {
        log.debug("adminId={}, key={}",adminId, key);
        String rtn = storageService.setCommonFileDelete(adminId, key);
        return ResponseEntity.ok(rtn);
    }

    @PostMapping("/add")
    public ResponseEntity<String> requestStorageAdd(@RequestParam("adminId") String adminId, @RequestParam("file") MultipartFile file) {
        log.debug("adminId={}, file={}",adminId,file.getOriginalFilename());
        String rtn = storageService.setCommonFileAdd(adminId, file);
        return ResponseEntity.ok(rtn);
    }

    @PostMapping("/search")
    public String requestStorageSearch(@RequestParam("adminId") String adminId
            , @RequestParam("type") String type, @RequestParam("context") String context
            , @RequestParam("size") int size, @RequestParam("page") int page) {
        JSONArray arr = storageService.getCommonFileSearch(adminId, type, context, size, page);

        return arr.toString();
    }

}
