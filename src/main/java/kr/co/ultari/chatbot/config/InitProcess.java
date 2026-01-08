package kr.co.ultari.chatbot.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.io.File;

@Slf4j
@Component
public class InitProcess {

    @Value("${ultari.ai.temp.path:tmp}")
    String tempPath;

    @PostConstruct
    public void initDir() {
        File f = new File(tempPath);
        log.info("tmp path = {}",tempPath);
        if(!f.exists()) {
            log.info("Tmp directory not found. Creating path = {}",tempPath);
            f.mkdirs();
        }
    }
}
