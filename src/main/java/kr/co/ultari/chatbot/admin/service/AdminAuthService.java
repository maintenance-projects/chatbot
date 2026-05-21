package kr.co.ultari.chatbot.admin.service;

import kr.co.ultari.chatbot.admin.session.AdminSession;
import kr.co.ultari.chatbot.admin.session.AdminSessionStore;
import kr.co.ultari.chatbot.database.entity.MsgAdmin;
import kr.co.ultari.chatbot.database.repository.MsgAdminRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Date;

@Service
public class AdminAuthService {

    @Autowired
    AdminSessionStore sessionStore;

    private final MsgAdminRepository adminRepository;
    public AdminAuthService(MsgAdminRepository adminRepository) {
        this.adminRepository = adminRepository;
    }

    public String login(String adminId, String password, String clientIp, String uuid) {

        String rtn = "ok";
        
        //id 검증
        MsgAdmin admin = adminRepository.findById(adminId).orElse(null);
        if(admin==null) return rtn = "NoUser";

        //비밀번호 검증
        if (!admin.getPassword().equals(password)) {
            return rtn = "NoPassword";
        }

        // IP 검증 (0.0.0.0 이면 모두 허용)
        if (!"0.0.0.0".equals(admin.getIp())) {
            if (!admin.getIp().equals(clientIp)) {
                return rtn = "NoIp";
            }
        }

        AdminSession session = new AdminSession(admin.getAdminId(), admin.getAdminName(), admin.getAuthStorage(), admin.getAuthStatistics(), admin.getAuthMaster());
        sessionStore.save(uuid, session);

        return rtn;
    }

    public String changePassword(String adminId, String currentPassword, String newPassword) {
        MsgAdmin admin = adminRepository.findById(adminId).orElse(null);
        if (admin == null) return "NoUser";
        if (!admin.getPassword().equals(currentPassword)) return "WrongPassword";
        admin.setPassword(newPassword);
        admin.setUpdateDate(new Date());
        adminRepository.save(admin);
        return "ok";
    }

    public void logout(String uuid) {
        sessionStore.remove(uuid);
    }
}
