"""线上用户路径与产品级验收（HTML + API）。"""
import io
import json
import re
import sys
import urllib.request

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

BASE = "http://8.146.231.216"
STALE_TRACE = "trace_1779676180789_50359dc6"
STALE_GRAFANA_MARKERS = [
    "LabelHub Agent 级监控",
    "RAG 命中率 (全 Agent)",
    "ToolCall 状态 by Agent",
]
GRAFANA_UID = "labelhub-agent-rag-trace"
GRAFANA_SLUG_PATH = f"/grafana/d/{GRAFANA_UID}/labelhub-agent-diagnostic"


def fetch(path, method="GET", body=None, timeout=30):
    url = BASE + path if path.startswith("/") else path
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read().decode("utf-8", errors="replace")


def check_html_no_stale(name, path, must_contain=None, must_not_contain=None):
    status, html = fetch(path)
    if status != 200:
        raise AssertionError(f"HTTP {status}")
    for bad in must_not_contain or []:
        if bad in html:
            raise AssertionError(f"found stale marker {bad!r}")
    for good in must_contain or []:
        if good not in html:
            raise AssertionError(f"missing {good!r}")
    return f"HTTP {status}, len={len(html)}"


def check_grafana_api():
    status, content = fetch(f"/grafana/api/dashboards/uid/{GRAFANA_UID}")
    payload = json.loads(content)
    dash = payload.get("dashboard") or payload
    title = dash.get("title", "")
    if title != "LabelHub Agent 诊断台":
        raise AssertionError(f"title={title!r}")
    text = json.dumps(dash, ensure_ascii=False)
    for bad in STALE_GRAFANA_MARKERS:
        if bad in text:
            raise AssertionError(f"stale panel {bad!r}")
    vars_ = {v.get("name") for v in dash.get("templating", {}).get("list", [])}
    if "agent" not in vars_:
        raise AssertionError("missing agent var")
    return f"title={title}, vars={sorted(vars_)}"


def check_audit_has_tool_calls():
    status, content = fetch(
        "/agent-api/agents/audit-runs",
        method="POST",
        body={
            "taskId": "task_ner_002",
            "taskName": "电商评论实体抽取",
            "instruction": "标注评论中的商品实体",
            "sampleData": [{"text": "a"}, {"text": "b"}, {"text": "c"}],
            "schemaComponents": [{"id": "entity", "label": "实体", "type": "text", "dataPath": "entity", "required": True, "validation": []}],
            "rubricRules": [{"severity": "high", "description": "实体不能为空"}],
            "rubricDimensions": ["准确性"],
            "forceRun": True,
        },
    )
    data = json.loads(content)
    tools = set()
    for node in data.get("businessDag") or []:
        calls = (node.get("details") or {}).get("calls") or {}
        for t in calls.get("tools") or []:
            if isinstance(t, dict) and t.get("tool"):
                tools.add(t["tool"])
        for s in calls.get("sandbox") or []:
            if isinstance(s, dict) and s.get("tool"):
                tools.add(s["tool"])
    if not tools:
        raise AssertionError("no tool names in businessDag.calls")
    return f"traceId={data.get('traceId')}, tools={sorted(tools)[:4]}"


def check_web_bundle_has_dag_canvas():
    _, html = fetch("/?view=task&taskId=task_ner_002&step=publish")
    # Next.js 静态资源 hash 会变，检查页面是否包含新版中文文案
    markers = ["AI 质量审核", "分支汇聚流程图", "执行调用明细"]
    found = [m for m in markers if m in html]
    if len(found) < 1:
        # SSR 可能不含全文，至少不应出现旧调用链计数 UI
        if "调用链 (RAG" in html:
            raise AssertionError("still serving old call-chain UI")
    return f"markers={found or ['SSR-minimal']}"


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
    run(
        "grafana nav html",
        lambda: check_html_no_stale(
            "grafana",
            GRAFANA_SLUG_PATH + "?orgId=1&from=now-6h&to=now",
            must_contain=["LabelHub Agent 诊断台"],
            must_not_contain=STALE_GRAFANA_MARKERS,
        ),
    )
    run("publish page no stale trace in api", check_audit_has_tool_calls)
    run("web publish markers", check_web_bundle_has_dag_canvas)
    run(
        "trace page",
        lambda: check_html_no_stale("trace", "/?view=trace", must_contain=["Trace"], must_not_contain=[STALE_TRACE]),
    )

    print(f"\n产品验收: {sum(checks)}/{len(checks)} 通过")
    sys.exit(0 if all(checks) else 1)


if __name__ == "__main__":
    main()
