package com.labelhub.task.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.labelhub.task.dto.TaskPackageDtos.TaskPackageDto;
import com.labelhub.task.model.SchemaComponentType;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SchemaValidatorTest {
  private final ObjectMapper objectMapper = new ObjectMapper();
  private final SchemaValidator validator = new SchemaValidator();
  private final TaskPackageService service = new TaskPackageService(validator);

  @Test
  void mockSchemaIsPublishableForBlockingRules() {
    TaskPackageDto taskPackage = service.getMockTaskPackage();

    assertThat(validator.isValidForPublish(taskPackage.schema())).isTrue();
  }

  @Test
  void readinessContainsRequiredMemberAChecks() {
    TaskPackageDto taskPackage = service.getMockTaskPackage();

    assertThat(service.checkPublishReadiness(taskPackage).checks())
        .extracting("name")
        .contains("基础信息", "Schema", "Schema 10类物料", "数据", "Rubric", "Prompt 模板", "AgentPolicy");
    assertThat(service.checkPublishReadiness(taskPackage).ready()).isTrue();
  }

  @Test
  void schemaRiskReportKeepsTraceId() {
    TaskPackageDto taskPackage = service.getMockTaskPackage();

    assertThat(service.buildSchemaRiskReport(taskPackage).traceId()).isEqualTo(taskPackage.traceId());
    assertThat(service.buildSchemaRiskReport(taskPackage).findings()).isNotEmpty();
  }

  @Test
  void datasetImportPreviewDocumentsAcceptedFormatsAndRejectedRows() {
    assertThat(service.previewDatasetImport("task_text_cls_001").acceptedFormats())
        .contains("json", "jsonl", "xlsx", "csv");
    assertThat(service.previewDatasetImport("task_text_cls_001").rejectedRows()).isNotEmpty();
  }

  @Test
  void enumWireValuesMatchSharedTypescriptContracts() throws Exception {
    assertThat(objectMapper.writeValueAsString(SchemaComponentType.SHORT_TEXT)).isEqualTo("\"shortText\"");
  }
}
