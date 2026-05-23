package com.labelhub.task.dto;

import com.labelhub.task.dto.SchemaDtos.AnnotationSchemaDto;
import com.labelhub.task.model.Severity;
import com.labelhub.task.model.TaskStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class TaskPackageDtos {
  private TaskPackageDtos() {}

  public record RubricRuleDto(
      @NotBlank String ruleId,
      @NotBlank String description,
      @NotNull Severity severity,
      @NotEmpty List<String> appliesTo,
      List<String> positiveExamples,
      List<String> negativeExamples,
      boolean allowAgentAutoPass
  ) {}

  public record RubricVersionDto(
      @NotBlank String rubricVersionId,
      @NotBlank String taskId,
      @Positive int version,
      @NotEmpty List<String> dimensions,
      @NotBlank String promptTemplate,
      @NotEmpty List<@Valid RubricRuleDto> rules,
      boolean frozen
  ) {}

  public record DataItemViewDto(
      @NotBlank String itemId,
      @NotNull Map<String, Object> rawPayload,
      @NotNull Map<String, Object> displayPayload,
      List<String> mediaRefs,
      Map<String, Object> metadata
  ) {}

  public record InstructionBundleDto(
      @NotBlank String instructionVersionId,
      @NotBlank String taskId,
      @NotBlank String content,
      List<String> positiveExamples,
      List<String> negativeExamples,
      List<String> rubricSummary,
      @NotBlank String traceId
  ) {}

  public record DatasetFieldProfileDto(
      @NotBlank String sourceField,
      @NotBlank String inferredType,
      double nullRate,
      @NotBlank String mappedPath,
      Object example
  ) {}

  public record RejectedRowDto(
      @Positive int rowNumber,
      @NotBlank String reason
  ) {}

  public record DatasetImportPreviewDto(
      @NotBlank String datasetId,
      @NotBlank String taskId,
      @NotEmpty List<String> acceptedFormats,
      List<DatasetFieldProfileDto> fields,
      List<RejectedRowDto> rejectedRows,
      @NotBlank String traceId
  ) {}

  public record AssignmentPolicyDto(
      @NotBlank String mode,
      @Positive int replicasPerItem,
      @Positive int deadlineHours,
      Integer quotaPerLabeler
  ) {}

  public record AgentPolicyDto(
      boolean precheckEnabled,
      @DecimalMin("0.0") @DecimalMax("1.0") double confidenceThreshold,
      @NotEmpty List<String> toolWhitelist,
      @NotBlank String modelPreference,
      @NotBlank String promptTemplateVersionId
  ) {}

  public record TaskPackageDto(
      @NotBlank String taskId,
      @NotBlank String schemaVersionId,
      @NotBlank String instructionVersionId,
      @NotBlank String rubricVersionId,
      @NotBlank String datasetId,
      @NotBlank String title,
      @NotNull TaskStatus status,
      @Valid @NotNull AssignmentPolicyDto assignmentPolicy,
      @Valid @NotNull AgentPolicyDto agentPolicy,
      @Valid @NotNull AnnotationSchemaDto schema,
      @Valid @NotNull RubricVersionDto rubric,
      @NotEmpty List<@Valid DataItemViewDto> sampleItems,
      @NotBlank String traceId,
      Instant createdAt
  ) {}

  public record PublishCheckDto(
      @NotBlank String name,
      boolean passed,
      String message
  ) {}

  public record PublishReadinessDto(
      @NotBlank String taskId,
      boolean ready,
      List<PublishCheckDto> checks
  ) {}
}
