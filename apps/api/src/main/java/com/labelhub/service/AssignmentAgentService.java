package com.labelhub.service;

import com.labelhub.entity.AgentRun;
import com.labelhub.entity.TaskAssignment;
import com.labelhub.repository.AgentRunRepository;
import com.labelhub.repository.TaskAssignmentRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AssignmentAgentService {

    private final TaskAssignmentRepository assignmentRepository;
    private final AgentRunRepository agentRunRepository;

    @Data
    public static class LabelerLoadInfo {
        private String labelerId;
        private int activeItems;
        private int completedToday;
        private double avgSecondsPerItem;
        private int recommendedQuota;
    }

    @Data
    public static class SlaAlert {
        private String assignmentId;
        private String labelerId;
        private String status;
        private long minutesOverdue;
        private String alertLevel;
    }

    @Data
    public static class AssignmentSuggestion {
        private List<String> recommendedLabelerIds;
        private List<SlaAlert> slaAlerts;
        private Map<String, Object> metadata;
    }

    @Transactional(readOnly = true)
    public AssignmentSuggestion getAssignmentSuggestions(String taskId) {
        AssignmentSuggestion suggestion = new AssignmentSuggestion();
        
        List<TaskAssignment> allAssignments = assignmentRepository.findByTaskId(taskId);
        
        Map<String, List<TaskAssignment>> byLabeler = allAssignments.stream()
            .collect(Collectors.groupingBy(TaskAssignment::getUserId));

        List<LabelerLoadInfo> loadInfos = new ArrayList<>();
        for (Map.Entry<String, List<TaskAssignment>> entry : byLabeler.entrySet()) {
            LabelerLoadInfo info = new LabelerLoadInfo();
            info.setLabelerId(entry.getKey());
            info.setActiveItems((int) entry.getValue().stream()
                .filter(a -> a.getStatus() != TaskAssignment.AssignmentStatus.COMPLETED)
                .count());
            info.setCompletedToday((int) entry.getValue().stream()
                .filter(a -> a.getUpdatedAt().isAfter(LocalDateTime.now().toLocalDate().atStartOfDay()))
                .count());
            info.setAvgSecondsPerItem(120.0);
            info.setRecommendedQuota(Math.max(3, 10 - info.getActiveItems()));
            loadInfos.add(info);
        }

        List<String> recommendedIds = loadInfos.stream()
            .sorted(Comparator.comparingInt(LabelerLoadInfo::getActiveItems))
            .map(LabelerLoadInfo::getLabelerId)
            .collect(Collectors.toList());
        suggestion.setRecommendedLabelerIds(recommendedIds);

        List<SlaAlert> alerts = new ArrayList<>();
        LocalDateTime fifteenMinutesAgo = LocalDateTime.now().minusMinutes(15);
        for (TaskAssignment a : allAssignments) {
            if (a.getStartedAt().isBefore(fifteenMinutesAgo) 
                && a.getStatus() == TaskAssignment.AssignmentStatus.ACTIVE) {
                SlaAlert alert = new SlaAlert();
                alert.setAssignmentId(a.getId());
                alert.setLabelerId(a.getUserId());
                alert.setStatus(a.getStatus().name());
                alert.setMinutesOverdue(java.time.Duration.between(a.getStartedAt(), LocalDateTime.now()).toMinutes());
                alert.setAlertLevel(alert.getMinutesOverdue() > 30 ? "CRITICAL" : "WARNING");
                alerts.add(alert);
            }
        }
        suggestion.setSlaAlerts(alerts);

        suggestion.setMetadata(Map.of("generatedAt", LocalDateTime.now().toString(), 
            "totalLabelers", loadInfos.size()));

        recordAgentRun("AssignmentAgent", taskId, suggestion);
        return suggestion;
    }

    @Transactional(readOnly = true)
    public List<LabelerLoadInfo> getLabelerLoads(String taskId) {
        return getAssignmentSuggestions(taskId).getRecommendedLabelerIds().stream()
            .map(id -> {
                LabelerLoadInfo info = new LabelerLoadInfo();
                info.setLabelerId(id);
                info.setActiveItems((int) assignmentRepository.findByTaskId(taskId).stream()
                    .filter(a -> id.equals(a.getUserId()))
                    .filter(a -> a.getStatus() != TaskAssignment.AssignmentStatus.COMPLETED)
                    .count());
                info.setCompletedToday(0);
                info.setAvgSecondsPerItem(120.0);
                info.setRecommendedQuota(5);
                return info;
            })
            .collect(Collectors.toList());
    }

    private void recordAgentRun(String agentName, String taskId, Object result) {
        AgentRun run = new AgentRun();
        run.setId(UUID.randomUUID().toString());
        run.setAgentName(agentName);
        run.setSkillName("assignment-policy");
        run.setSkillVersion("1.0");
        run.setTaskId(taskId);
        run.setTraceId(UUID.randomUUID().toString());
        run.setStatus("COMPLETED");
        run.setInputSummary("taskId=" + taskId);
        run.setOutputSummary(result.toString());
        run.setContextRefsJson("{}");
        run.setToolCallsJson("[]");
        run.setLlmCallsJson("[]");
        run.setLatencyMs(50L);
        run.setCreatedAt(LocalDateTime.now());
        run.setCompletedAt(LocalDateTime.now());
        agentRunRepository.save(run);
    }
}
