"""线上用户路径与产品级验收（HTML + API + Trace 排障契约）。"""
import io
import json
import re
import subprocess
import sys
import urllib.request

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

BASE = "http://8.146.231.216"
TASK_ID = "task_text_cls_001"
STALE_GRAFANA_MARKERS = [
    "LabelHub Agent 级监控",
    "RAG 命中率 (全 Agent)",
    '"label": "Agent"',
    '"agent": "Agent"',
]
GRAFANA_UID = "labelhub-agent-rag-trace"
GRAFANA_SLUG_PATH = f"/grafana/d/{GRAFANA_UID}/labelhub-agent-diagnostic"

SENTIMENT_TERMS = ["情感倾向", "触发关键句", "判断理由", "正面", "负面", "中性"]
REQUIRED_SPAN_FIELDS = [
    "id", "kind", "title", "whyCalled", "inputPreview", "outputPreview",
    "resultSummary", "durationMs", "status", "degradeReason",
]
REQUIRED_AGENT_OUTPUT_FIELDS = [
    "promptPreview", "decisionSteps", "internalGraph", "businessMapping",
]
USER_VIEW_FORBIDDEN = ["Prompt 输入", "knowledge_base", "exitCode", "task_context_builder"]
UI_BUNDLE_MARKERS = [
    "business-conclusion-drawer",
    "agent-trace-drawer",
    "call-io-card",
    "Agent 排障抽屉",
    "knowledge-card",
    "knowledge-search",
]
TECH_EVIDENCE_RE = re.compile(r"^id=.*\stype=.*\spath=", re.I)
COMPONENT_REQUIREMENTS = {"必填", "可选"}
SEVERITY_LABELS = {"高", "中", "低", "未知"}
GRAFANA_REQUIRED_PANELS = ["业务节点 7 天健康", "降级链路"]


def fetch(path, method="GET", body=None, timeout=120):
    url = BASE + path if path.startswith("/") else path
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read().decode("utf-8", errors="replace")


def assert_span_contract(span, node_key):
    missing = [f for f in REQUIRED_SPAN_FIELDS if f not in span]
    if missing:
        raise AssertionError(f"node {node_key} span missing fields: {missing}")
    inp = span.get("inputPreview")
    out = span.get("outputPreview")
    if not isinstance(inp, dict) or not inp:
        raise AssertionError(f"node {node_key} span {span.get('id')} inputPreview empty")
    if not isinstance(out, dict) or not out:
        raise AssertionError(f"node {node_key} span {span.get('id')} outputPreview empty")
    kind = span.get("kind")
    if kind == "rag":
        if not inp.get("query"):
            raise AssertionError(f"rag span missing query on {node_key}")
        if not (out.get("topChunks") or out.get("emptyReason")):
            raise AssertionError(f"rag span missing topChunks/emptyReason on {node_key}")
    if kind in ("tool", "sandbox") and not inp.get("checkTarget"):
        raise AssertionError(f"{kind} span missing checkTarget input on {node_key}")
    if kind == "skill":
        if not inp.get("skillName"):
            raise AssertionError(f"skill span missing skillName input on {node_key}")
        if "findingCount" not in out and "findings" not in out and "status" not in out:
            raise AssertionError(f"skill span missing output fields on {node_key}")
    if kind == "mcp" and not inp.get("server"):
        raise AssertionError(f"mcp span missing server input on {node_key}")


def assert_agent_execution_contract(out, node_id):
    missing = [f for f in REQUIRED_AGENT_OUTPUT_FIELDS if f not in out]
    if missing:
        raise AssertionError(f"agent node {node_id} outputPreview missing: {missing}")
    steps = out.get("decisionSteps") or []
    if not steps:
        raise AssertionError(f"agent node {node_id} decisionSteps empty")
    graph = out.get("internalGraph") or {}
    nodes = graph.get("nodes") or []
    edges = graph.get("edges") or []
    if len(nodes) < 3:
        raise AssertionError(f"agent node {node_id} internalGraph.nodes too few: {len(nodes)}")
    if not edges:
        raise AssertionError(f"agent node {node_id} internalGraph.edges empty")
    types = {n.get("type") for n in nodes}
    for required in ("prompt", "decision", "output"):
        if required not in types:
            raise AssertionError(f"agent node {node_id} missing internal node type {required}")


def _collect_js_chunks(html: str, limit=20):
    return list(dict.fromkeys(re.findall(r"/_next/static/chunks/[^\"']+\.js", html)))[:limit]


def assert_evidence_items_structured(nodes):
    """Fresh audit evidence must not expose raw schema technical strings."""
    tech_strings = 0
    component_ok = 0
    severity_ok = 0
    for node in nodes:
        node_key = node.get("nodeKey")
        details = node.get("details") or {}
        for item in details.get("evidenceItems") or []:
            val = item.get("value")
            if isinstance(val, str) and TECH_EVIDENCE_RE.search(val):
                tech_strings += 1
            if item.get("type") == "component":
                role = item.get("role")
                req = item.get("requirement")
                if not role:
                    raise AssertionError(f"node {node_key} component evidence missing role")
                if req not in COMPONENT_REQUIREMENTS:
                    raise AssertionError(f"node {node_key} component requirement invalid: {req!r}")
                component_ok += 1
            if item.get("type") == "severity":
                label = item.get("label")
                if label not in SEVERITY_LABELS:
                    raise AssertionError(f"node {node_key} severity label not zh: {label!r}")
                severity_ok += 1
    if tech_strings > 0:
        raise AssertionError(f"found {tech_strings} legacy technical evidence value strings")
    return component_ok, severity_ok


def _bundle_markers_from_pages(paths):
    blob = ""
    chunks_total = 0
    for path in paths:
        _, html = fetch(path)
        chunks = _collect_js_chunks(html)
        chunks_total += len(chunks)
        for chunk in chunks:
            _, js = fetch(chunk)
            blob += js
    missing = [m for m in UI_BUNDLE_MARKERS if m not in blob]
    if missing:
        raise AssertionError(f"bundle missing markers: {missing}")
    return len(UI_BUNDLE_MARKERS), chunks_total


def check_ui_bundle_drawer_markers():
    count, chunks = _bundle_markers_from_pages(["/?view=trace", "/?view=settings"])
    return f"markers={count}, chunks={chunks}"


def check_ui_drawer_playwright():
    from pathlib import Path
    root = Path(__file__).resolve().parent.parent
    try:
        proc = subprocess.run(
            ["node", "scripts/ui_drawer_verify.mjs", BASE],
            capture_output=True,
            text=True,
            timeout=180,
            cwd=str(root),
        )
    except FileNotFoundError:
        return "skipped (node not available)"
    out = (proc.stdout or "") + (proc.stderr or "")
    if proc.returncode == 0 and "OK ui drawer smoke" in out:
        return "playwright drawer smoke passed"
    if "SKIP playwright not installed" in out:
        return "skipped (playwright not installed)"
    raise AssertionError(out.strip() or f"exit {proc.returncode}")


def check_grafana_api():
    status, content = fetch(f"/grafana/api/dashboards/uid/{GRAFANA_UID}")
    if status != 200:
        raise AssertionError(f"HTTP {status}")
    payload = json.loads(content)
    dash = payload.get("dashboard") or payload
    title = dash.get("title", "")
    if title != "LabelHub Agent 诊断台":
        raise AssertionError(f"title={title!r}")
    text = json.dumps(dash, ensure_ascii=False)
    for bad in STALE_GRAFANA_MARKERS:
        if bad in text:
            raise AssertionError(f"stale marker {bad!r}")
    if '"label": "智能体"' not in text:
        raise AssertionError('missing variable label 智能体')
    if "全部智能体" not in text:
        raise AssertionError('missing 全部智能体 default text')
    panels = dash.get("panels") or []
    panel_titles = [p.get("title", "") for p in panels]
    for required in GRAFANA_REQUIRED_PANELS:
        if not any(required in t for t in panel_titles):
            raise AssertionError(f"missing grafana panel containing {required!r}")
    return f"title={title}, panels={len(panels)}"


def check_knowledge_seeded():
    status, content = fetch("/agent-api/agents/knowledge-documents")
    if status != 200:
        raise AssertionError(f"HTTP {status}")
    docs = json.loads(content)
    if not docs:
        raise AssertionError("knowledge documents empty")
    categories = {d.get("category") for d in docs}
    if len(categories) < 4:
        raise AssertionError(f"too few categories: {categories}")
    return f"docs={len(docs)}, categories={len(categories)}"


def check_task_text_cls_audit():
    status, content = fetch(
        "/agent-api/agents/audit-runs",
        method="POST",
        body={
            "taskId": TASK_ID,
            "taskName": "客服对话情感分类",
            "instruction": "根据客服对话内容判断用户情感倾向（正面/负面/中性），标注触发情绪的关键句并给出理由。",
            "sampleData": [
                {"dialogue": "你们什么破售后！等了三天没人理！", "sessionId": "CS-20001"},
                {"dialogue": "谢谢客服帮我解决了，态度很好", "sessionId": "CS-20002"},
                {"dialogue": "请问退货地址是哪里？", "sessionId": "CS-20003"},
                {"dialogue": "物流信息一直不更新是怎么回事", "sessionId": "CS-20004"},
                {"dialogue": "非常满意这次的处理速度！五星好评", "sessionId": "CS-20005"},
            ],
            "schemaComponents": [
                {"id": "sentiment", "type": "singleChoice", "label": "情感倾向", "dataPath": "$.annotation.sentiment", "required": True, "validation": []},
                {"id": "trigger_sentence", "type": "shortText", "label": "触发关键句", "dataPath": "$.annotation.trigger", "required": True, "validation": []},
                {"id": "reason", "type": "longText", "label": "判断理由", "dataPath": "$.annotation.reason", "required": True, "validation": []},
            ],
            "rubricRules": [
                {"ruleId": "R1", "description": "情感标注须与对话语气一致，不得臆测", "severity": "high"},
                {"ruleId": "R2", "description": "触发关键句必须是原文直接引用", "severity": "medium"},
            ],
            "rubricDimensions": ["情感准确性", "关键句引用", "理由充分性"],
            "forceRun": True,
        },
    )
    if status != 200:
        raise AssertionError(f"HTTP {status}")
    data = json.loads(content)
    nodes = data.get("businessDag") or []
    dev_nodes = data.get("developerDag") or []
    if len(nodes) < 6:
        raise AssertionError(f"expected 6 nodes, got {len(nodes)}")

    rag_hits = 0
    span_total = 0
    skill_spans = 0
    blob = json.dumps(nodes, ensure_ascii=False)
    for node in nodes:
        node_key = node.get("nodeKey")
        details = node.get("details") or {}
        user_summary = details.get("userSummary") or {}
        for field in ("verdict", "conclusion", "nextStep"):
            if field not in user_summary:
                raise AssertionError(f"node {node_key} userSummary missing {field}")
        calls = details.get("calls") or {}
        rag = calls.get("rag") or {}
        if rag.get("hasContent"):
            rag_hits += 1
        spans = calls.get("spans") or []
        if not spans:
            raise AssertionError(f"node {node_key} missing calls.spans")
        for span in spans:
            assert_span_contract(span, node_key)
            span_total += 1
            if span.get("kind") == "skill":
                skill_spans += 1

    agent_exec = 0
    for tn in dev_nodes:
        if tn.get("type") != "agent_execution":
            continue
        agent_exec += 1
        inp = tn.get("inputPreview")
        out = tn.get("outputPreview")
        if not inp or not out:
            raise AssertionError(f"trace node {tn.get('id')} missing input/output preview")
        assert_agent_execution_contract(out, tn.get("id"))

    if agent_exec < 6:
        raise AssertionError(f"expected 6 agent_execution nodes, got {agent_exec}")

    if rag_hits < 3:
        raise AssertionError(f"expected >=3 RAG hits, got {rag_hits}")

    matched = sum(1 for t in SENTIMENT_TERMS if t in blob)
    if matched < 4:
        raise AssertionError(f"expected business terms in output, matched {matched}")

    if skill_spans < 1:
        raise AssertionError(f"expected >=1 skill span with io, got {skill_spans}")

    comp_ev, sev_ev = assert_evidence_items_structured(nodes)

    trace_id = data.get("traceId")
    return f"traceId={trace_id}, ragHits={rag_hits}, spans={span_total}, skillSpans={skill_spans}, terms={matched}, componentEvidence={comp_ev}, severityEvidence={sev_ev}"


def check_web_publish_task_text_cls():
    _, html = fetch(f"/?view=task&taskId={TASK_ID}&step=publish")
    if "开始审核" in html and "AI 质量审核" not in html:
        raise AssertionError("publish page stuck at start audit only")
    if "AI 质量审核" not in html:
        raise AssertionError("missing publish audit section")
    for forbidden in USER_VIEW_FORBIDDEN:
        if forbidden in html:
            raise AssertionError(f"user view exposes forbidden {forbidden!r}")
    if "knowledge_base" in html.lower():
        raise AssertionError("default UI exposes knowledge_base")
    if "exitCode" in html:
        raise AssertionError("default UI exposes exitCode")
    node_count = len(re.findall(r"task_description|sample_data|annotation_template|quality_rules|comprehensive_assessment|publish_readiness", html))
    return f"publish page ok (SSR), nodeRefs={node_count}; userSummary validated via audit API"


def check_trace_page():
    status, html = fetch("/?view=trace")
    if status != 200:
        raise AssertionError(f"trace page HTTP {status}")
    if "Trace" not in html and "trace" not in html.lower():
        raise AssertionError("missing trace view route")
    return "trace page route ok (dev canvas validated via trace detail API)"


def check_trace_detail_api():
    status, runs_raw = fetch("/agent-api/agents/audit-runs/recent?limit=1")
    if status != 200:
        raise AssertionError(f"recent runs HTTP {status}")
    runs = json.loads(runs_raw)
    if not runs:
        return "no recent trace to inspect"
    trace_id = runs[0].get("trace_id")
    status, raw = fetch(f"/agent-api/agents/audit-runs/{trace_id}")
    if status != 200:
        raise AssertionError(f"trace detail HTTP {status}")
    data = json.loads(raw)
    dev = data.get("developerDag") or []
    if not dev:
        raise AssertionError("developerDag empty")
    io_ok = 0
    span_io = 0
    graph_ok = 0
    dev_markers = 0
    for tn in dev:
        if tn.get("type") != "agent_execution":
            continue
        out = tn.get("outputPreview") or {}
        if tn.get("inputPreview") and out:
            io_ok += 1
        try:
            assert_agent_execution_contract(out, tn.get("id"))
            graph_ok += 1
            if out.get("promptPreview") and out.get("decisionSteps") and out.get("internalGraph"):
                dev_markers += 1
        except AssertionError:
            pass
        calls = out.get("calls") or {}
        for span in calls.get("spans") or []:
            if span.get("inputPreview") and span.get("outputPreview"):
                span_io += 1
    if io_ok < 6:
        raise AssertionError(f"expected 6 agent input/output previews, got {io_ok}")
    if graph_ok < 6:
        raise AssertionError(f"expected 6 agent internalGraph contracts, got {graph_ok}")
    if dev_markers < 6:
        raise AssertionError(f"expected 6 agent dev canvas fields, got {dev_markers}")
    if span_io < 10:
        raise AssertionError(f"expected >=10 span io previews, got {span_io}")
    return f"traceId={trace_id}, agentIo={io_ok}, graphOk={graph_ok}, devMarkers={dev_markers}, spanIo={span_io}"


def main():
    checks = []

    def run(name, fn):
        try:
            detail = fn()
            print(f"OK  {name}: {detail}")
            checks.append(True)
        except Exception as e:
            print(f"FAIL {name}: {e}")
            checks.append(False)

    run("grafana api diagnostic", check_grafana_api)
    run("knowledge seeded", check_knowledge_seeded)
    run("task_text_cls_001 audit semantic + spans + graph", check_task_text_cls_audit)
    run("web publish task_text_cls_001 user view", check_web_publish_task_text_cls)
    run("trace page dev view", check_trace_page)
    run("trace detail io + internalGraph api", check_trace_detail_api)
    run("ui bundle drawer markers", check_ui_bundle_drawer_markers)
    run("ui drawer playwright smoke", check_ui_drawer_playwright)

    print(f"\n产品验收: {sum(checks)}/{len(checks)} 通过")
    sys.exit(0 if all(checks) else 1)


if __name__ == "__main__":
    main()
