package com.labelhub.service;

import com.labelhub.entity.ReviewConflict;
import com.labelhub.repository.ReviewConflictRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ConflictResolveAgentService {

    private final ReviewConflictRepository conflictRepository;

    public List<ConflictSuggestion> getConflictSuggestions(String conflictId) {
        return List.of(
            new ConflictSuggestion("suggest-1", "建议将该条目送往仲裁队列", 0.9),
            new ConflictSuggestion("suggest-2", "查看历史相似标注案例", 0.7)
        );
    }

    public ReviewConflict createConflict(String taskId, String itemId) {
        ReviewConflict conflict = new ReviewConflict();
        conflict.setId(UUID.randomUUID().toString());
        conflict.setTaskId(taskId);
        conflict.setItemId(itemId);
        conflict.setStatus("OPEN");
        conflict.setCreatedAt(java.time.LocalDateTime.now());
        return conflictRepository.save(conflict);
    }

    public record ConflictSuggestion(String id, String suggestion, double confidence) {}
}
