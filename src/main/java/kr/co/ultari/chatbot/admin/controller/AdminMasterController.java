package kr.co.ultari.chatbot.admin.controller;

import kr.co.ultari.chatbot.admin.service.AdminMasterService;
import kr.co.ultari.chatbot.admin.session.AdminSessionStore;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONArray;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

@Slf4j
@Controller
@RequestMapping("/at-i/master")
public class AdminMasterController {

    @Autowired
    AdminSessionStore sessionStore;

    @Autowired
    AdminMasterService masterService;

    @PostMapping("/list")
    @ResponseBody
    public String getAdminList(@RequestParam("adminId") String adminId) {
        log.debug("[master list] adminId={}", adminId);
        JSONArray arr = masterService.getAdminList();
        return arr.toString();
    }

    @PostMapping("/search")
    @ResponseBody
    public String searchAdmins(@RequestParam("adminId") String adminId,
                               @RequestParam("field") String field,
                               @RequestParam("keyword") String keyword) {
        log.debug("[master search] adminId={}, field={}, keyword={}", adminId, field, keyword);
        JSONArray arr = masterService.searchAdmins(field, keyword);
        return arr.toString();
    }

    @PostMapping("/add")
    @ResponseBody
    public String addAdmin(@RequestParam("adminId") String adminId,
                           @RequestParam("targetId") String targetId,
                           @RequestParam("targetName") String targetName,
                           @RequestParam("password") String password,
                           @RequestParam("ip") String ip,
                           @RequestParam("authStorage") String authStorage,
                           @RequestParam("authStatistics") String authStatistics,
                           @RequestParam("authMaster") String authMaster,
                           @RequestParam(value = "authPartition", defaultValue = "0") String authPartition) {
        log.debug("[master add] adminId={}, targetId={}", adminId, targetId);
        return masterService.addAdmin(targetId, targetName, password, ip, authStorage, authStatistics, authMaster, authPartition);
    }

    @PostMapping("/update")
    @ResponseBody
    public String updateAdmin(@RequestParam("adminId") String adminId,
                              @RequestParam("targetId") String targetId,
                              @RequestParam("targetName") String targetName,
                              @RequestParam("ip") String ip,
                              @RequestParam("authStorage") String authStorage,
                              @RequestParam("authStatistics") String authStatistics,
                              @RequestParam("authMaster") String authMaster,
                              @RequestParam(value = "authPartition", defaultValue = "0") String authPartition) {
        log.debug("[master update] adminId={}, targetId={}", adminId, targetId);
        return masterService.updateAdmin(targetId, targetName, ip, authStorage, authStatistics, authMaster, authPartition);
    }

    @PostMapping("/delete")
    @ResponseBody
    public String deleteAdmin(@RequestParam("adminId") String adminId,
                              @RequestParam("targetId") String targetId) {
        log.debug("[master delete] adminId={}, targetId={}", adminId, targetId);
        if (adminId.equals(targetId)) return "SelfDelete";
        return masterService.deleteAdmin(targetId);
    }
}
