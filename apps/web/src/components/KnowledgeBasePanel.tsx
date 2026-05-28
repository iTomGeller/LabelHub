"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

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

function formatDate(iso: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}

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
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("全部");

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/agent-api/agents/knowledge-documents");
      if (res.ok) setDocuments(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const usedCategories = useMemo(() => {
    const set = new Set(documents.map((d) => d.category));
    return CATEGORIES.filter((c) => set.has(c)).concat([...set].filter((c) => !CATEGORIES.includes(c)));
  }, [documents]);

  const totalChunks = useMemo(() => documents.reduce((s, d) => s + d.chunkCount, 0), [documents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      if (catFilter !== "全部" && d.category !== catFilter) return false;
      if (!q) return true;
      return d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q);
    });
  }, [documents, search, catFilter]);

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
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-primary">知识库管理</h3>
          <p className="text-xs text-ink/50">
            共 {documents.length} 篇 · {totalChunks} chunks · {usedCategories.length} 个分类
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            placeholder="搜索标题或内容"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-primary/15 px-3 py-1.5 text-sm w-56"
            data-testid="knowledge-search"
          />
          <button onClick={() => setShowUpload(!showUpload)} className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent/90">
            {showUpload ? "取消" : "上传文档"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {["全部", ...usedCategories].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCatFilter(c)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${catFilter === c ? "bg-accent text-white" : "bg-surface text-ink/60"}`}
          >
            {c}
          </button>
        ))}
      </div>

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

      <div>
        {loading && <p className="text-sm text-ink/40">加载中…</p>}
        {!loading && documents.length === 0 && <p className="text-sm text-ink/40">暂无知识库文档，上传后 AI 审核时将动态召回</p>}
        {!loading && documents.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-ink/40">没有匹配的文档，试试调整搜索或分类筛选</p>
        )}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((doc) => (
            <article
              key={doc.id}
              className="rounded-2xl border border-primary/10 bg-white p-4 hover:border-accent/30 transition flex flex-col gap-3"
              data-testid="knowledge-card"
            >
              <header className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-bold text-primary leading-snug line-clamp-2">{doc.title}</h4>
                <span className="shrink-0 text-[10px] rounded border border-accent/20 bg-accent/5 text-accent px-2 py-0.5">{doc.category}</span>
              </header>
              <p className="text-xs text-ink/60 line-clamp-3 leading-relaxed flex-1">{doc.content}</p>
              <footer className="flex items-center justify-between text-[10px] text-ink/40 pt-2 border-t border-primary/5">
                <span>{doc.chunkCount} chunks · {doc.sourceType}</span>
                <time>{formatDate(doc.createdAt)}</time>
              </footer>
            </article>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-primary/10 bg-white p-4 space-y-3">
        <h4 className="text-sm font-bold text-primary">测试召回</h4>
        <div className="flex gap-2">
          <input value={testQuery} onChange={e => setTestQuery(e.target.value)} placeholder="输入查询关键词" className="flex-1 rounded-lg border border-primary/15 px-3 py-2 text-sm" />
          <button onClick={handleTestRetrieve} className="rounded-lg bg-accent/10 text-accent px-3 py-2 text-sm font-bold hover:bg-accent/20">检索</button>
        </div>
        {testResults.length > 0 && (
          <div className="grid gap-2 md:grid-cols-2">
            {testResults.map((r, i) => (
              <div key={i} className="rounded-xl border border-primary/10 bg-white p-3 text-xs">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-bold text-primary truncate">{r.documentTitle}</span>
                  <span className="text-[10px] text-ink/40 shrink-0">{(r.score * 100).toFixed(0)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface overflow-hidden mb-2">
                  <div className="h-full bg-accent rounded-full" style={{ width: `${Math.min(100, r.score * 100)}%` }} />
                </div>
                <p className="text-ink/60 line-clamp-2">{r.excerpt}</p>
                {r.chunkId && <p className="text-[10px] text-ink/30 mt-1 font-mono truncate">{r.chunkId}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
