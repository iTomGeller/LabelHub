"""Test the DeepSeek integration end-to-end on ECS."""
import paramiko
import sys
import json

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST = '8.146.231.216'
USER = 'root'
PASSWORD = 'REDACTED_USE_ENV_VAR'

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD)

    payload = json.dumps({
        "taskId": "test_001",
        "taskName": "电商评论意图分类",
        "instruction": "根据电商用户评论判断主要意图（咨询/投诉/夸赞/售后），并给出判断依据。需要标注员引用原文关键词。",
        "sampleData": [
            {"comment": "退款申请三天了还不到账，客服也没人回复。", "orderId": "ORD-10001", "channel": "mobile-app"},
            {"comment": "宝贝收到了，质量很好，下次还来！", "orderId": "ORD-10002", "channel": "pc-web"},
            {"comment": "请问这个能换货吗？尺码偏小。", "orderId": "ORD-10003", "channel": "mini-program"}
        ],
        "traceId": "trace_test_001"
    })

    cmd = f"curl -s -X POST http://localhost:8000/agents/generate-task-config -H 'Content-Type: application/json' -d '{payload}'"
    print(">>> Calling DeepSeek via agent-runtime...")
    print(f"Payload: {payload[:200]}...\n")

    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60)
    ec = stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')

    if out:
        try:
            result = json.loads(out)
            print("=== SUCCESS: DeepSeek Response ===")
            print(f"Rationale: {result.get('rationale', 'N/A')}")
            print(f"Schema Components: {len(result.get('schemaComponents', []))} items")
            for c in result.get('schemaComponents', []):
                print(f"  - [{c.get('type')}] {c.get('label')} ({c.get('dataPath')})")
            print(f"Rubric Rules: {len(result.get('rubricRules', []))} items")
            for r in result.get('rubricRules', []):
                print(f"  - [{r.get('severity')}] {r.get('description')}")
            print(f"Dimensions: {result.get('rubricDimensions', [])}")
            print(f"Assignment Policy: {result.get('assignmentPolicy', {})}")
            print(f"Agent Policy: {result.get('agentPolicy', {})}")
        except json.JSONDecodeError:
            print("Raw output:", out[:3000])
    if err:
        print("STDERR:", err[:500])
    print(f"\nexit: {ec}")

    ssh.close()

if __name__ == '__main__':
    main()
