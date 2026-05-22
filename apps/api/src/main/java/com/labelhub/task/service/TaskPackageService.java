package com.labelhub.task.service;

import com.labelhub.task.dto.AgentDtos.DatasetProfileReportDto;
import com.labelhub.task.dto.AgentDtos.SchemaRiskFindingDto;
import com.labelhub.task.dto.AgentDtos.SchemaRiskReportDto;
import com.labelhub.task.dto.SchemaDtos.AnnotationSchemaDto;
import com.labelhub.task.dto.SchemaDtos.SchemaComponentDto;
import com.labelhub.task.dto.SchemaDtos.ValidationRuleDto;
import com.labelhub.task.dto.TaskPackageDtos.AgentPolicyDto;
import com.labelhub.task.dto.TaskPackageDtos.AssignmentPolicyDto;
import com.labelhub.task.dto.TaskPackageDtos.DataItemViewDto;
import com.labelhub.task.dto.TaskPackageDtos.DatasetFieldProfileDto;
import com.labelhub.task.dto.TaskPackageDtos.DatasetImportPreviewDto;
import com.labelhub.task.dto.TaskPackageDtos.InstructionBundleDto;
import com.labelhub.task.dto.TaskPackageDtos.PublishCheckDto;
import com.labelhub.task.dto.TaskPackageDtos.PublishReadinessDto;
import com.labelhub.task.dto.TaskPackageDtos.RejectedRowDto;
import com.labelhub.task.dto.TaskPackageDtos.RubricRuleDto;
import com.labelhub.task.dto.TaskPackageDtos.RubricVersionDto;
import com.labelhub.task.dto.TaskPackageDtos.TaskPackageDto;
import com.labelhub.task.model.SchemaComponentType;
import com.labelhub.task.model.Severity;
import com.labelhub.task.model.TaskStatus;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class TaskPackageService {
  private final SchemaValidator schemaValidator;

  public TaskPackageService(SchemaValidator schemaValidator) {
    this.schemaValidator = schemaValidator;
  }

  public TaskPackageDto getMockTaskPackage() {
    AnnotationSchemaDto schema = new AnnotationSchemaDto(
        "schema_v1_text_cls",
        "task_text_cls_001",
        1,
        "评论意图分类标注模板",
        "根据原始评论选择主要意图并补充判断理由。",
        List.of(
            component("raw_comment", SchemaComponentType.SHOW_ITEM, "原始评论", "$.raw.comment", false,
                Map.of("template", "{{raw.comment}}"), List.of()),
            component("order_id", SchemaComponentType.SHORT_TEXT, "订单号", "$.annotation.orderId", true,
                Map.of("placeholder", "从原始数据中复制订单号"), required("订单号不能为空")),
            component("intent", SchemaComponentType.SINGLE_CHOICE, "主要意图", "$.annotation.intent", true,
                Map.of("options", List.of("咨询", "投诉", "夸赞", "售后", "无关")), required("请选择主要意图")),
            component("issue_types", SchemaComponentType.MULTI_CHOICE, "问题类型", "$.annotation.issueTypes", true,
                Map.of("options", List.of("退款", "物流", "客服", "商品质量", "价格"), "min", 1, "max", 3),
                required("至少选择一个问题类型")),
            component("sentiment_tags", SchemaComponentType.TAG_SELECT, "情绪标签", "$.annotation.sentimentTags", false,
                Map.of("options", List.of("愤怒", "焦虑", "满意", "疑惑", "中性"), "max", 3), List.of()),
            component("rich_instruction", SchemaComponentType.RICH_TEXT, "标注说明摘录", "$.annotation.instructionNote", false,
                Map.of("toolbar", List.of("bold", "italic", "quote")), List.of()),
            component("reason", SchemaComponentType.LONG_TEXT, "判断理由", "$.annotation.reason", true,
                Map.of("placeholder", "引用评论中的关键信息说明判断依据"),
                List.of(new ValidationRuleDto("required", true, "请填写判断理由"),
                    new ValidationRuleDto("minLength", 8, "判断理由至少 8 个字"))),
            component("evidence_upload", SchemaComponentType.FILE_UPLOAD, "证据截图", "$.annotation.evidenceFiles", false,
                Map.of("accept", List.of("image/png", "image/jpeg"), "maxFiles", 3), List.of()),
            component("structured_meta", SchemaComponentType.JSON_EDITOR, "结构化补充信息", "$.annotation.metadata", false,
                Map.of("schemaHint", "{ orderId: string, channel: string }"), List.of()),
            component("llm_hint", SchemaComponentType.LLM_INTERACTION, "LLM 辅助建议", "$.assistant.intentHint", false,
                Map.of("prompt", "请判断这条评论最可能的业务意图，并给出依据。",
                    "outputPath", "$.assistant.intentHint",
                    "recordAccepted", true),
                List.of())
        ),
        Instant.parse("2026-05-21T00:00:00Z"),
        false
    );

    RubricVersionDto rubric = new RubricVersionDto(
        "rubric_v1_text_cls",
        "task_text_cls_001",
        1,
        List.of("相关性", "准确性", "格式合规", "安全性"),
        "你是 LabelHub 预审 Agent。请依据任务说明、Schema 和 Rubric 对标注结果进行结构化预审。",
        List.of(
            new RubricRuleDto(
                "R1",
                "主要意图必须能从原始评论中直接找到依据。",
                Severity.HIGH,
                List.of("intent", "reason"),
                List.of("评论提到退款失败，标注为售后并说明退款上下文。"),
                List.of("评论只表达满意，但标注为投诉。"),
                true
            )
        ),
        false
    );

    return new TaskPackageDto(
        "task_text_cls_001",
        schema.schemaVersionId(),
        "instruction_v1_text_cls",
        rubric.rubricVersionId(),
        "dataset_reviews_001",
        "电商评论意图分类",
        TaskStatus.DRAFT,
        new AssignmentPolicyDto("auto_claim", 1, 24, 100),
        new AgentPolicyDto(
            true,
            0.82,
            List.of("task.getPackage", "schema.getVersion", "rubric.getVersion", "dataset.sample", "dataset.profile"),
            "mock-local",
            "prompt_v1_text_cls"
        ),
        schema,
        rubric,
        List.of(new DataItemViewDto(
            "item_001",
            Map.of(
                "comment", "退款申请三天了还不到账，客服也没人回复。",
                "orderId", "ORD-10001",
                "channel", "mobile-app"
            ),
            Map.of("title", "评论 #001", "body", "退款申请三天了还不到账，客服也没人回复。"),
            List.of(),
            Map.of("source", "demo", "language", "zh-CN")
        )),
        "trace_task_text_cls_001",
        Instant.parse("2026-05-21T00:00:00Z")
    );
  }

  public PublishReadinessDto checkPublishReadiness(TaskPackageDto taskPackage) {
    List<String> schemaErrors = schemaValidator.validate(taskPackage.schema());
    List<PublishCheckDto> checks = List.of(
        check("基础信息", !taskPackage.title().isBlank(), "任务标题不能为空"),
        check("说明版本", !taskPackage.instructionVersionId().isBlank(), "必须冻结说明版本"),
        check("Schema", schemaValidator.isValidForPublish(taskPackage.schema()), String.join("; ", schemaErrors)),
        check("Schema 10类物料", taskPackage.schema().components().stream().map(SchemaComponentDto::type).distinct().count() == 10,
            "必须覆盖单行、多行、单选、多选、标签、富文本、上传、JSON、LLM、展示项"),
        check("数据", !taskPackage.sampleItems().isEmpty(), "至少需要导入一条数据"),
        check("Rubric", !taskPackage.rubric().rules().isEmpty(), "至少需要一条 Rubric 规则"),
        check("Prompt 模板", !taskPackage.rubric().promptTemplate().isBlank(), "必须配置审核 Prompt 模板"),
        check("评分维度", taskPackage.rubric().dimensions().size() >= 4, "至少包含相关性/准确性/格式合规/安全性"),
        check("AgentPolicy", taskPackage.agentPolicy().confidenceThreshold() > 0, "必须配置 Agent 置信度阈值"),
        check("分配策略", taskPackage.assignmentPolicy().deadlineHours() > 0, "必须配置截止时间")
    );
    boolean ready = checks.stream().allMatch(PublishCheckDto::passed);
    return new PublishReadinessDto(taskPackage.taskId(), ready, checks);
  }

  public SchemaRiskReportDto buildSchemaRiskReport(TaskPackageDto taskPackage) {
    List<SchemaRiskFindingDto> findings = taskPackage.schema().components().stream()
        .filter(component -> component.type() == SchemaComponentType.LLM_INTERACTION || component.type() == SchemaComponentType.LONG_TEXT)
        .map(component -> new SchemaRiskFindingDto(
            component.id(),
            component.type() == SchemaComponentType.LLM_INTERACTION ? Severity.LOW : Severity.MEDIUM,
            component.type() == SchemaComponentType.LLM_INTERACTION
                ? "LLM 交互组件需要声明输出字段和采纳记录。"
                : "长文本理由建议配合 Rubric 做引用原文校验。",
            component.type() == SchemaComponentType.LLM_INTERACTION
                ? "增加 outputPath、traceId 和 accepted 字段。"
                : "增加自定义校验或 Rubric 规则，要求引用原文字段。"
        ))
        .toList();

    return new SchemaRiskReportDto(
        taskPackage.taskId(),
        taskPackage.schemaVersionId(),
        findings.stream().anyMatch(finding -> finding.severity() == Severity.MEDIUM) ? Severity.MEDIUM : Severity.LOW,
        findings,
        taskPackage.traceId()
    );
  }

  public DatasetProfileReportDto profileDataset(TaskPackageDto taskPackage) {
    long emptyFieldCount = taskPackage.sampleItems().stream()
        .flatMap(item -> item.rawPayload().values().stream())
        .filter(value -> value == null || value.toString().isBlank())
        .count();

    return new DatasetProfileReportDto(
        taskPackage.taskId(),
        taskPackage.sampleItems().size(),
        Math.toIntExact(emptyFieldCount),
        0,
        taskPackage.sampleItems().size() < 20
            ? List.of("样本量较小，发布前建议至少抽样 20 条生成画像。")
            : List.of(),
        taskPackage.traceId()
    );
  }

  public InstructionBundleDto getInstructionBundle() {
    TaskPackageDto taskPackage = getMockTaskPackage();
    return new InstructionBundleDto(
        taskPackage.instructionVersionId(),
        taskPackage.taskId(),
        "请根据原始评论判断用户主要意图，必须引用原文关键词说明依据。遇到退款、物流、客服等多问题场景时，可多选问题类型，但主要意图只能选择一个。",
        List.of("原文包含'退款不到账'，主要意图选择'售后'，问题类型选择'退款'和'客服'。"),
        List.of("原文只是表达满意，却选择'投诉'。"),
        taskPackage.rubric().rules().stream().map(RubricRuleDto::description).toList(),
        taskPackage.traceId()
    );
  }

  public DataItemViewDto nextDataItem() {
    return getMockTaskPackage().sampleItems().getFirst();
  }

  public DatasetImportPreviewDto previewDatasetImport(String taskId) {
    return new DatasetImportPreviewDto(
        "dataset_reviews_001",
        taskId,
        List.of("json", "jsonl", "xlsx", "csv"),
        List.of(
            new DatasetFieldProfileDto("comment", "string", 0, "$.raw.comment", "退款申请三天了还不到账，客服也没人回复。"),
            new DatasetFieldProfileDto("orderId", "string", 0.12, "$.raw.orderId", "ORD-10001"),
            new DatasetFieldProfileDto("channel", "string", 0, "$.raw.channel", "mobile-app")
        ),
        List.of(new RejectedRowDto(17, "comment 字段为空，无法生成展示题面")),
        "trace_import_preview_" + taskId
    );
  }

  private SchemaComponentDto component(
      String id,
      SchemaComponentType type,
      String label,
      String dataPath,
      boolean required
  ) {
    return component(id, type, label, dataPath, required, Map.of(), required ? required(label + "不能为空") : List.of());
  }

  private SchemaComponentDto component(
      String id,
      SchemaComponentType type,
      String label,
      String dataPath,
      boolean required,
      Map<String, Object> props,
      List<ValidationRuleDto> validation
  ) {
    return new SchemaComponentDto(
        id,
        type,
        label,
        dataPath,
        required,
        props,
        validation,
        null,
        null,
        null
    );
  }

  private List<ValidationRuleDto> required(String message) {
    return List.of(new ValidationRuleDto("required", true, message));
  }

  private PublishCheckDto check(String name, boolean passed, String message) {
    return new PublishCheckDto(name, passed, passed ? "ok" : message);
  }
}
