"""Verify deployed LabelHub endpoints, trace execution groups, and Grafana diagnostics."""
import io
import json
import sys
import urllib.request

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

BASE = "http://8.146.231.216"
STALE_GRAFANA_MARKERS = [
    "LabelHub Agent 级监控",
    "RAG 命中率 (全 Agent)",
]
GRAFANA_NAV_PATH = "/grafana/d/labelhub-agent-rag-trace/labelhub-agent-diagnostic?orgId=1&from=now-6h&to=now"
GRAFANA_DASHBOARD_PATH = "/etc/grafana/provisioning/dashboards/agent-rag-trace.json"


def fetch(path, method="GET", body=None, timeout=30):
    url = BASE + path
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        content = resp.read().decode("utf-8", errors="replace")
        return resp.status, content


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


def grafana_stale_panels(dashboard_json):
    stale = 0
    text = json.dumps(dashboard_json, ensure_ascii=False)
    for bad in STALE_GRAFANA_MARKERS:
        if bad in text:
            stale += 1
    if "trace_persist_failed_total / audit_run_total" in text:
        stale += 1
    if "1 - (sum(trace_persist_failed_total)" in text:
        stale += 1
    return stale


def validate_grafana_dashboard(dashboard_json):
    stale = grafana_stale_panels(dashboard_json)
    if stale > 0:
        raise AssertionError(f"stale panels={stale}")

    title = dashboard_json.get("title", "")
    if title != "LabelHub Agent 诊断台":
        raise AssertionError(f"unexpected title={title!r}")

    templating = dashboard_json.get("templating", {}).get("list", [])
    var_names = {v.get("name") for v in templating}
    if "agent" not in var_names:
        raise AssertionError("missing agent template variable")

    panel_text = json.dumps(dashboard_json.get("panels", []), ensure_ascii=False)
    if "$agent" not in panel_text:
        raise AssertionError("no panel query references $agent")

    table_panels = [p for p in dashboard_json.get("panels", []) if p.get("type") == "table"]
    if not table_panels:
        raise AssertionError("missing Agent/Node table panel")

    return f"title={title}, vars={sorted(var_names)}, table panels={len(table_panels)}"


def fetch_grafana_dashboard():
    paths = [
        "/grafana/api/dashboards/uid/labelhub-agent-rag-trace",
        "http://127.0.0.1:3001/grafana/api/dashboards/uid/labelhub-agent-rag-trace",
    ]
    last_error = None
    for path in paths:
        try:
            url = path if path.startswith("http") else BASE + path
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=20) as resp:
                payload = json.loads(resp.read().decode("utf-8", errors="replace"))
            dashboard = payload.get("dashboard") or payload
            return validate_grafana_dashboard(dashboard)
        except Exception as e:
            last_error = e
    raise last_error or AssertionError("unable to fetch grafana dashboard")


def main():
    checks = []
    audit_data = {}

    def check(name, fn):
        try:
            result = fn()
            print(f"OK  {name}: {result}")
            checks.append(True)
            return result
        except Exception as e:
            print(f"FAIL {name}: {e}")
            checks.append(False)
            return None

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
                "schemaComponents": [{"id": "entity", "label": "实体", "type": "text", "dataPath": "entity", "required": True, "validation": []}],
                "rubricRules": [{"severity": "high", "description": "实体不能为空"}],
                "rubricDimensions": ["准确性"],
                "forceRun": True,
            },
        )
        data = json.loads(content)
        audit_data.update(data)
        biz = data.get("businessDag") or []
        dev = data.get("developerDag") or []
        groups = count_trace_groups(dev)
        trace_match = business_trace_match(biz, data.get("traceId"))
        details_ok = all(
            isinstance((n.get("details") or {}).get("checkedItems"), list)
            for n in biz
        ) if biz else False
        return (
            f"status={status}, traceId={data.get('traceId')}, biz={len(biz)}, dev={len(dev)}, "
            f"trace groups={groups}, business details trace match={trace_match}, structured={details_ok}, "
            f"complete={data.get('traceCompleteness')}"
        )

    check("audit run", run_audit)

    def trace_groups():
        dev = audit_data.get("developerDag") or []
        groups = count_trace_groups(dev)
        if groups != 6:
            raise AssertionError(f"expected 6 execution groups, got {groups}")
        types = {n.get("type") for n in dev}
        if "agent_execution" in types:
            bad = [t for t in types if t not in ("agent_execution",)]
            if bad:
                raise AssertionError(f"unexpected top-level trace types: {bad}")
        return f"trace groups={groups}"

    check("trace execution groups", trace_groups)

    def business_details():
        biz = audit_data.get("businessDag") or []
        trace_id = audit_data.get("traceId")
        if not business_trace_match(biz, trace_id):
            raise AssertionError("businessDag details.traceId mismatch")
        evidence_types = set()
        for node in biz:
            for item in (node.get("details") or {}).get("evidenceItems") or []:
                if isinstance(item, dict):
                    evidence_types.add(item.get("type"))
        if len(evidence_types) < 1:
            raise AssertionError("expected structured evidenceItems")
        return f"business details trace match=True, evidence types={sorted(evidence_types)}"

    check("business details trace match", business_details)

    def metrics():
        _, content = fetch("/agent-api/actuator/prometheus")
        wanted = [
            "audit_run_total",
            "agent_trace_run_total",
            "agent_trace_node_total",
            "agent_rag_retrieval_total",
            "agent_rag_run_empty_total",
            "agent_tool_call_total",
            "agent_mcp_call_total",
            "agent_skill_selected_total",
        ]
        found = [m for m in wanted if m in content]
        if "agent_trace_run_total" not in content:
            raise AssertionError("missing agent_trace_run_total")
        return f"found {len(found)}/{len(wanted)}: {', '.join(found)}"

    check("prometheus metrics", metrics)

    def grafana_dashboard():
        try:
            return fetch_grafana_dashboard()
        except Exception as online_error:
            try:
                with open(GRAFANA_DASHBOARD_PATH, encoding="utf-8") as f:
                    dash = json.load(f)
            except FileNotFoundError:
                with open("deploy/grafana/dashboards/agent-rag-trace.json", encoding="utf-8") as f:
                    dash = json.load(f)
            local = validate_grafana_dashboard(dash)
            return f"online unavailable ({online_error}); local ok: {local}"

    check("grafana diagnostic dashboard", grafana_dashboard)

    def grafana_nav_page():
        status, html = fetch(GRAFANA_NAV_PATH)
        if status != 200:
            raise AssertionError(f"HTTP {status}")
        if "LabelHub Agent 诊断台" not in html:
            raise AssertionError("nav page missing 诊断台 title")
        for bad in STALE_GRAFANA_MARKERS:
            if bad in html:
                raise AssertionError(f"stale marker in nav html: {bad}")
        return "nav page ok"

    check("grafana user nav path", grafana_nav_page)

    def audit_tool_names():
        biz = audit_data.get("businessDag") or []
        tools = set()
        for node in biz:
            calls = (node.get("details") or {}).get("calls") or {}
            for t in calls.get("tools") or []:
                if isinstance(t, dict) and t.get("tool"):
                    tools.add(t["tool"])
            for s in calls.get("sandbox") or []:
                if isinstance(s, dict) and s.get("tool"):
                    tools.add(s["tool"])
        if not tools:
            raise AssertionError("no structured tool names")
        return f"tools={sorted(tools)[:5]}"

    check("audit tool call names", audit_tool_names)

    print(f"\nSummary: {sum(checks)}/{len(checks)} checks passed")
    sys.exit(0 if all(checks) else 1)


if __name__ == "__main__":
    main()
