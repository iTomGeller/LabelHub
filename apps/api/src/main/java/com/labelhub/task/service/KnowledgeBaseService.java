package com.labelhub.task.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class KnowledgeBaseService {
    private static final Logger log = LoggerFactory.getLogger(KnowledgeBaseService.class);
    private static final int CHUNK_SIZE = 500;
    private static final String SEED_RESOURCE = "knowledge/default-knowledge-seeds.json";

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final boolean seedEnabled;

    public KnowledgeBaseService(
        JdbcTemplate jdbc,
        ObjectMapper objectMapper,
        @Value("${labelhub.knowledge.seed-enabled:true}") boolean seedEnabled
    ) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.seedEnabled = seedEnabled;
    }

    public record KnowledgeDocument(String id, String title, String category, String sourceType, String content, int chunkCount, String createdAt) {}
    public record KnowledgeChunk(String id, String documentId, int chunkIndex, String content, String keywords) {}
    public record RetrievalResult(String chunkId, String documentTitle, String category, String excerpt, double score, String source) {}
    public record RetrievalDiagnostic(
        String query, String category, String auditNode, int hitCount,
        List<RetrievalResult> results, String emptyReason, boolean usedFallback
    ) {}
    public record KnowledgeSeedDefinition(String id, String title, String category, String content) {}
    public record SeedInitResult(int inserted, int updated, int skipped, int total) {}

    @PostConstruct
    public void initDefaultSeedsOnStartup() {
        if (!seedEnabled) {
            log.info("Knowledge seed initialization disabled (labelhub.knowledge.seed-enabled=false)");
            return;
        }
        try {
            SeedInitResult result = seedDefaultKnowledge(false);
            log.info("Knowledge seed init: inserted={}, updated={}, skipped={}, total={}",
                result.inserted(), result.updated(), result.skipped(), result.total());
        } catch (Exception e) {
            log.error("Failed to initialize default knowledge seeds: {}", e.getMessage(), e);
        }
    }

    public SeedInitResult seedDefaultKnowledge(boolean forceUpdate) {
        List<KnowledgeSeedDefinition> seeds = loadSeedDefinitions();
        int inserted = 0;
        int updated = 0;
        int skipped = 0;

        for (KnowledgeSeedDefinition seed : seeds) {
            UpsertOutcome outcome = upsertSeedDocument(seed.id(), seed.title(), seed.category(), seed.content(), forceUpdate);
            switch (outcome) {
                case INSERTED -> inserted++;
                case UPDATED -> updated++;
                case SKIPPED -> skipped++;
            }
        }

        return new SeedInitResult(inserted, updated, skipped, seeds.size());
    }

    public KnowledgeDocument uploadDocument(String title, String category, String content) {
        String id = "kdoc_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        insertDocumentWithChunks(id, title, category, "upload", content);
        log.info("Uploaded knowledge document '{}' with {} chunks", title, countChunks(content));
        return new KnowledgeDocument(id, title, category, "upload", content, countChunks(content), new Date().toString());
    }

    public List<KnowledgeDocument> listDocuments() {
        return jdbc.query(
            "SELECT id, title, category, source_type, LEFT(content, 200) as content, chunk_count, created_at FROM knowledge_documents ORDER BY created_at DESC",
            (rs, i) -> new KnowledgeDocument(
                rs.getString("id"), rs.getString("title"), rs.getString("category"),
                rs.getString("source_type"), rs.getString("content"),
                rs.getInt("chunk_count"), rs.getString("created_at")
            )
        );
    }

    public List<RetrievalResult> retrieve(String query, String auditNode, int topK) {
        return retrieveWithDiagnostics(query, auditNode, topK).results();
    }

    public RetrievalDiagnostic retrieveWithDiagnostics(String query, String auditNode, int topK) {
        String category = mapNodeToCategory(auditNode);
        List<RetrievalResult> results = scoreChunks(query, category, topK);
        boolean usedFallback = false;

        if (results.isEmpty() && category != null) {
            results = scoreChunks(query, null, topK);
            usedFallback = !results.isEmpty();
        }

        String emptyReason = resolveEmptyReason(query, category, results);
        return new RetrievalDiagnostic(query, category, auditNode, results.size(), results, emptyReason, usedFallback);
    }

    public String buildRagContextForNode(String taskName, String instruction, String auditNode) {
        String query = taskName + " " + instruction;
        RetrievalDiagnostic diagnostic = retrieveWithDiagnostics(query, auditNode, 5);
        if (diagnostic.results().isEmpty()) return "";

        StringBuilder sb = new StringBuilder();
        sb.append("[知识召回 - ").append(auditNode).append("]\n");
        if (diagnostic.usedFallback()) {
            sb.append("- 分类「").append(diagnostic.category()).append("」无命中，已跨分类 fallback\n");
        }
        for (RetrievalResult r : diagnostic.results()) {
            sb.append("- 来源「").append(r.documentTitle()).append("」(").append(r.category()).append(", score=")
              .append(String.format("%.2f", r.score())).append("): ").append(r.excerpt()).append("\n");
        }
        return sb.toString();
    }

    public Map<String, Object> buildRagInfoMap(String taskName, String instruction, String auditNode, long durationMs) {
        String query = taskName + " " + instruction;
        RetrievalDiagnostic diagnostic = retrieveWithDiagnostics(query, auditNode, 5);
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("source", "knowledge_base");
        info.put("durationMs", durationMs);
        info.put("query", query);
        info.put("category", diagnostic.category() != null ? diagnostic.category() : "全部");
        info.put("usedFallback", diagnostic.usedFallback());
        if (diagnostic.results().isEmpty()) {
            info.put("hasContent", false);
            info.put("charCount", 0);
            info.put("hitCount", 0);
            info.put("emptyReason", diagnostic.emptyReason());
            return info;
        }
        String context = buildRagContextForNode(taskName, instruction, auditNode);
        info.put("hasContent", true);
        info.put("charCount", context.length());
        info.put("hitCount", diagnostic.hitCount());
        info.put("emptyReason", "");
        info.put("context", context.length() > 300 ? context.substring(0, 300) + "…" : context);
        info.put("retrievedChunks", diagnostic.results().stream()
            .map(r -> Map.of("title", r.documentTitle(), "category", r.category(), "score", r.score(), "excerpt", r.excerpt()))
            .toList());
        return info;
    }

    private List<RetrievalResult> scoreChunks(String query, String categoryFilter, int topK) {
        List<String> queryTerms = tokenize(query);
        if (queryTerms.isEmpty()) return List.of();

        String sql = categoryFilter != null
            ? "SELECT kc.id, kc.content, kc.keywords, kd.title, kd.category FROM knowledge_chunks kc JOIN knowledge_documents kd ON kc.document_id = kd.id WHERE kd.category = ?"
            : "SELECT kc.id, kc.content, kc.keywords, kd.title, kd.category FROM knowledge_chunks kc JOIN knowledge_documents kd ON kc.document_id = kd.id";

        List<Map<String, Object>> rows = categoryFilter != null
            ? jdbc.queryForList(sql, categoryFilter)
            : jdbc.queryForList(sql);

        List<RetrievalResult> allResults = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String chunkContent = (String) row.get("content");
            String keywords = (String) row.get("keywords");
            String docTitle = (String) row.get("title");
            String category = (String) row.get("category");
            String chunkId = (String) row.get("id");

            double score = computeBM25Score(queryTerms, chunkContent, keywords);
            if (score > 0.08) {
                String excerpt = chunkContent.length() > 200 ? chunkContent.substring(0, 200) + "…" : chunkContent;
                allResults.add(new RetrievalResult(chunkId, docTitle, category, excerpt, score, docTitle));
            }
        }

        allResults.sort((a, b) -> Double.compare(b.score(), a.score()));
        return allResults.stream().limit(topK).toList();
    }

    private String resolveEmptyReason(String query, String category, List<RetrievalResult> results) {
        if (!results.isEmpty()) return "";
        Integer docCount = jdbc.queryForObject("SELECT COUNT(*) FROM knowledge_documents", Integer.class);
        if (docCount == null || docCount == 0) {
            return "知识库为空，尚未上传或初始化默认知识种子";
        }
        if (category != null) {
            Integer catCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM knowledge_documents WHERE category = ?",
                Integer.class,
                category
            );
            if (catCount == null || catCount == 0) {
                return "分类「" + category + "」下无文档";
            }
        }
        if (query == null || query.isBlank()) {
            return "检索 query 为空";
        }
        return "有文档但相关度分数过低，query 与现有 chunk 匹配不足";
    }

    private enum UpsertOutcome { INSERTED, UPDATED, SKIPPED }

    private UpsertOutcome upsertSeedDocument(String id, String title, String category, String content, boolean forceUpdate) {
        Integer existing = jdbc.queryForObject(
            "SELECT COUNT(*) FROM knowledge_documents WHERE id = ?",
            Integer.class,
            id
        );

        if (existing != null && existing > 0) {
            if (!forceUpdate) {
                return UpsertOutcome.SKIPPED;
            }
            String storedContent = jdbc.queryForObject(
                "SELECT content FROM knowledge_documents WHERE id = ?",
                String.class,
                id
            );
            if (content.equals(storedContent)) {
                return UpsertOutcome.SKIPPED;
            }
            jdbc.update("DELETE FROM knowledge_chunks WHERE document_id = ?", id);
            jdbc.update(
                "UPDATE knowledge_documents SET title = ?, category = ?, source_type = 'seed', content = ?, chunk_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                title, category, content, countChunks(content), id
            );
            insertChunks(id, content);
            log.info("Updated knowledge seed '{}'", title);
            return UpsertOutcome.UPDATED;
        }

        insertDocumentWithChunks(id, title, category, "seed", content);
        log.info("Inserted knowledge seed '{}'", title);
        return UpsertOutcome.INSERTED;
    }

    private void insertDocumentWithChunks(String id, String title, String category, String sourceType, String content) {
        List<String> chunks = splitIntoChunks(content);
        jdbc.update(
            "INSERT INTO knowledge_documents (id, title, category, source_type, content, chunk_count) VALUES (?, ?, ?, ?, ?, ?)",
            id, title, category, sourceType, content, chunks.size()
        );
        insertChunks(id, content);
    }

    private void insertChunks(String documentId, String content) {
        List<String> chunks = splitIntoChunks(content);
        for (int i = 0; i < chunks.size(); i++) {
            String chunkId = documentId + "_c" + i;
            String keywords = extractKeywords(chunks.get(i));
            jdbc.update(
                "INSERT INTO knowledge_chunks (id, document_id, chunk_index, content, keywords) VALUES (?, ?, ?, ?, ?)",
                chunkId, documentId, i, chunks.get(i), keywords
            );
        }
    }

    private int countChunks(String content) {
        return splitIntoChunks(content).size();
    }

    private List<KnowledgeSeedDefinition> loadSeedDefinitions() {
        try (InputStream input = new ClassPathResource(SEED_RESOURCE).getInputStream()) {
            return objectMapper.readValue(input, new TypeReference<List<KnowledgeSeedDefinition>>() {});
        } catch (IOException e) {
            throw new IllegalStateException("Failed to load knowledge seeds from " + SEED_RESOURCE, e);
        }
    }

    private String mapNodeToCategory(String auditNode) {
        if (auditNode == null) return null;
        return switch (auditNode) {
            case "task_context" -> "标注规范";
            case "dataset_sampler" -> "数据规范";
            case "schema_generator" -> "模板规范";
            case "rubric_generator" -> "质检规则";
            case "critic" -> "项目要求";
            case "task_package_writer" -> "契约规范";
            default -> null;
        };
    }

    private double computeBM25Score(List<String> queryTerms, String content, String keywords) {
        String combined = (content + " " + (keywords != null ? keywords : "")).toLowerCase();
        double score = 0;
        for (String term : queryTerms) {
            int tf = countOccurrences(combined, term);
            if (tf > 0) {
                score += (tf * 2.0) / (tf + 1.5);
            }
        }
        return score / Math.max(queryTerms.size(), 1);
    }

    private int countOccurrences(String text, String term) {
        int count = 0, idx = 0;
        while ((idx = text.indexOf(term, idx)) != -1) { count++; idx += term.length(); }
        return count;
    }

    private List<String> tokenize(String text) {
        if (text == null || text.isBlank()) return List.of();
        LinkedHashSet<String> terms = new LinkedHashSet<>();
        for (String part : text.toLowerCase().split("[\\s,;，；。！？、（）()/]+")) {
            if (part.length() >= 2) terms.add(part);
            terms.addAll(chineseBigrams(part));
        }
        terms.addAll(chineseBigrams(text.toLowerCase()));
        return terms.stream().filter(t -> t.length() >= 2).toList();
    }

    private List<String> chineseBigrams(String text) {
        if (text == null || text.isBlank()) return List.of();
        List<String> bigrams = new ArrayList<>();
        StringBuilder cjk = new StringBuilder();
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (Character.UnicodeScript.of(c) == Character.UnicodeScript.HAN) {
                cjk.append(c);
            } else if (!cjk.isEmpty()) {
                appendBigrams(cjk.toString(), bigrams);
                cjk.setLength(0);
            }
        }
        if (!cjk.isEmpty()) appendBigrams(cjk.toString(), bigrams);
        return bigrams;
    }

    private void appendBigrams(String segment, List<String> bigrams) {
        if (segment.length() <= 2) {
            if (segment.length() >= 2) bigrams.add(segment);
            return;
        }
        for (int i = 0; i < segment.length() - 1; i++) {
            bigrams.add(segment.substring(i, i + 2));
        }
        if (segment.length() >= 4) {
            bigrams.add(segment.substring(0, Math.min(6, segment.length())));
        }
    }

    private String extractKeywords(String text) {
        return tokenize(text).stream().limit(40).collect(Collectors.joining(","));
    }

    private List<String> splitIntoChunks(String content) {
        List<String> chunks = new ArrayList<>();
        String[] paragraphs = content.split("\n\n+");
        StringBuilder current = new StringBuilder();
        for (String para : paragraphs) {
            if (current.length() + para.length() > CHUNK_SIZE && !current.isEmpty()) {
                chunks.add(current.toString().trim());
                current = new StringBuilder();
            }
            current.append(para).append("\n\n");
        }
        if (!current.isEmpty()) chunks.add(current.toString().trim());
        if (chunks.isEmpty()) chunks.add(content);
        return chunks;
    }
}
