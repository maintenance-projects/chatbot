package kr.co.ultari.chatbot.admin.datamodel.dto;

public class AdminLoginRequest {

    private String adminId;
    private String password;
    private boolean rememberMe;

    public String getAdminId() {
        return adminId;
    }

    public String getPassword() {
        return password;
    }

    public boolean isRememberMe() {
        return rememberMe;
    }
}
