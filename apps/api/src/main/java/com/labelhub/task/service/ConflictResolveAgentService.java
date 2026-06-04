package com.labelhub.task.service;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ConflictResolveAgentService {

    @Data
    public static class ConflictSuggestion {
        private String conflictId;
        private String resolutionStrategy;
        private Double confidence;
        private List<String> referenceCases;
    }

    @Transactional(readOnly = true)
    public ConflictSuggestion resolveConflict(String taskId, String itemId) {
        ConflictSuggestion suggestion = new ConflictSuggestion();
        suggestion.setConflictId(UUID.randomUUID().toString());
        suggestion.setResolutionStrategy("仲裁复审：由高级审核员确认最终标注结果");
        suggestion.setConfidence(0.75);
        suggestion.setReferenceCases(new ArrayList<>());
        return suggestion;
    }
}
