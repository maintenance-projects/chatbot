package kr.co.ultari.chatbot.database.entity;

import lombok.Data;

import jakarta.persistence.*;
import java.util.Date;

@Data
@Entity
@Table(name = "chatbot_admin")
public class MsgAdmin {

    @Id
    @Column(name = "ADMIN_ID", length = 50)
    private String adminId;

    @Column(name = "ADMIN_NAME", length = 50)
    private String adminName;

    @Column(name = "PASSWORD", length = 50)
    private String password;

    @Column(name = "AUTH_STORAGE", columnDefinition = "CHAR", length = 1)
    private String authStorage;

    @Column(name = "AUTH_STATISTICS", columnDefinition = "CHAR", length = 1)
    private String authStatistics;

    @Column(name = "AUTH_MASTER", columnDefinition = "CHAR", length = 1)
    private String authMaster;

    @Column(name = "AUTH_PARTITION", columnDefinition = "CHAR", length = 1)
    private String authPartition;

    @Column(name = "AUTH_CONFIG", columnDefinition = "CHAR", length = 1)
    private String authConfig;

    @Column(name = "IP", length = 50)
    private String ip;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "REG_DATE", updatable = false)
    private Date regDate;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "UPDATE_DATE")
    private Date updateDate;
}
