package kr.co.ultari.chatbot.admin.service;

import kr.co.ultari.chatbot.database.entity.MsgUser;
import kr.co.ultari.chatbot.database.repository.MsgUserRepository;
import lombok.RequiredArgsConstructor;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 사용자(MSG_USER) 부서 관리 서비스. 관리자 화면에서 사용자별 DEPT를 조회·지정한다.
 */
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final MsgUserRepository userRepository;

    public JSONArray getUserList() {
        JSONArray arr = new JSONArray();
        for (MsgUser u : userRepository.findAll()) {
            arr.put(toJson(u));
        }
        return arr;
    }

    public JSONArray search(String field, String keyword) {
        String kw = (keyword == null ? "" : keyword).toLowerCase();
        JSONArray arr = new JSONArray();
        for (MsgUser u : userRepository.findAll()) {
            String target;
            switch (field == null ? "" : field) {
                case "userName": target = u.getUserName(); break;
                case "userHigh": target = u.getUserHigh(); break;
                case "dept":     target = u.getDept(); break;
                default:         target = u.getUserId();
            }
            if (target != null && target.toLowerCase().contains(kw)) {
                arr.put(toJson(u));
            }
        }
        return arr;
    }

    @Transactional
    public String updateDept(String userId, String dept) {
        MsgUser u = userRepository.findById(userId).orElse(null);
        if (u == null) return "NoUser";
        u.setDept(dept);
        userRepository.save(u);
        return "ok";
    }

    private JSONObject toJson(MsgUser u) {
        JSONObject o = new JSONObject();
        o.put("userId", u.getUserId());
        o.put("userName", u.getUserName() == null ? "" : u.getUserName());
        o.put("userHigh", u.getUserHigh() == null ? "" : u.getUserHigh());
        o.put("dept", u.getDept() == null ? "" : u.getDept());
        return o;
    }
}
