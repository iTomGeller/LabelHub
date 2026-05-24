package com.labelhub.task.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class KnowledgeBaseService {
    private static final Logger log = LoggerFactory.getLogger(KnowledgeBaseService.class);
    private static final int CHUNK_SIZE = 500;

    private final JdbcTemplate jdbc;

    public KnowledgeBaseService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record KnowledgeDocument(String id, String title, String category, String sourceType, String content, int chunkCount, String createdAt) {}
    public record KnowledgeChunk(String id, String documentId, int chunkIndex, String content, String keywords) {}
    public record RetrievalResult(String chunkId, String documentTitle, String category, String excerpt, double score, String source) {}

    public KnowledgeDocument uploadDocument(String title, String category, String content) {
        String id = "kdoc_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        List<String> chunks = splitIntoChunks(content);

        jdbc.update(
            "INSERT INTO knowledge_documents (id, title, category, source_type, content, chunk_count) VALUES (?, ?, ?, 'upload', ?, ?)",
            id, title, category, content, chunks.size()
        );

        for (int i = 0; i < chunks.size(); i++) {
            String chunkId = id + "_c" + i;
            String keywords = extractKeywords(chunks.get(i));
            jdbc.update(
                "INSERT INTO knowledge_chunks (id, document_id, chunk_index, content, keywords) VALUES (?, ?, ?, ?, ?)",
                chunkId, id, i, chunks.get(i), keywords
            );
        }

        log.info("Uploaded knowledge document '{}' with {} chunks", title, chunks.size());
        return new KnowledgeDocument(id, title, category, "upload", content, chunks.size(), new Date().toString());
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
        List<String> queryTerms = tokenize(query);
        if (queryTerms.isEmpty()) return List.of();

        List<RetrievalResult> allResults = new ArrayList<>();

        String categoryFilter = mapNodeToCategory(auditNode);
        String sql = categoryFilter != null
            ? "SELECT kc.id, kc.content, kc.keywords, kd.title, kd.category FROM knowledge_chunks kc JOIN knowledge_documents kd ON kc.document_id = kd.id WHERE kd.category = ?"
            : "SELECT kc.id, kc.content, kc.keywords, kd.title, kd.category FROM knowledge_chunks kc JOIN knowledge_documents kd ON kc.document_id = kd.id";

        List<Map<String, Object>> rows = categoryFilter != null
            ? jdbc.queryForList(sql, categoryFilter)
            : jdbc.queryForList(sql);

        for (Map<String, Object> row : rows) {
            String chunkContent = (String) row.get("content");
            String keywords = (String) row.get("keywords");
            String docTitle = (String) row.get("title");
            String category = (String) row.get("category");
            String chunkId = (String) row.get("id");

            double score = computeBM25Score(queryTerms, chunkContent, keywords);
            if (score > 0.1) {
                String excerpt = chunkContent.length() > 200 ? chunkContent.substring(0, 200) + "…" : chunkContent;
                allResults.add(new RetrievalResult(chunkId, docTitle, category, excerpt, score, docTitle));
            }
        }

        allResults.sort((a, b) -> Double.compare(b.score(), a.score()));
        return allResults.stream().limit(topK).toList();
    }

    public String buildRagContextForNode(String taskName, String instruction, String auditNode) {
        String query = taskName + " " + instruction;
        List<RetrievalResult> results = retrieve(query, auditNode, 5);
        if (results.isEmpty()) return "";

        StringBuilder sb = new StringBuilder();
        sb.append("[知识召回 - ").append(auditNode).append("]\n");
        for (RetrievalResult r : results) {
            sb.append("- 来源「").append(r.documentTitle()).append("」(").append(r.category()).append(", score=")
              .append(String.format("%.2f", r.score())).append("): ").append(r.excerpt()).append("\n");
        }
        return sb.toString();
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
        return Arrays.stream(text.toLowerCase().split("[\\s,;，；。！？、]+"))
            .filter(s -> s.length() >= 2)
            .distinct()
            .collect(Collectors.toList());
    }

    private String extractKeywords(String text) {
        return tokenize(text).stream().limit(20).collect(Collectors.joining(","));
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
