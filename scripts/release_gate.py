"""Release gate: verify build artifacts, trace groups, cache schema, and Grafana diagnostics."""
import io
import json
import subprocess
import sys
import urllib.request
from pathlib import Path
from typing import List, Optional, Tuple

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
BASE = "http://8.146.231.216"


def run(cmd: List[str], cwd: Optional[Path] = None) -> Tuple[int, str]:
    result = subprocess.run(cmd, cwd=cwd or ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")
    out = (result.stdout or "") + (result.stderr or "")
    return result.returncode, out.strip()


def fetch(path, method="GET", body=None, timeout=30):
    url = BASE + path
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read().decode("utf-8", errors="replace")


def count_trace_groups(developer_dag):
    execution = [n for n in developer_dag if n.get("type") == "agent_execution"]
    if execution:
        return len(execution)
    legacy_map = {"_tn_1", "_tn_2", "_tn_3", "_tn_4", "_tn_5", "_tn_6"}
    groups = set()
    for node in developer_dag:
        node_id = node.get("id", "")
        for suffix in legacy_map:
            if node_id.endswith(suffix):
                groups.add(suffix)
    return len(groups) if groups else len(developer_dag)


def business_trace_match(business_dag, trace_id):
    if not business_dag or not trace_id:
        return False
    for node in business_dag:
        details = node.get("details") or {}
        if str(details.get("traceId", "")) != trace_id:
            return False
    return True


def grafana_stale_panels():
    path = ROOT / "deploy" / "grafana" / "dashboards" / "agent-rag-trace.json"
    dash = json.loads(path.read_text(encoding="utf-8"))
    text = json.dumps(dash, ensure_ascii=False)
    stale = 0
    if "RAG 命中率 (全 Agent)" in text:
        stale += 1
    if "1 - (sum(trace_persist_failed_total)" in text:
        stale += 1
    return stale


def main():
    checks: List[tuple] = []
    audit_data = {}

    def record(name: str, ok: bool, detail: str):
        checks.append((name, ok, detail))
        print(f"{'OK  ' if ok else 'FAIL'} {name}: {detail}")

    code, out = run(["git", "status", "--short"])
    record("git status", code == 0, out[:200] if out else "clean")

    code, out = run(["npm", "run", "build", "-w", "@labelhub/web"], cwd=ROOT)
    record("web build", code == 0, "compiled" if code == 0 else out[-300:])

    try:
        status, content = fetch("/agent-api/agents/health")
        record("api health", status == 200, content[:100])
    except Exception as e:
        record("api health", False, str(e))

    try:
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
        audit_data.update(data)
        biz_len = len(data.get("businessDag") or [])
        dev = data.get("developerDag") or []
        groups = count_trace_groups(dev)
        complete = data.get("traceCompleteness")
        trace_match = business_trace_match(data.get("businessDag") or [], data.get("traceId"))
        record(
            "force audit run",
            status == 200 and biz_len == 6 and groups == 6 and trace_match,
            f"biz={biz_len}, trace groups={groups}, complete={complete}, trace match={trace_match}, traceId={data.get('traceId')}",
        )
        trace_id = data.get("traceId")
        if trace_id:
            _, trace_content = fetch(f"/agent-api/agents/audit-runs/{trace_id}")
            loaded = json.loads(trace_content)
            loaded_groups = count_trace_groups(loaded.get("developerDag") or [])
            record(
                "trace reload",
                len(loaded.get("businessDag") or []) == 6 and loaded_groups == 6,
                f"biz={len(loaded.get('businessDag') or [])}, groups={loaded_groups}, complete={loaded.get('traceCompleteness')}",
            )
    except Exception as e:
        record("force audit run", False, str(e))

    try:
        _, content = fetch("/agent-api/actuator/prometheus")
        wanted = [
            "agent_trace_run_total",
            "agent_trace_node_total",
            "agent_rag_retrieval_total",
            "agent_rag_run_empty_total",
            "agent_tool_call_total",
            "agent_mcp_call_total",
            "agent_skill_selected_total",
        ]
        found = [m for m in wanted if m in content]
        bad_formula = "trace_persist_failed_total / audit_run_total" in content
        record(
            "agent-level prometheus metrics",
            "agent_trace_run_total" in content and len(found) >= 5 and not bad_formula,
            f"found {len(found)}/{len(wanted)}: {', '.join(found)}",
        )
    except Exception as e:
        record("prometheus metrics", False, str(e))

    stale = grafana_stale_panels()
    record("grafana stale panels", stale == 0, f"grafana stale panels={stale}")

    try:
        for path in ["/", "/?view=trace", "/?view=settings&tab=knowledge", "/?view=settings&tab=ai"]:
            status, _ = fetch(path)
            record(f"page {path}", status == 200, f"HTTP {status}")
    except Exception as e:
        record("page checks", False, str(e))

    passed = sum(1 for _, ok, _ in checks if ok)
    total = len(checks)
    print(f"\nRelease gate: {passed}/{total} passed")
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
