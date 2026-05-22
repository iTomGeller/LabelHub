import paramiko
import sys
import json

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('8.146.231.216', username='root', password='REDACTED_USE_ENV_VAR')

print("=== 1. Running containers ===")
stdin, stdout, stderr = ssh.exec_command('docker ps --format "{{.Names}} {{.Status}}" | grep labelhub', timeout=10)
stdout.channel.recv_exit_status()
print(stdout.read().decode('utf-8', errors='replace'))

print("=== 2. Agent runtime health ===")
stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:8000/health', timeout=10)
stdout.channel.recv_exit_status()
print(stdout.read().decode('utf-8', errors='replace'))

print("\n=== 3. DeepSeek generate-task-config ===")
payload = json.dumps({
    "taskId": "test_001",
    "taskName": "电商评论情感分类",
    "instruction": "根据用户评论判断情感倾向(正面/负面/中性)，并标注关键句",
    "sampleData": [
        {"comment": "退款三天不到账客服没人回", "orderId": "ORD-001"},
        {"comment": "质量很好下次还会购买", "orderId": "ORD-002"}
    ],
    "traceId": "test_trace"
}, ensure_ascii=False)

cmd = f"curl -s -X POST http://localhost:8000/agents/generate-task-config -H 'Content-Type: application/json' -d '{payload}'"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=90)
ec = stdout.channel.recv_exit_status()
result = stdout.read().decode('utf-8', errors='replace')
print(result[:3000])
print(f"exit: {ec}")

print("\n=== 4. Web HTTP status ===")
stdin, stdout, stderr = ssh.exec_command('curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/', timeout=10)
stdout.channel.recv_exit_status()
print(stdout.read().decode('utf-8', errors='replace'))

print("\n=== 5. Web agent-api proxy ===")
stdin, stdout, stderr = ssh.exec_command('curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/agent-api/health', timeout=10)
stdout.channel.recv_exit_status()
print(stdout.read().decode('utf-8', errors='replace'))

ssh.close()
print("\nDone.")
