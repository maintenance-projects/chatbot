package kr.co.ultari.chatbot.database.entity;

import lombok.Data;

import javax.persistence.*;
import java.util.Date;

@Data
@Entity
@Table(name = "MSG_ADMIN")
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

    @Column(name = "IP", length = 50)
    private String ip;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "REG_DATE", updatable = false)
    private Date regDate;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "UPDATE_DATE")
    private Date updateDate;
}