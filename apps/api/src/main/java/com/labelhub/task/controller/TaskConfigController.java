package com.labelhub.task.controller;

import com.labelhub.task.dto.AgentDtos.DatasetProfileReportDto;
import com.labelhub.task.dto.AgentDtos.SchemaRiskReportDto;
import com.labelhub.task.dto.SchemaDtos.AnnotationSchemaDto;
import com.labelhub.task.dto.TaskPackageDtos.DataItemViewDto;
import com.labelhub.task.dto.TaskPackageDtos.InstructionBundleDto;
import com.labelhub.task.dto.TaskPackageDtos.PublishReadinessDto;
import com.labelhub.task.dto.TaskPackageDtos.TaskPackageDto;
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

  public TaskConfigController(TaskPackageService taskPackageService) {
    this.taskPackageService = taskPackageService;
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
    return taskPackageService.checkPublishReadiness(taskPackage);
  }

  @PostMapping("/{taskId}/schema-risk")
  public SchemaRiskReportDto schemaRisk(
      @PathVariable String taskId,
      @Valid @RequestBody TaskPackageDto taskPackage
  ) {
    return taskPackageService.buildSchemaRiskReport(taskPackage);
  }

  @PostMapping("/{taskId}/dataset-profile")
  public DatasetProfileReportDto datasetProfile(
      @PathVariable String taskId,
      @Valid @RequestBody TaskPackageDto taskPackage
  ) {
    return taskPackageService.profileDataset(taskPackage);
  }

  @GetMapping("/health")
  public ResponseEntity<String> health() {
    return ResponseEntity.ok("labelhub-api-ok");
  }
}
