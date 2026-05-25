"""Verify deployed LabelHub endpoints and agent-level metrics."""
import io
import json
import sys
import urllib.request

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

BASE = "http://8.146.231.216"


def fetch(path, method="GET", body=None):
    url = BASE + path
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as resp:
        content = resp.read().decode("utf-8", errors="replace")
        return resp.status, content


def main():
    checks = []

    def check(name, fn):
        try:
            result = fn()
            print(f"OK  {name}: {result}")
            checks.append(True)
        except Exception as e:
            print(f"FAIL {name}: {e}")
            checks.append(False)

    check("web home", lambda: fetch("/")[0])
    check("trace page", lambda: fetch("/?view=trace")[0])
    check("settings knowledge tab", lambda: fetch("/?view=settings&tab=knowledge")[0])
    check("settings ai tab", lambda: fetch("/?view=settings&tab=ai")[0])
    check("api health", lambda: fetch("/agent-api/agents/health")[1][:80])
    check("recent traces", lambda: fetch("/agent-api/agents/audit-runs/recent?limit=5")[1][:120])

    def run_audit():
        status, content = fetch(
            "/agent-api/agents/audit-runs",
            method="POST",
            body={
                "taskId": "task_ner_002",
                "taskName": "电商评论实体抽取",
                "instruction": "标注评论中的商品实体",
                "sampleData": [{"text": "a"}, {"text": "b"}, {"text": "c"}],
                "schemaComponents": [{"label": "实体", "type": "text", "dataPath": "entity"}],
                "rubricRules": [{"severity": "high", "description": "实体不能为空"}],
                "rubricDimensions": ["准确性"],
                "forceRun": True,
            },
        )
        data = json.loads(content)
        biz = len(data.get("businessDag") or [])
        dev = len(data.get("developerDag") or [])
        return f"status={status}, traceId={data.get('traceId')}, biz={biz}, dev={dev}, complete={data.get('traceCompleteness')}"

    check("audit run", run_audit)

    def metrics():
        _, content = fetch("/agent-api/actuator/prometheus")
        wanted = [
            "audit_run_total",
            "agent_rag_retrieval_total",
            "agent_tool_call_total",
            "agent_mcp_call_total",
            "agent_skill_selected_total",
        ]
        found = [m for m in wanted if m in content]
        return f"found {len(found)}/{len(wanted)}: {', '.join(found)}"

    check("prometheus metrics", metrics)

    print(f"\nSummary: {sum(checks)}/{len(checks)} checks passed")
    sys.exit(0 if all(checks) else 1)


if __name__ == "__main__":
    main()
