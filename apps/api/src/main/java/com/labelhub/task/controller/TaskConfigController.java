package com.labelhub.task.controller;

import com.labelhub.task.dto.AgentDtos.DatasetProfileReportDto;
import com.labelhub.task.dto.AgentDtos.SchemaRiskReportDto;
import com.labelhub.task.dto.SchemaDtos.AnnotationSchemaDto;
import com.labelhub.task.dto.TaskPackageDtos.DataItemViewDto;
import com.labelhub.task.dto.TaskPackageDtos.InstructionBundleDto;
import com.labelhub.task.dto.TaskPackageDtos.PublishReadinessDto;
import com.labelhub.task.dto.TaskPackageDtos.TaskPackageDto;
import com.labelhub.task.service.AgentMetrics;
import com.labelhub.task.service.TaskPackageService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tasks")
public class TaskConfigController {
  private final TaskPackageService taskPackageService;
  private final AgentMetrics agentMetrics;

  public TaskConfigController(TaskPackageService taskPackageService, AgentMetrics agentMetrics) {
    this.taskPackageService = taskPackageService;
    this.agentMetrics = agentMetrics;
  }

  @GetMapping("/{taskId}/package")
  public TaskPackageDto getTaskPackage(@PathVariable String taskId) {
    return taskPackageService.getMockTaskPackage();
  }

  @GetMapping("/{taskId}/schema/current")
  public AnnotationSchemaDto getCurrentSchema(@PathVariable String taskId) {
    return taskPackageService.getMockTaskPackage().schema();
  }

  @GetMapping("/{taskId}/instructions")
  public InstructionBundleDto getInstructions(@PathVariable String taskId) {
    return taskPackageService.getInstructionBundle();
  }

  @GetMapping("/{taskId}/items/next")
  public DataItemViewDto getNextItem(@PathVariable String taskId) {
    return taskPackageService.nextDataItem();
  }

  @PostMapping("/{taskId}/publish-check")
  public PublishReadinessDto checkPublishReadiness(
      @PathVariable String taskId,
      @Valid @RequestBody TaskPackageDto taskPackage
  ) {
    long start = System.nanoTime();
    try {
      var result = taskPackageService.checkPublishReadiness(taskPackage);
      agentMetrics.recordAgentCall(AgentMetrics.AGENT_PUBLISH_CHECK, "success", System.nanoTime() - start);
      agentMetrics.recordAgentChain(AgentMetrics.AGENT_SCHEMA_RISK, AgentMetrics.AGENT_PUBLISH_CHECK);
      return result;
    } catch (Exception e) {
      agentMetrics.recordAgentCall(AgentMetrics.AGENT_PUBLISH_CHECK, "error", System.nanoTime() - start);
      throw e;
    }
  }

  @PostMapping("/{taskId}/schema-risk")
  public SchemaRiskReportDto schemaRisk(
      @PathVariable String taskId,
      @Valid @RequestBody TaskPackageDto taskPackage
  ) {
    long start = System.nanoTime();
    try {
      var result = taskPackageService.buildSchemaRiskReport(taskPackage);
      agentMetrics.recordAgentCall(AgentMetrics.AGENT_SCHEMA_RISK, "success", System.nanoTime() - start);
      agentMetrics.recordConfidence(AgentMetrics.AGENT_SCHEMA_RISK, 0.9);
      return result;
    } catch (Exception e) {
      agentMetrics.recordAgentCall(AgentMetrics.AGENT_SCHEMA_RISK, "error", System.nanoTime() - start);
      agentMetrics.recordCascadeFailure(AgentMetrics.AGENT_SCHEMA_RISK);
      throw e;
    }
  }

  @PostMapping("/{taskId}/dataset-profile")
  public DatasetProfileReportDto datasetProfile(
      @PathVariable String taskId,
      @Valid @RequestBody TaskPackageDto taskPackage
  ) {
    long start = System.nanoTime();
    try {
      var result = taskPackageService.profileDataset(taskPackage);
      agentMetrics.recordAgentCall(AgentMetrics.AGENT_DATASET_PROFILE, "success", System.nanoTime() - start);
      agentMetrics.recordAgentChain(AgentMetrics.AGENT_DATASET_PROFILE, AgentMetrics.AGENT_SCHEMA_RISK);
      return result;
    } catch (Exception e) {
      agentMetrics.recordAgentCall(AgentMetrics.AGENT_DATASET_PROFILE, "error", System.nanoTime() - start);
      throw e;
    }
  }

  @GetMapping("/health")
  public ResponseEntity<String> health() {
    return ResponseEntity.ok("labelhub-api-ok");
  }
}
