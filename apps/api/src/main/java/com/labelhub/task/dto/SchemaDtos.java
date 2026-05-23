package com.labelhub.task.dto;

import com.labelhub.task.model.SchemaComponentType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class SchemaDtos {
  private SchemaDtos() {}

  public record ValidationRuleDto(
      @NotBlank String type,
      Object value,
      @NotBlank String message
  ) {}

  public record VisibleWhenDto(
      @NotBlank String fieldId,
      @NotBlank String operator,
      Object value
  ) {}

  public record SchemaComponentDto(
      @NotBlank String id,
      @NotNull SchemaComponentType type,
      @NotBlank String label,
      @NotBlank String dataPath,
      boolean required,
      Map<String, Object> props,
      List<@Valid ValidationRuleDto> validation,
      VisibleWhenDto visibleWhen,
      String groupId,
      String tabId
  ) {}

  public record AnnotationSchemaDto(
      @NotBlank String schemaVersionId,
      @NotBlank String taskId,
      @Positive int version,
      @NotBlank String title,
      @NotBlank String description,
      @NotEmpty List<@Valid SchemaComponentDto> components,
      Instant createdAt,
      boolean frozen
  ) {}
}
