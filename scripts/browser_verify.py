"""线上用户路径与产品级验收（HTML + API）。"""
import io
import json
import sys
import urllib.request

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

BASE = "http://8.146.231.216"
STALE_TRACE = "trace_1779676180789_50359dc6"
STALE_GRAFANA_MARKERS = [
    "LabelHub Agent 级监控",
    "RAG 命中率 (全 Agent)",
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
    vars_ = {v.get("name") for v in dash.get("templating", {}).get("list", [])}
    if "agent" not in vars_:
        raise AssertionError("missing agent var")
    return f"title={title}, vars={sorted(vars_)}"


def check_grafana_nav_path():
    status, _ = fetch(GRAFANA_SLUG_PATH + "?orgId=1&from=now-6h&to=now")
    if status != 200:
        raise AssertionError(f"nav HTTP {status}")
    api = check_grafana_api()
    _, settings = fetch("/?view=settings&tab=ai")
    if "labelhub-agent-diagnostic" not in settings:
        raise AssertionError("settings missing diagnostic link")
    return f"nav ok, {api}"


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


def check_web_publish():
    _, html = fetch("/?view=task&taskId=task_ner_002&step=publish")
    if "调用链 (RAG" in html:
        raise AssertionError("still serving old call-chain UI")
    if "AI 质量审核" not in html:
        raise AssertionError("missing publish audit section")
    return "publish page ok"


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
    run("grafana nav path", check_grafana_nav_path)
    run("audit tool calls", check_audit_has_tool_calls)
    run("web publish page", check_web_publish)
    run("trace page", lambda: fetch("/?view=trace")[0] == 200 or (_ for _ in ()).throw(AssertionError("trace page fail")))

    print(f"\n产品验收: {sum(checks)}/{len(checks)} 通过")
    sys.exit(0 if all(checks) else 1)


if __name__ == "__main__":
    main()
