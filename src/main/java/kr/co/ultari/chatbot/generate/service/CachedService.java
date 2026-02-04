package kr.co.ultari.chatbot.generate.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class CachedService {
    @CacheEvict(cacheNames = "FILES", key = "#sessionId")
    public void FilesCacheClear(String sessionId){
        log.debug("clear request files sessionId={}",sessionId);
    }
}
