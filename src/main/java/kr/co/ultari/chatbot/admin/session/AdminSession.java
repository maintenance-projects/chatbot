package kr.co.ultari.chatbot.admin.session;

import java.io.Serializable;

public class AdminSession implements Serializable {

    private String adminId;
    private String adminName;

    private boolean authStorage;
    private boolean authStatistics;
    private boolean authMaster;
    private boolean authPartition;
    private boolean authConfig;

    public AdminSession(String adminId, String adminName,
                        String authStorage, String authStatistics, String authMaster, String authPartition,
                        String authConfig) {
        this.adminId = adminId;
        this.adminName = adminName;
        this.authStorage = "1".equals(authStorage);
        this.authStatistics = "1".equals(authStatistics);
        this.authMaster = "1".equals(authMaster);
        this.authPartition = "1".equals(authPartition);
        // AUTH_CONFIG 신설: 미설정(NULL=기존 관리자)이면 마스터 권한을 따른다(별도 백필 불필요).
        // 명시적으로 "0"이면 미부여, "1"이면 부여.
        this.authConfig = (authConfig == null) ? this.authMaster : "1".equals(authConfig);
    }

    public String getAdminId() { return adminId; }
    public String getAdminName() { return adminName; }
    public boolean isAuthStorage() { return authStorage; }
    public boolean isAuthStatistics() { return authStatistics; }
    public boolean isAuthMaster() { return authMaster; }
    public boolean isAuthPartition() { return authPartition; }
    public boolean isAuthConfig() { return authConfig; }
}
