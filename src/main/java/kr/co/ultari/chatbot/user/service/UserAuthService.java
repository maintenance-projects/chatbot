package kr.co.ultari.chatbot.user.service;

import kr.co.ultari.chatbot.database.entity.MsgUser;
import kr.co.ultari.chatbot.database.repository.MsgUserRepository;
import org.springframework.stereotype.Service;

@Service
public class UserAuthService {

    private final MsgUserRepository userRepository;

    public UserAuthService(MsgUserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public String login(String userId, String password) {
        MsgUser user = userRepository.findById(userId).orElse(null);
        if (user == null) return "NoUser";
        if (!user.getPassword().equals(password)) return "NoPassword";
        return "ok";
    }
}
