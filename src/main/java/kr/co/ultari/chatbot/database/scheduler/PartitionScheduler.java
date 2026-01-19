package kr.co.ultari.chatbot.database.scheduler;

import kr.co.ultari.chatbot.database.service.PartitionManageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class PartitionScheduler {

    private final PartitionManageService partitionService;

    @Value("${ultari.ai.log-table.partition.create-policy:1}")
    int month;

    @Scheduled(cron = "0 0 1 25 * ?") //매월 25일 01:00
    //@Scheduled(cron = "0 0 * * * *")
    public void createPartition() {
        log.debug("scheduler!");
        try {
            // 아래 코드는 미리 몇 개월의 파티션닝을 생성함. 1넣으면 다음달, 3넣으면 3개월을 미리 생성.
            partitionService.createFuturePartitions(month);
        } catch (Exception e) {
            log.error("Partition create failed", e);
        }
    }
}
