package kr.co.ultari.chatbot.admin.session;

import java.io.Serializable;

public class AdminSession implements Serializable {

    private String adminId;
    private String adminName;

    private boolean authStorage;
    private boolean authStatistics;
    private boolean authMaster;

    public AdminSession(String adminId, String adminName,
                        String authStorage, String authStatistics, String authMaster) {
        this.adminId = adminId;
        this.adminName = adminName;
        this.authStorage = "1".equals(authStorage);
        this.authStatistics = "1".equals(authStatistics);
        this.authMaster = "1".equals(authMaster);
    }

    public String getAdminId() { return adminId; }
    public String getAdminName() { return adminName; }
    public boolean isAuthStorage() { return authStorage; }
    public boolean isAuthStatistics() { return authStatistics; }
    public boolean isAuthMaster() { return authMaster; }
}
