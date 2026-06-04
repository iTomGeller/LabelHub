package com.labelhub.task.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SlaAgentService {

    @Transactional
    public void checkAndTriggerExpiredItems() {
    }
}
