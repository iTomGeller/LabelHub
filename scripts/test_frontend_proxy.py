"""Test the frontend /agent-api proxy path (simulates browser call)."""
import paramiko
import sys
import json

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('8.146.231.216', username='root', password='REDACTED_USE_ENV_VAR')

    payload = json.dumps({
        "taskId": "browser_test_001",
        "taskName": "问答对质量评估",
        "instruction": "评估AI生成的问答对质量，判断答案是否准确、完整、无幻觉。",
        "sampleData": [
            {"question": "Python如何读取JSON文件？", "answer": "使用json.load()函数可以读取JSON文件。", "source": "技术文档"},
            {"question": "地球到月球的距离？", "answer": "大约38万公里。", "source": "百科"}
        ],
        "traceId": "trace_browser_001"
    })

    # This simulates the browser calling /agent-api/ (via Next.js rewrite to agent-runtime)
    cmd = f"curl -s -X POST http://localhost:3000/agent-api/agents/generate-task-config -H 'Content-Type: application/json' -d '{payload}'"
    print(">>> Testing frontend proxy path: /agent-api/agents/generate-task-config")

    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60)
    ec = stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8', errors='replace')

    if out:
        try:
            result = json.loads(out)
            print(f"\nSUCCESS! Components: {len(result.get('schemaComponents', []))}, Rules: {len(result.get('rubricRules', []))}")
            print(f"Rationale: {result.get('rationale', '')[:200]}")
        except json.JSONDecodeError:
            print(f"Non-JSON response: {out[:500]}")
    print(f"exit: {ec}")
    ssh.close()

if __name__ == '__main__':
    main()
