"""线上用户路径与产品级验收（HTML + API）。"""
import io
import json
import re
import sys
import urllib.request

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

BASE = "http://8.146.231.216"
TASK_ID = "task_text_cls_001"
STALE_GRAFANA_MARKERS = [
    "LabelHub Agent 级监控",
    "RAG 命中率 (全 Agent)",
]
GRAFANA_UID = "labelhub-agent-rag-trace"
GRAFANA_SLUG_PATH = f"/grafana/d/{GRAFANA_UID}/labelhub-agent-diagnostic"

SENTIMENT_TERMS = ["情感倾向", "触发关键句", "判断理由", "正面", "负面", "中性"]


def fetch(path, method="GET", body=None, timeout=60):
    url = BASE + path if path.startswith("/") else path
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read().decode("utf-8", errors="replace")


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
            raise AssertionError(f"stale panel {bad!r}")
    return f"title={title}"


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
    if len(nodes) < 6:
        raise AssertionError(f"expected 6 nodes, got {len(nodes)}")

    rag_hits = 0
    blob = json.dumps(nodes, ensure_ascii=False)
    for node in nodes:
        rag = ((node.get("details") or {}).get("calls") or {}).get("rag") or {}
        if rag.get("hasContent"):
            rag_hits += 1
        details_blob = json.dumps(node.get("details") or {}, ensure_ascii=False)
        if "exitCode 0" in details_blob and "无额外发现" in details_blob and len(details_blob) < 120:
            raise AssertionError(f"node {node.get('nodeKey')} only has technical noise")

    if rag_hits < 3:
        raise AssertionError(f"expected >=3 RAG hits, got {rag_hits}")

    matched = sum(1 for t in SENTIMENT_TERMS if t in blob)
    if matched < 4:
        raise AssertionError(f"expected business terms in output, matched {matched}")

    return f"traceId={data.get('traceId')}, ragHits={rag_hits}, terms={matched}"


def check_web_publish_task_text_cls():
    _, html = fetch(f"/?view=task&taskId={TASK_ID}&step=publish")
    if "开始审核" in html and "AI 质量审核" not in html:
        raise AssertionError("publish page stuck at start audit only")
    if "AI 质量审核" not in html:
        raise AssertionError("missing publish audit section")
    if "knowledge_base" in html.lower():
        raise AssertionError("default UI exposes knowledge_base")
    if "exitCode" in html:
        raise AssertionError("default UI exposes exitCode")
    node_count = len(re.findall(r"task_description|sample_data|annotation_template|quality_rules|comprehensive_assessment|publish_readiness", html))
    return f"publish page ok, nodeRefs={node_count}"


def check_trace_page():
    status, html = fetch("/?view=trace")
    if status != 200:
        raise AssertionError(f"trace page HTTP {status}")
    if "Trace" not in html:
        raise AssertionError("missing trace view")
    return "trace page ok"


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
    run("task_text_cls_001 audit semantic", check_task_text_cls_audit)
    run("web publish task_text_cls_001", check_web_publish_task_text_cls)
    run("trace page", check_trace_page)

    print(f"\n产品验收: {sum(checks)}/{len(checks)} 通过")
    sys.exit(0 if all(checks) else 1)


if __name__ == "__main__":
    main()
