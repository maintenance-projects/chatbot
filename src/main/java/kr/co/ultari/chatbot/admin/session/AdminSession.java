package kr.co.ultari.chatbot.admin.session;

import java.io.Serializable;

public class AdminSession implements Serializable {

    private String adminId;
    private String adminName;

    private boolean authStorage;
    private boolean authStatistics;
    private boolean authMaster;
    private boolean authPartition;

    public AdminSession(String adminId, String adminName,
                        String authStorage, String authStatistics, String authMaster, String authPartition) {
        this.adminId = adminId;
        this.adminName = adminName;
        this.authStorage = "1".equals(authStorage);
        this.authStatistics = "1".equals(authStatistics);
        this.authMaster = "1".equals(authMaster);
        this.authPartition = "1".equals(authPartition);
    }

    public String getAdminId() { return adminId; }
    public String getAdminName() { return adminName; }
    public boolean isAuthStorage() { return authStorage; }
    public boolean isAuthStatistics() { return authStatistics; }
    public boolean isAuthMaster() { return authMaster; }
    public boolean isAuthPartition() { return authPartition; }
}
