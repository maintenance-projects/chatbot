package kr.co.ultari.chatbot.admin.service;

import kr.co.ultari.chatbot.database.entity.MsgAdmin;
import kr.co.ultari.chatbot.database.repository.MsgAdminRepository;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;

@Slf4j
@Service
public class AdminMasterService {

    private final MsgAdminRepository adminRepository;
    private static final SimpleDateFormat SDF = new SimpleDateFormat("yyyy-MM-dd HH:mm");

    public AdminMasterService(MsgAdminRepository adminRepository) {
        this.adminRepository = adminRepository;
    }

    public JSONArray getAdminList() {
        List<MsgAdmin> list = adminRepository.findAll();
        return toJsonArray(list);
    }

    public JSONArray searchAdmins(String field, String keyword) {
        List<MsgAdmin> list;
        if ("adminName".equals(field)) {
            list = adminRepository.findByAdminNameContaining(keyword);
        } else {
            list = adminRepository.findByAdminIdContaining(keyword);
        }
        return toJsonArray(list);
    }

    public String addAdmin(String adminId, String adminName, String password,
                           String ip, String authStorage, String authStatistics, String authMaster, String authPartition, String authConfig) {
        if (adminRepository.findById(adminId).isPresent()) {
            return "DuplicateId";
        }
        MsgAdmin admin = new MsgAdmin();
        admin.setAdminId(adminId);
        admin.setAdminName(adminName);
        admin.setPassword(password);
        admin.setIp(ip);
        admin.setAuthStorage(authStorage);
        admin.setAuthStatistics(authStatistics);
        admin.setAuthMaster(authMaster);
        admin.setAuthPartition(authPartition);
        admin.setAuthConfig(authConfig);
        admin.setRegDate(new Date());
        admin.setUpdateDate(new Date());
        adminRepository.save(admin);
        return "ok";
    }

    public String updateAdmin(String adminId, String adminName, String ip,
                              String authStorage, String authStatistics, String authMaster, String authPartition, String authConfig) {
        MsgAdmin admin = adminRepository.findById(adminId).orElse(null);
        if (admin == null) return "fail";
        admin.setAdminName(adminName);
        admin.setIp(ip);
        admin.setAuthStorage(authStorage);
        admin.setAuthStatistics(authStatistics);
        admin.setAuthMaster(authMaster);
        admin.setAuthPartition(authPartition);
        admin.setAuthConfig(authConfig);
        admin.setUpdateDate(new Date());
        adminRepository.save(admin);
        return "ok";
    }

    public String deleteAdmin(String adminId) {
        if (!adminRepository.findById(adminId).isPresent()) return "fail";
        adminRepository.deleteById(adminId);
        return "ok";
    }

    private JSONArray toJsonArray(List<MsgAdmin> list) {
        JSONArray arr = new JSONArray();
        for (MsgAdmin a : list) {
            JSONObject obj = new JSONObject();
            obj.put("adminId", a.getAdminId());
            obj.put("adminName", a.getAdminName() != null ? a.getAdminName() : "");
            obj.put("ip", a.getIp() != null ? a.getIp() : "");
            obj.put("authStorage", a.getAuthStorage() != null ? a.getAuthStorage() : "0");
            obj.put("authStatistics", a.getAuthStatistics() != null ? a.getAuthStatistics() : "0");
            obj.put("authMaster", a.getAuthMaster() != null ? a.getAuthMaster() : "0");
            obj.put("authPartition", a.getAuthPartition() != null ? a.getAuthPartition() : "0");
            // AUTH_CONFIG 미설정(NULL=기존 관리자)은 마스터 권한을 따르므로 authMaster 값으로 표시(세션 폴백과 일치)
            obj.put("authConfig", a.getAuthConfig() != null ? a.getAuthConfig()
                    : (a.getAuthMaster() != null ? a.getAuthMaster() : "0"));
            obj.put("regDate", a.getRegDate() != null ? SDF.format(a.getRegDate()) : "");
            obj.put("updateDate", a.getUpdateDate() != null ? SDF.format(a.getUpdateDate()) : "");
            arr.put(obj);
        }
        return arr;
    }
}
