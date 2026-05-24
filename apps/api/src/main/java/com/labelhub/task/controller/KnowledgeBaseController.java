package com.labelhub.task.controller;

import com.labelhub.task.service.KnowledgeBaseService;
import com.labelhub.task.service.KnowledgeBaseService.KnowledgeDocument;
import com.labelhub.task.service.KnowledgeBaseService.RetrievalResult;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/agents/knowledge-documents")
public class KnowledgeBaseController {

    private final KnowledgeBaseService knowledgeBaseService;

    public KnowledgeBaseController(KnowledgeBaseService knowledgeBaseService) {
        this.knowledgeBaseService = knowledgeBaseService;
    }

    public record UploadRequest(String title, String category, String content) {}

    @PostMapping
    public ResponseEntity<KnowledgeDocument> uploadDocument(@RequestBody UploadRequest request) {
        if (request.title() == null || request.title().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        if (request.content() == null || request.content().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        String category = request.category() != null ? request.category() : "通用";
        var doc = knowledgeBaseService.uploadDocument(request.title(), category, request.content());
        return ResponseEntity.ok(doc);
    }

    @GetMapping
    public ResponseEntity<List<KnowledgeDocument>> listDocuments() {
        return ResponseEntity.ok(knowledgeBaseService.listDocuments());
    }

    public record RetrieveRequest(String query, String auditNode, Integer topK) {}

    @PostMapping("/retrieve")
    public ResponseEntity<List<RetrievalResult>> testRetrieve(@RequestBody RetrieveRequest request) {
        int topK = request.topK() != null ? request.topK() : 5;
        var results = knowledgeBaseService.retrieve(
            request.query() != null ? request.query() : "",
            request.auditNode(),
            topK
        );
        return ResponseEntity.ok(results);
    }
}
