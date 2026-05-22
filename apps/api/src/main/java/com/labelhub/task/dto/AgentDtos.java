package com.labelhub.task.dto;

import com.labelhub.task.model.Severity;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public final class AgentDtos {
  private AgentDtos() {}

  public record AgentSuggestionRequest(
      @NotBlank String taskId,
      @NotBlank String instruction,
      @NotEmpty List<String> sampleRows,
      @NotBlank String traceId
  ) {}

  public record SchemaRiskFindingDto(
      String componentId,
      @NotNull Severity severity,
      @NotBlank String message,
      @NotBlank String recommendation
  ) {}

  public record SchemaRiskReportDto(
      @NotBlank String taskId,
      @NotBlank String schemaVersionId,
      @NotNull Severity riskLevel,
      List<SchemaRiskFindingDto> findings,
      @NotBlank String traceId
  ) {}

  public record DatasetProfileReportDto(
      @NotBlank String taskId,
      int sampleSize,
      int emptyFieldCount,
      int duplicateEstimate,
      List<String> warnings,
      @NotBlank String traceId
  ) {}
}
