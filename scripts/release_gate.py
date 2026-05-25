"""Release gate: verify build artifacts, git state, and deployed endpoints."""
import io
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
BASE = "http://8.146.231.216"


def run(cmd: list[str], cwd: Path | None = None) -> tuple[int, str]:
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


def main():
    checks: list[tuple[str, bool, str]] = []

    def record(name: str, ok: bool, detail: str):
        checks.append((name, ok, detail))
        print(f"{'OK  ' if ok else 'FAIL'} {name}: {detail}")

    # Local gates
    code, out = run(["git", "status", "--short"])
    record("git status", code == 0, out[:200] if out else "clean")

    code, out = run(["npm", "run", "build", "-w", "@labelhub/web"], cwd=ROOT)
    record("web build", code == 0, "compiled" if code == 0 else out[-300:])

    # Remote API gates
    try:
        status, content = fetch("/agent-api/agents/health")
        record("api health", status == 200, content[:100])
    except Exception as e:
        record("api health", False, str(e))

    try:
        status, content = fetch("/agent-api/agents/audit-runs/recent?limit=5")
        rows = json.loads(content)
        record("recent traces", status == 200 and isinstance(rows, list), f"count={len(rows)}")
        if rows:
            trace_id = rows[0].get("trace_id")
            biz = rows[0].get("business_node_count", "?")
            dev = rows[0].get("developer_node_count", "?")
            record("recent trace counts", True, f"trace={trace_id}, biz={biz}, dev={dev}")
    except Exception as e:
        record("recent traces", False, str(e))

    try:
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
        biz_len = len(data.get("businessDag") or [])
        dev_len = len(data.get("developerDag") or [])
        complete = data.get("traceCompleteness")
        record(
            "force audit run",
            status == 200 and biz_len == 6 and dev_len > 0,
            f"biz={biz_len}, dev={dev_len}, complete={complete}, traceId={data.get('traceId')}",
        )
        trace_id = data.get("traceId")
        if trace_id:
            _, trace_content = fetch(f"/agent-api/agents/audit-runs/{trace_id}")
            loaded = json.loads(trace_content)
            record(
                "trace reload",
                len(loaded.get("businessDag") or []) == 6 and len(loaded.get("developerDag") or []) > 0,
                f"biz={len(loaded.get('businessDag') or [])}, dev={len(loaded.get('developerDag') or [])}, complete={loaded.get('traceCompleteness')}",
            )
    except Exception as e:
        record("force audit run", False, str(e))

    try:
        _, content = fetch("/agent-api/actuator/prometheus")
        wanted = [
            "agent_rag_retrieval_total",
            "agent_tool_call_total",
            "agent_mcp_call_total",
            "agent_skill_selected_total",
            "trace_persist_failed_total",
        ]
        found = [m for m in wanted if m in content]
        record("agent-level prometheus metrics", len(found) >= 4, f"found {len(found)}/{len(wanted)}: {', '.join(found)}")
        agents = [
            "task_context_builder",
            "dataset_sampler",
            "schema_generator",
            "rubric_generator",
            "critic",
            "task_package_writer",
        ]
        agent_hits = [a for a in agents if f'agent="{a}"' in content or f'agent={a}' in content]
        record("prometheus agent labels", len(agent_hits) >= 1, f"agents in metrics: {', '.join(agent_hits) or 'none yet'}")
    except Exception as e:
        record("prometheus metrics", False, str(e))

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
