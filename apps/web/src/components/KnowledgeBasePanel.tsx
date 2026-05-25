"use client";

import { useState, useEffect, useCallback } from "react";

interface KnowledgeDoc {
  id: string;
  title: string;
  category: string;
  sourceType: string;
  content: string;
  chunkCount: number;
  createdAt: string;
}

const CATEGORIES = ["标注规范", "数据规范", "模板规范", "质检规则", "契约规范", "项目要求", "通用"];

export function KnowledgeBasePanel() {
  const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("通用");
  const [content, setContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [testQuery, setTestQuery] = useState("");
  const [testResults, setTestResults] = useState<{ chunkId: string; documentTitle: string; excerpt: string; score: number }[]>([]);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/agent-api/agents/knowledge-documents");
      if (res.ok) setDocuments(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  async function handleUpload() {
    if (!title.trim() || !content.trim()) return;
    setUploading(true);
    try {
      const res = await fetch("/agent-api/agents/knowledge-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, content }),
      });
      if (res.ok) {
        setShowUpload(false);
        setTitle("");
        setContent("");
        loadDocuments();
      }
    } catch { /* ignore */ }
    finally { setUploading(false); }
  }

  async function handleTestRetrieve() {
    if (!testQuery.trim()) return;
    try {
      const res = await fetch("/agent-api/agents/knowledge-documents/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: testQuery, topK: 5 }),
      });
      if (res.ok) setTestResults(await res.json());
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between min-w-0">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-primary">知识库管理</h3>
          <p className="text-xs text-ink/50">上传标注规范、业务词表、质量规则等文档，AI 审核时动态召回相关知识</p>
        </div>
        <button onClick={() => setShowUpload(!showUpload)} className="shrink-0 self-start rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent/90">
          {showUpload ? "取消" : "上传文档"}
        </button>
      </div>

      {/* Upload Form */}
      {showUpload && (
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 space-y-3">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="文档标题" className="w-full rounded-lg border border-primary/15 px-3 py-2 text-sm" />
          <select value={category} onChange={e => setCategory(e.target.value)} className="rounded-lg border border-primary/15 px-3 py-2 text-sm">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="文档内容（支持 Markdown）" rows={6} className="w-full rounded-lg border border-primary/15 px-3 py-2 text-sm font-mono" />
          <button onClick={handleUpload} disabled={uploading || !title.trim() || !content.trim()} className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent/90 disabled:opacity-50">
            {uploading ? "上传中…" : "确认上传"}
          </button>
        </div>
      )}

      {/* Document List */}
      <div className="space-y-2">
        {loading && <p className="text-sm text-ink/40">加载中…</p>}
        {!loading && documents.length === 0 && <p className="text-sm text-ink/40">暂无知识库文档，上传后 AI 审核时将动态召回</p>}
        {documents.map(doc => (
          <div key={doc.id} className="rounded-xl border border-primary/10 bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-[10px] bg-accent/5 text-accent border border-accent/10 rounded px-2 py-0.5">{doc.category}</span>
              <span className="text-sm font-bold text-primary">{doc.title}</span>
              <span className="ml-auto text-[10px] text-ink/30">{doc.chunkCount} chunks</span>
            </div>
            <p className="mt-1 text-xs text-ink/50 truncate">{doc.content}</p>
          </div>
        ))}
      </div>

      {/* Test Retrieval */}
      <div className="rounded-xl border border-primary/10 bg-white p-4 space-y-3">
        <h4 className="text-sm font-bold text-primary">测试召回</h4>
        <div className="flex gap-2">
          <input value={testQuery} onChange={e => setTestQuery(e.target.value)} placeholder="输入查询关键词" className="flex-1 rounded-lg border border-primary/15 px-3 py-2 text-sm" />
          <button onClick={handleTestRetrieve} className="rounded-lg bg-accent/10 text-accent px-3 py-2 text-sm font-bold hover:bg-accent/20">检索</button>
        </div>
        {testResults.length > 0 && (
          <div className="space-y-2">
            {testResults.map((r, i) => (
              <div key={i} className="rounded-lg bg-surface/60 px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-primary">{r.documentTitle}</span>
                  <span className="text-ink/30">score: {r.score.toFixed(2)}</span>
                </div>
                <p className="mt-1 text-ink/60">{r.excerpt}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
