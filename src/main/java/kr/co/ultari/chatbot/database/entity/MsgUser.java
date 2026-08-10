package kr.co.ultari.chatbot.database.entity;

import lombok.Data;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Data
@Entity
@Table(name = "MSG_USER")
public class MsgUser {

    @Id
    @Column(name = "USER_ID", length = 50)
    private String userId;

    @Column(name = "USER_HIGH", length = 50)
    private String userHigh;

    @Column(name = "USER_NAME", length = 50)
    private String userName;

    @Column(name = "POS_NAME", length = 50)
    private String posName;

    @Column(name = "GRADE", length = 50)
    private String grade;

    @Column(name = "PHONE", length = 50)
    private String phone;

    @Column(name = "MOBILE", length = 50)
    private String mobile;

    @Column(name = "JOB", length = 50)
    private String job;

    @Column(name = "PASSWORD", length = 50)
    private String password;

    @Column(name = "USER_ORDER", length = 50)
    private String userOrder;

    @Column(name = "USER_TYPE", length = 50)
    private String userType;

    /** 부서(dept) 코드 — 게이트웨이 라우팅(/{dept}/...) 결정. 관리자 화면에서 지정. */
    @Column(name = "DEPT", length = 50)
    private String dept;
}
