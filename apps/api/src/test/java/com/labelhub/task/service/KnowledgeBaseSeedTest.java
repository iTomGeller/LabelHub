package com.labelhub.task.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

class KnowledgeBaseSeedTest {
  private final ObjectMapper objectMapper = new ObjectMapper();

  @Test
  void defaultSeedCatalogCoversSixAuditCategories() throws Exception {
    List<KnowledgeBaseService.KnowledgeSeedDefinition> seeds = objectMapper.readValue(
        new ClassPathResource("knowledge/default-knowledge-seeds.json").getInputStream(),
        new TypeReference<>() {}
    );

    assertThat(seeds).hasSize(6);
    assertThat(seeds).extracting(KnowledgeBaseService.KnowledgeSeedDefinition::id).doesNotContainNull();
    assertThat(seeds).extracting(KnowledgeBaseService.KnowledgeSeedDefinition::content)
        .allMatch(content -> content != null && content.length() > 100);

    Set<String> categories = seeds.stream()
        .map(KnowledgeBaseService.KnowledgeSeedDefinition::category)
        .collect(Collectors.toSet());

    assertThat(categories).containsExactlyInAnyOrder(
        "标注规范",
        "数据规范",
        "模板规范",
        "质检规则",
        "项目要求",
        "契约规范"
    );
  }

  @Test
  void defaultSeedsIncludeTextClassificationTaskTerms() throws Exception {
    List<KnowledgeBaseService.KnowledgeSeedDefinition> seeds = objectMapper.readValue(
        new ClassPathResource("knowledge/default-knowledge-seeds.json").getInputStream(),
        new TypeReference<>() {}
    );

    String combined = seeds.stream()
        .map(KnowledgeBaseService.KnowledgeSeedDefinition::content)
        .collect(Collectors.joining("\n"));

    assertThat(combined).contains("客服对话情感分类", "情感倾向", "触发关键句", "判断理由");
    assertThat(combined).contains("实体抽取", "问答对质量评估");
  }
}
